import type { Manifold, ManifoldToplevel } from "manifold-3d";
import type { LotFrame } from "../geometry/lot";
import { crossSection, keepHalfSpace } from "../geometry/manifold";
import type { PlanarMultiPolygon, XY } from "../geometry/projection";
import type { CutPlane, Dimension, Vec3 } from "../types";
import { ft, type Cut } from "./resolve";

// Builds the allowed region for each kind of cut and applies it:
// next = prev ∩ allowed. The caller computes removed = prev − next.

// Zone pieces are grown by this much before they are unioned, so hairline gaps
// between adjacent pieces (floating-point noise) don't become cuts.
const ZONE_GROWTH_FT = 0.01;

export interface CutContext {
  wasm: ManifoldToplevel;
  frame: LotFrame;
  lot: PlanarMultiPolygon;
  zones: { planar: PlanarMultiPolygon }[];
  /** Comfortably larger than anything on the lot; used for "no limit here". */
  bigFt: number;
  /** Height of the starting block, which bounds the cut planes. */
  startHeightFt: number;
}

export function applyCut(prev: Manifold, cut: Cut, ctx: CutContext): Manifold {
  const { frame } = ctx;
  const at = (s: number, d: number, z: number): Vec3 => {
    const [x, y] = frame.toWorld(s, d);
    return [x, y, z];
  };
  const n: Vec3 = [frame.n[0], frame.n[1], 0];

  switch (cut.type) {
    case "none":
      throw new Error("applyCut called for a rule without geometry");
    case "uniform_height":
      return keepHalfSpace(prev, [0, 0, -1], [0, 0, cut.heightFt]);
    case "zone_heights":
      return intersectWithZones(prev, cut.heights, ctx);
    case "max_depth":
      return keepHalfSpace(prev, [-n[0], -n[1], 0], at(0, cut.depthFt, 0));
    case "min_depth":
      return keepHalfSpace(prev, n, at(0, cut.depthFt, 0));
    case "plane": {
      // Keep z ≤ start + tan(angle)·(d − d₀).
      const t = Math.tan((cut.angleDeg * Math.PI) / 180);
      return keepHalfSpace(prev, [t * n[0], t * n[1], -1], at(0, cut.fromDepthFt, cut.startHeightFt));
    }
  }
}

function intersectWithZones(prev: Manifold, heights: (number | null)[], ctx: CutContext): Manifold {
  const { wasm, lot, bigFt } = ctx;
  const prisms: Manifold[] = [];
  const grown = ctx.zones.map((zone) => {
    const section = crossSection(wasm, zone.planar);
    const bigger = section.offset(ZONE_GROWTH_FT, "Miter");
    section.delete();
    return bigger;
  });
  grown.forEach((section, i) => prisms.push(section.extrude(heights[i] ?? bigFt)));

  // Any part of the lot outside every mapped zone has no known limit: leave it uncut.
  const lotSection = crossSection(wasm, lot);
  const covered = wasm.CrossSection.union(grown);
  const uncovered = lotSection.subtract(covered);
  if (!uncovered.isEmpty()) prisms.push(uncovered.extrude(bigFt));

  const allowed = wasm.Manifold.union(prisms);
  const next = prev.intersect(allowed);
  [...grown, lotSection, covered, uncovered, allowed, ...prisms].forEach((o) => o.delete());
  return next;
}

/** The part of the lot no height zone covers, in square feet. */
export function uncoveredArea(ctx: CutContext): number {
  const { wasm } = ctx;
  const lotSection = crossSection(wasm, ctx.lot);
  const raw = ctx.zones.map((z) => crossSection(wasm, z.planar));
  const sections = raw.map((section) => section.offset(ZONE_GROWTH_FT, "Miter"));
  const covered = wasm.CrossSection.union(sections);
  const uncovered = lotSection.subtract(covered);
  const area = uncovered.area();
  [lotSection, covered, uncovered, ...raw, ...sections].forEach((o) => o.delete());
  return area;
}

