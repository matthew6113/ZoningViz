import type { Manifold, ManifoldToplevel } from "manifold-3d";
import { centroidOf, findStreetSides, lotFrame, toPlanar, translate } from "./geometry/lot";
import {
  bottomOf,
  crossSection,
  footprintArea,
  heightfieldSolid,
  loadManifold,
  sliceArea,
  sliceOutline,
  toSolid,
  topOf,
} from "./geometry/manifold";
import { multiPolygonArea, type XY } from "./geometry/projection";
import {
  CURB_REFERENCE,
  FLAT_REFERENCE,
  groundOf,
  measureGround,
  shiftGrid,
  upslopeReference,
  type Ground,
  type GroundMeasurements,
  type HeightReference,
} from "./geometry/terrain";
import { applyCut, cutPlanesFor, dimensionsFor, uncoveredArea, type CutContext } from "./rules/regions";
import { ft, resolveFrontSetback, resolveRule, type ResolveContext } from "./rules/resolve";
import type { DistrictFile } from "./rules/schema";
import type {
  EnvelopeOptions,
  EnvelopeResult,
  Floor,
  FrontCandidate,
  HeightGrid,
  LotTerrain,
  ParcelInput,
  Solid,
  Step,
} from "./types";

/**
 * The starting "potential" block rises to this multiple of the mapped height,
 * so the first cut always reads clearly. A presentation choice (decided with
 * the project owner), not a zoning value.
 */
export const START_HEIGHT_MULTIPLE = 2;

/** Default floor-to-floor height for slicing the final envelope (SPEC.md; user-adjustable). */
export const DEFAULT_FLOOR_TO_FLOOR_FT = 10;

// Below these, a cut or a floor plate counts as nothing (floating-point noise).
const EMPTY_VOLUME_FT3 = 1e-3;
const EMPTY_AREA_FT2 = 0.5;
// The lot prism starts this far below the lowest ground, so the ground cut is never flush with it.
const BELOW_GROUND_FT = 10;

export interface Engine {
  computeEnvelope(parcel: ParcelInput, district: DistrictFile, options?: EnvelopeOptions): EnvelopeResult;
}

/** Loads the geometry kernel (WebAssembly) once and returns the engine. */
export async function createEngine(options: { locateWasm?: () => string } = {}): Promise<Engine> {
  const wasm = await loadManifold(options.locateWasm);
  return { computeEnvelope: (parcel, district, opts = {}) => computeEnvelope(wasm, parcel, district, opts) };
}

