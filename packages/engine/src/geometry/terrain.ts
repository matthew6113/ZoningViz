import type { FrontCandidate, HeightGrid } from "../types";
import type { LotFrame } from "./lot";
import type { PlanarMultiPolygon, XY } from "./projection";

// Ground elevations: sampling the terrain grids, and the measurements the
// slope rules need (average ground along the front and rear lot lines, the
// curb estimate, the ground at the side lot lines of each cross-section).
// No zoning numbers here; the rules bring their own.

export type Ground = (x: number, y: number) => number;

/** Bilinear elevation at (x, y), or null outside the grid. */
export function sampleGrid(grid: HeightGrid, x: number, y: number): number | null {
  const fx = (x - grid.x0) / grid.spacingFt;
  const fy = (y - grid.y0) / grid.spacingFt;
  const eps = 1e-9;
  if (fx < -eps || fy < -eps || fx > grid.nx - 1 + eps || fy > grid.ny - 1 + eps) return null;
  const i = Math.min(Math.max(Math.floor(fx), 0), grid.nx - 2);
  const j = Math.min(Math.max(Math.floor(fy), 0), grid.ny - 2);
  const tx = Math.min(Math.max(fx - i, 0), 1);
  const ty = Math.min(Math.max(fy - j, 0), 1);
  const z = (a: number, b: number) => grid.elevationsFt[b * grid.nx + a]!;
  return (
    z(i, j) * (1 - tx) * (1 - ty) + z(i + 1, j) * tx * (1 - ty) + z(i, j + 1) * (1 - tx) * ty + z(i + 1, j + 1) * tx * ty
  );
}

/** The same grid moved by `-origin` and lowered by `datumFt`. */
export function shiftGrid(grid: HeightGrid, origin: XY, datumFt: number): HeightGrid {
  return {
    ...grid,
    x0: grid.x0 - origin[0],
    y0: grid.y0 - origin[1],
    elevationsFt: grid.elevationsFt.map((z) => z - datumFt),
  };
}

/** Elevation anywhere: the fine grid where it reaches, then the context grid, then the fine grid's nearest edge. */
export function groundOf(fine: HeightGrid, context: HeightGrid | null): Ground {
  return (x, y) => {
    const z = sampleGrid(fine, x, y) ?? (context ? sampleGrid(context, x, y) : null);
    if (z !== null) return z;
    const cx = Math.min(Math.max(x, fine.x0), fine.x0 + (fine.nx - 1) * fine.spacingFt);
    const cy = Math.min(Math.max(y, fine.y0), fine.y0 + (fine.ny - 1) * fine.spacingFt);
    return sampleGrid(fine, cx, cy)!;
  };
}

/** Average ground along a polyline, sampled about every `stepFt` and weighted by length. */
export function averageAlong(paths: XY[][], ground: Ground, stepFt = 1): number {
  let sum = 0;
  let total = 0;
  for (const path of paths) {
    for (let i = 0; i + 1 < path.length; i++) {
      const [ax, ay] = path[i]!;
      const [bx, by] = path[i + 1]!;
      const length = Math.hypot(bx - ax, by - ay);
      const n = Math.max(1, Math.ceil(length / stepFt));
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n;
        sum += ground(ax + (bx - ax) * t, ay + (by - ay) * t) * (length / n);
        total += length / n;
      }
    }
  }
  if (total === 0) {
    const p = paths[0]?.[0];
    return p ? ground(p[0], p[1]) : 0;
  }
  return sum / total;
}

/** The rear lot line: edges in the back half of the lot that face away from the street. */
export function rearLine(lot: PlanarMultiPolygon, front: FrontCandidate, frame: LotFrame): XY[][] {
  const edges: XY[][] = [];
  let deepest: XY | null = null;
  let deepestD = -Infinity;
  for (const polygon of lot) {
    const ring = polygon[0]!; // counter-clockwise: the lot is on the left, outward on the right
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i]!;
      const b = ring[(i + 1) % ring.length]!;
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (length < 1e-6) continue;
      const outward: XY = [(b[1] - a[1]) / length, -(b[0] - a[0]) / length];
      const facing = outward[0] * front.outward[0] + outward[1] * front.outward[1];
      const mid = frame.toFrame([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2])[1];
      if (facing < -0.5 && mid > frame.depthFt / 2) edges.push([a, b]);
      const d = frame.toFrame(a)[1];
      if (d > deepestD) [deepest, deepestD] = [a, d];
    }
  }
  return edges.length ? edges : deepest ? [[deepest]] : [];
}

