import type { CrossSection, Manifold, ManifoldToplevel } from "manifold-3d";
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
// Side-yard bands start as a sliver this thin along each side line before they are grown to the yard width.
const SLIVER_FT = 0.002;
const BAND_SEGMENTS = 64; // round joins sit within 0.01 ft of the true yard line for yards up to ~10 ft

export interface CutContext {
  wasm: ManifoldToplevel;
  frame: LotFrame;
  lot: PlanarMultiPolygon;
  zones: { planar: PlanarMultiPolygon }[];
  /** Comfortably larger than anything on the lot; used for "no limit here". */
  bigFt: number;
  /** Top of the solid about to be cut, which bounds the cut planes. */
  topFt: number;
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
    case "side_strips":
      return keepOutsideSideYards(prev, cut, ctx);
  }
}

// Lot edges that run more front-to-back than across count as side lot lines.
// Each one is assigned to the left or right side (seen from the street) by
// where its midpoint falls across the lot.
interface SideEdge {
  a: XY;
  b: XY;
  /** Unit normal pointing into the lot. */
  inward: XY;
  length: number;
}

export function sideEdges(ctx: Pick<CutContext, "frame" | "lot">): { left: SideEdge[]; right: SideEdge[] } {
  const { frame } = ctx;
  const { s0, s1 } = lotSpan(ctx);
  const middle = (s0 + s1) / 2;
  const left: SideEdge[] = [];
  const right: SideEdge[] = [];
  for (const polygon of ctx.lot) {
    const ring = polygon[0]!; // outer rings are counter-clockwise (toPlanar), so the lot is on the left
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i]!;
      const b = ring[(i + 1) % ring.length]!; // rings may be open or closed; a closing repeat has zero length
      if (a === b) continue;
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const length = Math.hypot(dx, dy);
      if (length < 1e-6) continue;
      const along = Math.abs(dx * frame.u[0] + dy * frame.u[1]);
      const deep = Math.abs(dx * frame.n[0] + dy * frame.n[1]);
      if (deep <= along) continue;
      const edge = { a, b, inward: [-dy / length, dx / length] as XY, length };
      const mid = frame.toFrame([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2])[0];
      (mid < middle ? left : right).push(edge);
    }
  }
  return { left, right };
}

/** Removes everything within `leftFt` of the left side lot lines and `rightFt` of the right ones. */
function keepOutsideSideYards(prev: Manifold, cut: Extract<Cut, { type: "side_strips" }>, ctx: CutContext): Manifold {
  const { wasm } = ctx;
  const edges = sideEdges(ctx);
  const bands: CrossSection[] = [];
  for (const [list, width] of [
    [edges.left, cut.leftFt],
    [edges.right, cut.rightFt],
  ] as const) {
    if (width <= 0) continue;
    for (const e of list) {
      // A hairline sliver along the edge, grown by the yard width: every point within `width` of the line.
      const t = SLIVER_FT / 2;
      const [mx, my] = [e.inward[0] * t, e.inward[1] * t];
      const sliver = new wasm.CrossSection(
        [
          [
            [e.a[0] - mx, e.a[1] - my],
            [e.b[0] - mx, e.b[1] - my],
            [e.b[0] + mx, e.b[1] + my],
            [e.a[0] + mx, e.a[1] + my],
          ],
        ],
        "NonZero", // either winding
      );
      bands.push(sliver.offset(width - t, "Round", 2, BAND_SEGMENTS));
      sliver.delete();
    }
  }
  if (bands.length === 0) return prev.translate([0, 0, 0]); // the caller deletes `prev`
  const band = wasm.CrossSection.union(bands);
  const lotSection = crossSection(wasm, ctx.lot);
  const allowedSection = lotSection.subtract(band);
  const allowed = allowedSection.extrude(ctx.bigFt);
  const next = prev.intersect(allowed);
  [...bands, band, lotSection, allowedSection, allowed].forEach((o) => o.delete());
  return next;
}

/** The longest edge on each side, for dimension lines and cut planes. */
function longestSideEdges(ctx: Pick<CutContext, "frame" | "lot">) {
  const { left, right } = sideEdges(ctx);
  const longest = (list: SideEdge[]) => list.reduce<SideEdge | null>((best, e) => (!best || e.length > best.length ? e : best), null);
  return { left: longest(left), right: longest(right) };
}

/** The lot's extent in the lot frame: s along the front, d into the lot. */
function lotSpan(ctx: Pick<CutContext, "frame" | "lot">) {
  const local = ctx.lot.flat(2).map((p) => ctx.frame.toFrame(p));
  const ss = local.map((p) => p[0]);
  const ds = local.map((p) => p[1]);
  return { s0: Math.min(...ss), s1: Math.max(...ss), d0: Math.min(...ds), d1: Math.max(...ds) };
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
    case "side_strips": {
      // Across each yard from the middle of its longest side line.
      const sides = longestSideEdges(ctx);
      const lines: Dimension[] = [];
      for (const [edge, width] of [
        [sides.left, cut.leftFt],
        [sides.right, cut.rightFt],
      ] as const) {
        if (!edge || width <= 0) continue;
        const mid: XY = [(edge.a[0] + edge.b[0]) / 2, (edge.a[1] + edge.b[1]) / 2];
        lines.push({ from: [mid[0], mid[1], 0], to: [mid[0] + edge.inward[0] * width, mid[1] + edge.inward[1] * width, 0], label: ft(width) });
      }
      return lines;
    }
  }
}

/** Where each cut's boundary crosses the solid being cut, as flat parallelograms in world feet. */
export function cutPlanesFor(cut: Cut, ctx: CutContext): CutPlane[] {
  const { frame, topFt: top } = ctx;
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
  const lot = lotSpan(ctx);
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
    case "side_strips": {
      // A plane along each side's longest lot line, set in by the yard width.
      const sides = longestSideEdges(ctx);
      const planes: CutPlane[] = [];
      for (const [edge, width] of [
        [sides.left, cut.leftFt],
        [sides.right, cut.rightFt],
      ] as const) {
        if (!edge || width <= 0) continue;
        planes.push({
          origin: [edge.a[0] + edge.inward[0] * width, edge.a[1] + edge.inward[1] * width, 0],
          u: [edge.b[0] - edge.a[0], edge.b[1] - edge.a[1], 0],
          v: [0, 0, top],
        });
      }
      return planes;
    }
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