function computeEnvelope(
  wasm: ManifoldToplevel,
  parcel: ParcelInput,
  district: DistrictFile,
  options: EnvelopeOptions,
): EnvelopeResult {
  // 1. Project to feet and recenter on the lot centroid.
  const planarLot = toPlanar(parcel.footprint, parcel.projection);
  if (planarLot.length === 0) throw new Error(`Parcel ${parcel.id} has no usable geometry`);
  const originPlanar = centroidOf(planarLot);
  const lot = translate(planarLot, originPlanar);
  const neighbors = parcel.neighbors.map((n) => translate(toPlanar(n, parcel.projection), originPlanar));

  // 2. Front lot line.
  const candidates = findStreetSides(lot, neighbors);
  let front: FrontCandidate | undefined = candidates.length === 1 ? candidates[0] : undefined;
  if (!front) {
    front = options.frontSide === undefined ? undefined : candidates[options.frontSide];
    if (!front) return { status: "needs_front_choice", candidates, outline: lot, neighbors, originPlanar };
  }

  // 3. Measure the lot.
  const frame = lotFrame(lot, front);
  const lotAreaSqFt = multiPolygonArea(lot);
  const notes: string[] = [];
  if (frame.approximate) {
    notes.push("Approximate geometry: this lot isn't a simple rectangle, so its width, depth and yard lines are approximations.");
  }

  // 3b. Ground: measure it on the lot, and put the curb estimate at z = 0.
  const terrain = parcel.terrain ? measureTerrain(parcel.terrain, originPlanar, lot, front, frame) : null;
  const referenceRule = district.rules.find((r) => r.kind === "height_reference");
  let reference: HeightReference = FLAT_REFERENCE;
  if (terrain) {
    reference =
      referenceRule && terrain.measured.centerlineRiseFt > 0
        ? upslopeReference(lot, frame, terrain.ground, referenceRule.params.upslopeCurbWithinFeet)
        : CURB_REFERENCE;
  } else if (district.rules.some((r) => r.kind === "height_by_slope" || r.kind === "height_reference")) {
    notes.push("No ground elevations for this lot, so it is treated as flat and slope-based limits use their flat-lot values.");
  }

  const zones = parcel.heightZones.map((zone) => {
    const planar = translate(toPlanar(zone.geometry, parcel.projection), originPlanar);
    return { ...zone, planar, share: multiPolygonArea(planar) / lotAreaSqFt, center: centroidOf(planar) };
  });

  // 4. Starting block: 2x the mapped height (or 2x the district's own cap when no mapped height is readable).
  const mapped = zones.map((z) => z.heightFt).filter((h): h is number => h !== null);
  let baseHeight = mapped.length ? Math.max(...mapped) : null;
  if (baseHeight === null) {
    const caps = district.rules.flatMap((r) =>
      r.kind === "height_cap" && "feet" in r.params ? [r.params.feet] : r.kind === "height_by_slope" ? [r.params.baseFeet] : [],
    );
    if (!caps.length) throw new Error(`No readable height limit for parcel ${parcel.id}`);
    baseHeight = Math.max(...caps);
    notes.push(`The mapped height can't be read, so the starting block uses ${START_HEIGHT_MULTIPLE}× the district's ${ft(baseHeight)} cap.`);
  }
  const startHeightFt = START_HEIGHT_MULTIPLE * baseHeight;

  const radius = Math.max(...lot.flat(2).map(([x, y]) => Math.hypot(x, y)));
  const relief = terrain ? Math.max(...terrain.grids.fine.elevationsFt.map(Math.abs)) : 0;
  const cutCtx: CutContext = {
    wasm,
    frame,
    lot,
    zones,
    bigFt: 10 * (radius + startHeightFt + relief),
    topFt: startHeightFt,
    bottomFt: 0,
    reference,
    ground: terrain?.ground ?? null,
  };
  if (zones.length > 1) {
    const gap = uncoveredArea(cutCtx);
    if (gap > EMPTY_AREA_FT2) {
      notes.push(`${Math.round(gap)} sq ft of the lot lies outside every mapped height district; no height limit is applied there.`);
    }
  }

  // On sloping ground the block stands on the terrain and rises to 2x the height above the highest reference.
  const lotSection = crossSection(wasm, lot);
  let current: Manifold;
  if (terrain) {
    const fine = terrain.grids.fine;
    const bottomZ = Math.min(...fine.elevationsFt) - BELOW_GROUND_FT;
    const prism = lotSection.extrude(reference.maxFt + startHeightFt - bottomZ);
    const raised = prism.translate([0, 0, bottomZ]);
    const earth = heightfieldSolid(wasm, fine, bottomZ - BELOW_GROUND_FT);
    current = raised.subtract(earth);
    [prism, raised, earth].forEach((o) => o.delete());
  } else {
    current = lotSection.extrude(startHeightFt);
  }
  lotSection.delete();
  const startVolume = current.volume();
  const start = { ...toSolid(current), heightFt: startHeightFt };

  // 5–7. Resolve, cut and measure each rule in order.
  const ctx: ResolveContext = {
    widthFt: frame.widthFt,
    depthFt: frame.depthFt,
    zones: zones.map((z) => ({
      label: z.label,
      heightFt: z.heightFt,
      localProgramHeightFt: z.localProgramHeightFt ?? null,
      share: z.share,
    })),
    frontSetbackFt: resolveFrontSetback(district, options),
    ground: terrain
      ? {
          curbFt: terrain.measured.curbFt,
          frontAverageFt: terrain.measured.frontAverageFt,
          rearAverageFt: terrain.measured.rearAverageFt,
        }
      : null,
    reference: reference.kind,
  };
  const disabled = new Set(options.disabledRuleIds ?? []);
  const steps: Step[] = [];
  let currentSolid: Solid = start;

  for (const rule of district.rules) {
    const before = currentSolid;
    const measure = (removedVolume: number) => ({
      volume: current.volume(),
      removedVolume,
      footprintSqFt: footprintArea(current),
      percentOfStart: (current.volume() / startVolume) * 100,
    });

    if (disabled.has(rule.id)) {
      steps.push({
        rule,
        status: "disabled",
        sentence: `${rule.title}: turned off.`,
        numbers: {},
        dimensions: [],
        cutPlanes: [],
        before,
        removed: null,
        after: before,
        measurements: measure(0),
      });
      continue;
    }

    const resolved = resolveRule(rule, ctx, options);
    if (resolved.cut.type === "none") {
      steps.push({
        rule,
        status: resolved.status === "cut" ? "not_modeled" : resolved.status,
        sentence: resolved.sentence,
        numbers: resolved.numbers,
        dimensions: [],
        cutPlanes: [],
        before,
        removed: null,
        after: before,
        measurements: measure(0),
      });
      continue;
    }

    const cutPlanes = cutPlanesFor(resolved.cut, { ...cutCtx, topFt: topOf(current), bottomFt: bottomOf(current) });
    const next = applyCut(current, resolved.cut, cutCtx);
    const removed = current.subtract(next);
    const removedVolume = removed.volume();
    const hasEffect = removedVolume > EMPTY_VOLUME_FT3;
    const removedSolid = hasEffect ? toSolid(removed) : null;
    removed.delete();
    current.delete();
    current = next;
    currentSolid = hasEffect ? toSolid(current) : before;

    steps.push({
      rule,
      status: hasEffect ? "cut" : "already_satisfied",
      sentence: hasEffect
        ? resolved.sentence
        : `${resolved.sentence} Already satisfied: earlier limits already keep the building inside this one.`,
      numbers: resolved.numbers,
      dimensions: dimensionsFor(resolved.cut, cutCtx, zones.map((z) => z.center)),
      cutPlanes,
      before,
      removed: removedSolid,
      after: currentSolid,
      measurements: measure(hasEffect ? removedVolume : 0),
    });
  }

  // 8. Slice floors.
  const floors = sliceFloors(current, options.floorToFloorFeet ?? DEFAULT_FLOOR_TO_FLOOR_FT);
  const finalVolume = current.volume();
  if (finalVolume <= EMPTY_VOLUME_FT3) {
    notes.push("Nothing is left: together these limits cover the whole lot. On a corner lot, measuring from the other front may leave room.");
  }
  const footprintSqFt = footprintArea(current);
  current.delete();

  return {
    status: "ok",
    lot: {
      areaSqFt: lotAreaSqFt,
      widthFt: frame.widthFt,
      depthFt: frame.depthFt,
      approximate: frame.approximate,
      front,
      frontCandidates: candidates,
      outline: lot,
      neighbors,
      originPlanar: originPlanar as XY,
      terrain: terrain?.summary ?? null,
      ground: terrain?.grids ?? null,
    },
    start,
    steps,
    final: currentSolid,
    floors,
    totals: {
      volume: finalVolume,
      footprintSqFt,
      stories: floors.length,
      grossFloorAreaSqFt: floors.reduce((sum, f) => sum + f.plateSqFt, 0),
      percentSurvived: (finalVolume / startVolume) * 100,
    },
    notes,
  };
}

