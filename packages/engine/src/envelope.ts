import type { Manifold, ManifoldToplevel } from "manifold-3d";
import { centroidOf, findStreetSides, isCornerLot, lotFrame, toPlanar, translate } from "./geometry/lot";
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
import { applyCut, cutPlanesFor, dimensionsFor, planBulk, referenceBand, uncoveredArea, type CutContext } from "./rules/regions";
import {
  describeBulkPlan,
  ft,
  planLocalProgram,
  resolveFirstStory,
  resolveFrontSetback,
  resolveRule,
  type ResolveContext,
} from "./rules/resolve";
import { withReplacedParams, type DistrictFile } from "./rules/schema";
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

/** The lot's height district can't be read and the district sets no cap of its own, so there is nothing to start from. */
export class UnreadableHeightError extends Error {}

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

  const mappedZones = parcel.heightZones.map((zone) => {
    const planar = translate(toPlanar(zone.geometry, parcel.projection), originPlanar);
    return { ...zone, planar, share: multiPolygonArea(planar) / lotAreaSqFt, center: centroidOf(planar) };
  });

  // 3c. Local program (when switched on): its heights replace the mapped ones where it applies.
  const disabled = new Set(options.disabledRuleIds ?? []);
  const program = planLocalProgram(
    district,
    mappedZones,
    { cornerLot: isCornerLot(candidates), areaSqFt: lotAreaSqFt },
    options.localProgram === true && !district.rules.some((r) => r.kind === "local_program" && disabled.has(r.id)),
  );
  const zones = mappedZones.map((zone, i) => {
    const programHeight = program?.active ? program.heights[i] : null;
    const inProgram = programHeight !== null && programHeight !== undefined;
    return { ...zone, baseHeightFt: zone.heightFt, heightFt: inProgram ? programHeight : zone.heightFt, inProgram };
  });

  // 4. Starting block: 2x the mapped height (the program's where it's on; or 2x the district's own cap when no height is readable).
  const mapped = zones.map((z) => z.heightFt).filter((h): h is number => h !== null);
  let baseHeight = mapped.length ? Math.max(...mapped) : null;
  if (baseHeight === null) {
    const caps = district.rules.flatMap((r) =>
      r.kind === "height_cap" && "feet" in r.params ? [r.params.feet] : r.kind === "height_by_slope" ? [r.params.baseFeet] : [],
    );
    if (!caps.length) {
      const labels = zones.map((z) => z.label).join(", ") || "none found";
      throw new UnreadableHeightError(
        `This lot's height district (${labels}) can't be read, so there's no height limit to start from and its envelope isn't shown. Check the limit with SF Planning.`,
      );
    }
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
  const zoneContexts = zones.map((z) => ({
    label: z.label,
    heightFt: z.heightFt,
    baseHeightFt: z.baseHeightFt,
    localProgramHeightFt: z.localProgramHeightFt ?? null,
    inProgram: z.inProgram,
    share: z.share,
    bulk: z.bulk ?? null,
  }));
  const firstStory = resolveFirstStory(district, zoneContexts);
  const ctx: ResolveContext = {
    widthFt: frame.widthFt,
    depthFt: frame.depthFt,
    lotAreaSqFt,
    zones: zoneContexts,
    frontSetbackFt: resolveFrontSetback(district, options),
    ground: terrain
      ? {
          curbFt: terrain.measured.curbFt,
          frontAverageFt: terrain.measured.frontAverageFt,
          rearAverageFt: terrain.measured.rearAverageFt,
        }
      : null,
    reference: reference.kind,
    firstStory,
    program,
  };
  const steps: Step[] = [];
  let currentSolid: Solid = start;

  for (const mappedRule of district.rules) {
    const before = currentSolid;
    const measure = (removedVolume: number) => ({
      volume: current.volume(),
      removedVolume,
      footprintSqFt: footprintArea(current),
      percentOfStart: (current.volume() / startVolume) * 100,
    });

    // Under an active local program, waived rules don't apply and replaced ones take the program's params.
    const waiver = program?.active ? program.waived.get(mappedRule.id) : undefined;
    if (waiver) {
      steps.push({
        rule: mappedRule,
        status: "not_applicable",
        sentence: `${mappedRule.title}: doesn't apply under ${program!.title}. ${waiver.because} (${waiver.citation}).`,
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
    const replacement = program?.active ? program.replaced.get(mappedRule.id) : undefined;
    const rule = replacement ? withReplacedParams(mappedRule, replacement.params, replacement.citation) : mappedRule;

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

    // Bulk limits fix plan dimensions, not a place: the geometry stage measures the envelope and picks the box to keep.
    const cut = resolved.cut.type === "bulk" ? planBulk(current, resolved.cut, cutCtx) : resolved.cut;
    const planned = cut.type === "bulk" ? describeBulkPlan(cut) : null;
    const sentence = planned?.sentence ? `${resolved.sentence} ${planned.sentence}` : resolved.sentence;
    const numbers = planned ? { ...resolved.numbers, ...planned.numbers } : resolved.numbers;
    const cutPlanes = cutPlanesFor(cut, { ...cutCtx, topFt: topOf(current), bottomFt: bottomOf(current) });
    const [next, removed] = applyCut(current, cut, cutCtx);
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
      sentence: hasEffect ? sentence : `${sentence} Already satisfied: earlier limits already keep the building inside this one.`,
      numbers,
      dimensions: dimensionsFor(cut, cutCtx, zones.map((z) => z.center)),
      cutPlanes,
      before,
      removed: removedSolid,
      after: currentSolid,
      measurements: measure(hasEffect ? removedVolume : 0),
    });
  }

  // 8. Slice floors.
  const floorToFloor = options.floorToFloorFeet ?? DEFAULT_FLOOR_TO_FLOOR_FT;
  const levels = storyLevels(floorToFloor, firstStory?.feet ?? null);
  const floors = reference.kind === "upslope" ? referenceFloors(current, levels, cutCtx) : sliceFloors(current, levels);
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

/**
 * Story k runs from level(k) to level(k + 1): every `floorToFloorFt` from the
 * datum, except that story 0 is `firstStoryFt` tall when the district sets one
 * (a commercial ground floor). Stories below the datum (k < 0) use the floor-to-floor height.
 */
interface StoryLevels {
  level(k: number): number;
  /** The story whose span contains `z`. */
  storyAt(z: number): number;
}

function storyLevels(floorToFloorFt: number, firstStoryFt: number | null): StoryLevels {
  if (!(floorToFloorFt > 0)) throw new Error(`Floor-to-floor height must be positive, got ${floorToFloorFt}`);
  const f = floorToFloorFt;
  const g = firstStoryFt ?? f;
  return {
    level: (k) => (k <= 0 ? k * f : g + (k - 1) * f),
    storyAt: (z) => (z < 0 ? Math.floor(z / f) : z < g ? 0 : 1 + Math.floor((z - g) / f)),
  };
}

/** Level floor plates counted from the curb datum; on downsloping lots some sit below it. */
function sliceFloors(envelope: Manifold, levels: StoryLevels): Floor[] {
  const top = topOf(envelope);
  const floors: Floor[] = [];
  for (let k = levels.storyAt(bottomOf(envelope)); ; k++) {
    const [bottomFt, topFt] = [levels.level(k), levels.level(k + 1)];
    const mid = (bottomFt + topFt) / 2;
    if (mid >= top) break;
    const plateSqFt = sliceArea(envelope, mid);
    if (plateSqFt <= EMPTY_AREA_FT2) continue;
    floors.push({ index: floors.length, bottomFt, topFt, plateSqFt, outline: sliceOutline(envelope, mid), plate: null });
  }
  return floors;
}

// Thickness of the slab used to measure a stepped plate (area = volume / thickness),
// and of the slab drawn at each stepped story's base.
const PLATE_MEASURE_FT = 0.1;
const PLATE_DRAW_FT = 0.3;

/**
 * Stories that follow the height reference on an upsloping lot: story k runs
 * from reference + k·f to reference + (k + 1)·f, so the building steps up the
 * hill the way its height is measured.
 */
function referenceFloors(envelope: Manifold, levels: StoryLevels, ctx: CutContext): Floor[] {
  const floors: Floor[] = [];
  const first = levels.storyAt(bottomOf(envelope) - ctx.reference.maxFt);
  const last = levels.storyAt(topOf(envelope)) + 1;
  for (let k = first; k <= last; k++) {
    const [bottomFt, topFt] = [levels.level(k), levels.level(k + 1)];
    const mid = (bottomFt + topFt) / 2;
    const band = referenceBand(ctx, mid - PLATE_MEASURE_FT / 2, mid + PLATE_MEASURE_FT / 2);
    const piece = envelope.intersect(band);
    const plateSqFt = piece.volume() / PLATE_MEASURE_FT;
    if (plateSqFt > EMPTY_AREA_FT2) {
      const shadow = piece.project();
      const outline = shadow.toPolygons().map((ring) => ring.map(([x, y]) => [x, y] as XY));
      shadow.delete();
      const base = referenceBand(ctx, bottomFt, bottomFt + PLATE_DRAW_FT);
      const slab = envelope.intersect(base);
      floors.push({
        index: floors.length,
        bottomFt,
        topFt,
        plateSqFt,
        outline,
        plate: slab.isEmpty() ? null : toSolid(slab),
      });
      [base, slab].forEach((o) => o.delete());
    }
    [band, piece].forEach((o) => o.delete());
  }
  return floors;
}