/** Where a cross-section `d` behind the front line crosses the lot outline: its two outermost points. */
export function sidePointsAt(lot: PlanarMultiPolygon, frame: LotFrame, d: number): [XY, XY] | null {
  const hits: { s: number; p: XY }[] = [];
  for (const polygon of lot) {
    const ring = polygon[0]!;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i]!;
      const b = ring[(i + 1) % ring.length]!;
      const [as, ad] = frame.toFrame(a);
      const [bs, bd] = frame.toFrame(b);
      if (ad === bd || (ad - d) * (bd - d) > 0) continue;
      const t = (d - ad) / (bd - ad);
      const s = as + (bs - as) * t;
      hits.push({ s, p: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t] });
    }
  }
  if (hits.length < 2) return null;
  hits.sort((x, y) => x.s - y.s);
  return [hits[0]!.p, hits[hits.length - 1]!.p];
}

export interface GroundMeasurements {
  /** Ground at the middle of the front lot line: the curb estimate. */
  curbFt: number;
  frontAverageFt: number;
  rearAverageFt: number;
  /** Ground along the lot's centerline, front to back, averaged, minus the curb. */
  centerlineRiseFt: number;
  crossSlopePct: number;
}

/** Measures the ground for the slope rules. Elevations are whatever datum `ground` returns. */
export function measureGround(lot: PlanarMultiPolygon, front: FrontCandidate, frame: LotFrame, ground: Ground): GroundMeasurements {
  const [cx, cy] = frame.toWorld(frame.widthFt / 2, 0);
  const curbFt = ground(cx, cy);
  const centerline: XY[] = [frame.toWorld(frame.widthFt / 2, 0), frame.toWorld(frame.widthFt / 2, frame.depthFt)];
  return {
    curbFt,
    frontAverageFt: averageAlong([front.path], ground),
    rearAverageFt: averageAlong(rearLine(lot, front, frame), ground),
    centerlineRiseFt: averageAlong([centerline], ground) - curbFt,
    crossSlopePct: (Math.abs(ground(...front.from) - ground(...front.to)) / Math.max(front.lengthFt, 1e-6)) * 100,
  };
}

/**
 * Where height is measured from, as a function of depth behind the front line,
 * relative to the curb datum (z = 0).
 */
export interface HeightReference {
  kind: "flat" | "curb" | "upslope";
  /** Reference elevation at depth d. */
  at(d: number): number;
  /** Breakpoints (depth, elevation) of the reference, front to back; a repeated depth is a step. */
  samples: [number, number][];
  /** The highest reference elevation on the lot. */
  maxFt: number;
}

export const FLAT_REFERENCE: HeightReference = { kind: "flat", at: () => 0, samples: [], maxFt: 0 };
export const CURB_REFERENCE: HeightReference = { kind: "curb", at: () => 0, samples: [], maxFt: 0 };

/**
 * Upslope reference: the curb within `curbWithinFt` of the front line; behind
 * that, the average of the ground at the two side lot lines of each cross-section.
 */
export function upslopeReference(
  lot: PlanarMultiPolygon,
  frame: LotFrame,
  ground: Ground,
  curbWithinFt: number,
  stepFt = 2,
): HeightReference {
  const sideAverage = (d: number): number | null => {
    const sides = sidePointsAt(lot, frame, d);
    return sides ? (ground(...sides[0]) + ground(...sides[1])) / 2 : null;
  };
  const end = frame.depthFt;
  const samples: [number, number][] = [];
  const start = Math.min(curbWithinFt, end);
  const depths: number[] = [];
  for (let d = start; d < end; d += stepFt) depths.push(d);
  depths.push(end);
  let last = 0;
  for (const d of depths) {
    // Just inside the outline, so the cross-section still meets both side lines at the ends.
    const probe = Math.min(Math.max(d, 1e-3), end - 1e-3);
    const z = sideAverage(probe);
    if (z !== null) last = z;
    samples.push([d, z ?? last]);
  }
  const at = (d: number): number => {
    if (d <= start || samples.length === 0) return 0;
    if (d >= samples[samples.length - 1]![0]) return samples[samples.length - 1]![1];
    for (let k = 0; k + 1 < samples.length; k++) {
      const [d0, z0] = samples[k]!;
      const [d1, z1] = samples[k + 1]!;
      if (d >= d0 && d <= d1) return d1 === d0 ? z1 : z0 + ((z1 - z0) * (d - d0)) / (d1 - d0);
    }
    return samples[samples.length - 1]![1];
  };
  // The step from the curb up to the cross-section reference at `start`.
  const withStep: [number, number][] = [[0, 0], [start, 0], ...samples];
  return { kind: "upslope", at, samples: withStep, maxFt: Math.max(0, ...samples.map(([, z]) => z)) };
}