/** Ground measurements and the terrain grids in world feet, with the curb estimate at z = 0. */
function measureTerrain(
  input: NonNullable<ParcelInput["terrain"]>,
  originPlanar: XY,
  lot: ReturnType<typeof translate>,
  front: FrontCandidate,
  frame: ReturnType<typeof lotFrame>,
): { ground: Ground; grids: { fine: HeightGrid; context: HeightGrid | null }; measured: GroundMeasurements; summary: LotTerrain } {
  const world = (grid: HeightGrid, datum: number) => shiftGrid(grid, originPlanar, datum);
  const absolute = groundOf(world(input.fine, 0), input.context ? world(input.context, 0) : null);
  const measured = measureGround(lot, front, frame, absolute);
  const datum = measured.curbFt;
  const grids = { fine: world(input.fine, datum), context: input.context ? world(input.context, datum) : null };
  return {
    ground: groundOf(grids.fine, grids.context),
    grids,
    measured,
    summary: {
      curbElevationFt: measured.curbFt,
      frontAverageFt: measured.frontAverageFt,
      rearAverageFt: measured.rearAverageFt,
      rearMinusFrontFt: measured.rearAverageFt - measured.frontAverageFt,
      upslope: measured.centerlineRiseFt > 0,
      crossSlopePct: measured.crossSlopePct,
      source: input.source,
      asOf: input.asOf,
    },
  };
}

/** Floor plates every `floorToFloorFt`, counted from the curb datum; on downsloping lots some levels sit below it. */
function sliceFloors(envelope: Manifold, floorToFloorFt: number): Floor[] {
  if (!(floorToFloorFt > 0)) throw new Error(`Floor-to-floor height must be positive, got ${floorToFloorFt}`);
  const top = topOf(envelope);
  const floors: Floor[] = [];
  for (let i = Math.floor(bottomOf(envelope) / floorToFloorFt); (i + 0.5) * floorToFloorFt < top; i++) {
    const mid = (i + 0.5) * floorToFloorFt;
    const plateSqFt = sliceArea(envelope, mid);
    if (plateSqFt <= EMPTY_AREA_FT2) continue;
    floors.push({
      index: floors.length,
      bottomFt: i * floorToFloorFt,
      topFt: (i + 1) * floorToFloorFt,
      plateSqFt,
      outline: sliceOutline(envelope, mid),
    });
  }
  return floors;
}