/** Dimension lines for the scene, in world feet. */
export function dimensionsFor(cut: Cut, ctx: CutContext, zoneCenters: XY[]): Dimension[] {
  const { frame } = ctx;
  const mid = frame.widthFt / 2;
  const at = (s: number, d: number, z: number): Vec3 => {
    const [x, y] = frame.toWorld(s, d);
    return [x, y, z];
  };
  switch (cut.type) {
    case "none":
      return [];
    case "uniform_height":
      return [{ from: at(0, 0, 0), to: at(0, 0, cut.heightFt), label: ft(cut.heightFt) }];
    case "zone_heights":
      return cut.heights.flatMap((h, i) => {
        const c = zoneCenters[i];
        return h === null || !c ? [] : [{ from: [c[0], c[1], 0] as Vec3, to: [c[0], c[1], h] as Vec3, label: ft(h) }];
      });
    case "max_depth":
      return [
        {
          from: at(mid, frame.depthFt, 0),
          to: at(mid, cut.depthFt, 0),
          label: ft(frame.depthFt - cut.depthFt),
        },
      ];
    case "min_depth":
      return cut.depthFt > 0 ? [{ from: at(mid, 0, 0), to: at(mid, cut.depthFt, 0), label: ft(cut.depthFt) }] : [];
    case "plane":
      return [
        {
          from: at(mid, cut.fromDepthFt, 0),
          to: at(mid, cut.fromDepthFt, cut.startHeightFt),
          label: `${ft(cut.startHeightFt)}, then ${cut.angleDeg}°`,
        },
      ];
  }
}

/** Where each cut's boundary crosses the starting block, as flat parallelograms in world feet. */
export function cutPlanesFor(cut: Cut, ctx: CutContext): CutPlane[] {
  const { frame, startHeightFt: top } = ctx;
  const at = (s: number, d: number, z: number): Vec3 => {
    const [x, y] = frame.toWorld(s, d);
    return [x, y, z];
  };
  const along = (s: number, d: number, z = 0): Vec3 => [frame.u[0] * s + frame.n[0] * d, frame.u[1] * s + frame.n[1] * d, z];
  const span = (points: XY[]) => {
    const local = points.map((p) => frame.toFrame(p));
    const ss = local.map((p) => p[0]);
    const ds = local.map((p) => p[1]);
    return { s0: Math.min(...ss), s1: Math.max(...ss), d0: Math.min(...ds), d1: Math.max(...ds) };
  };
  const lot = span(ctx.lot.flat(2));
  const width = lot.s1 - lot.s0;
  const horizontal = (b: ReturnType<typeof span>, z: number): CutPlane => ({
    origin: at(b.s0, b.d0, z),
    u: along(b.s1 - b.s0, 0),
    v: along(0, b.d1 - b.d0),
  });
  const vertical = (d: number): CutPlane => ({ origin: at(lot.s0, d, 0), u: along(width, 0), v: [0, 0, top] });

  switch (cut.type) {
    case "none":
      return [];
    case "uniform_height":
      return [horizontal(lot, cut.heightFt)];
    case "zone_heights":
      return cut.heights.flatMap((h, i) => {
        const zone = ctx.zones[i];
        return h === null || !zone ? [] : [horizontal(span(zone.planar.flat(2)), h)];
      });
    case "max_depth":
    case "min_depth":
      return [vertical(cut.depthFt)];
    case "plane": {
      // From the start line up to the top of the block, or to the back of the lot if that comes first.
      const t = Math.tan((cut.angleDeg * Math.PI) / 180);
      let rise = Math.max(top - cut.startHeightFt, 0);
      let run = rise / t;
      if (cut.fromDepthFt + run > lot.d1) {
        run = Math.max(lot.d1 - cut.fromDepthFt, 0);
        rise = run * t;
      }
      return [{ origin: at(lot.s0, cut.fromDepthFt, cut.startHeightFt), u: along(width, 0), v: along(0, run, rise) }];
    }
  }
}
