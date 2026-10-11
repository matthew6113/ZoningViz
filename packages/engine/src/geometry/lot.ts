import type { MultiPolygon } from "geojson";
import type { FrontCandidate } from "../types";
import {
  multiPolygonArea,
  projectMultiPolygon,
  signedRingArea,
  type PlanarMultiPolygon,
  type PlanarPolygon,
  type Ring,
  type XY,
} from "./projection";

// Geometric tolerances (feet / degrees). These describe drawing precision,
// not zoning: none of them is a code requirement.
const PROBE_DISTANCES_FT = [0.5, 2];
const SAMPLE_STEP_FT = 1;
const SIDE_TURN_DEG = 30;
const MIN_SIDE_FT = 5;
const MIN_SIDE_FRACTION = 0.15;
const RECTANGULARITY_TOLERANCE = 0.03;

// ---------- planar preparation ----------

/** Projects (when needed), drops duplicate points, and orients outer rings CCW and holes CW. */
export function toPlanar(geometry: MultiPolygon, projection: string | null): PlanarMultiPolygon {
  const raw: PlanarMultiPolygon = projection
    ? projectMultiPolygon(geometry, projection)
    : geometry.coordinates.map((polygon) => polygon.map((ring) => ring.map(([x, y]) => [x!, y!] as XY)));
  return raw
    .map((polygon) =>
      polygon
        .map(cleanRing)
        .filter((ring) => ring.length >= 3)
        .map((ring, i) => orient(ring, i === 0)),
    )
    .filter((polygon) => polygon.length > 0);
}

function cleanRing(ring: Ring): Ring {
  const out: Ring = [];
  for (const p of ring) {
    const last = out[out.length - 1];
    if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) > 1e-9) out.push([p[0], p[1]]);
  }
  const first = out[0];
  const last = out[out.length - 1];
  if (first && last && out.length > 1 && Math.hypot(first[0] - last[0], first[1] - last[1]) <= 1e-9) out.pop();
  return out;
}

function orient(ring: Ring, outer: boolean): Ring {
  const ccw = signedRingArea(ring) > 0;
  return ccw === outer ? ring : [...ring].reverse();
}

/** Area-weighted centroid of a planar multipolygon (holes subtract). */
export function centroidOf(multi: PlanarMultiPolygon): XY {
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (const polygon of multi) {
    for (const ring of polygon) {
      for (let i = 0; i < ring.length; i++) {
        const [x1, y1] = ring[i]!;
        const [x2, y2] = ring[(i + 1) % ring.length]!;
        const cross = x1 * y2 - x2 * y1;
        area += cross;
        cx += (x1 + x2) * cross;
        cy += (y1 + y2) * cross;
      }
    }
  }
  return [cx / (3 * area), cy / (3 * area)];
}

export function translate(multi: PlanarMultiPolygon, by: XY): PlanarMultiPolygon {
  return multi.map((polygon) => polygon.map((ring) => ring.map(([x, y]) => [x - by[0], y - by[1]] as XY)));
}

// ---------- front lot line ----------

/**
 * Finds the lot's street sides: runs of edges that border no neighboring parcel,
 * split where the outline turns. Sorted longest first.
 */
export function findStreetSides(lot: PlanarMultiPolygon, neighbors: PlanarMultiPolygon[]): FrontCandidate[] {
  const ring = largestPolygon(lot)[0]!;
  const nearby = neighbors.filter((n) => bboxesTouch(bbox(n), bbox(lot), Math.max(...PROBE_DISTANCES_FT) + 1));

  // Split every edge into short pieces and probe just outside each piece: if no
  // probe lands inside a neighbor, that piece faces the street.
  const pieces: { a: XY; b: XY; exposed: boolean }[] = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % ring.length]!;
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const out = rightNormal(a, b);
    const count = Math.max(1, Math.ceil(length / SAMPLE_STEP_FT));
    for (let k = 0; k < count; k++) {
      const p = lerp(a, b, k / count);
      const q = lerp(a, b, (k + 1) / count);
      const mid = lerp(p, q, 0.5);
      const exposed = PROBE_DISTANCES_FT.every(
        (d) => !nearby.some((n) => pointInMultiPolygon([mid[0] + out[0] * d, mid[1] + out[1] * d], n)),
      );
      pieces.push({ a: p, b: q, exposed });
    }
  }

  let runs: XY[][];
  const exposedCount = pieces.filter((p) => p.exposed).length;
  if (exposedCount === 0 || exposedCount === pieces.length) {
    // No neighbors (or fully enclosed): every side is a candidate.
    runs = [closedLoopFromSharpestCorner(ring)];
  } else {
    const start = pieces.findIndex((p, i) => p.exposed && !pieces[(i - 1 + pieces.length) % pieces.length]!.exposed);
    runs = [];
    let current: XY[] | null = null;
    for (let k = 0; k < pieces.length; k++) {
      const piece = pieces[(start + k) % pieces.length]!;
      if (piece.exposed) {
        if (!current) current = [piece.a];
        current.push(piece.b);
      } else if (current) {
        runs.push(current);
        current = null;
      }
    }
    if (current) runs.push(current);
  }

  const sides = runs.flatMap(splitIntoSides).map(simplifyCollinear).sort((a, b) => chordLength(b) - chordLength(a));
  const longest = chordLength(sides[0]!);
  const kept = sides.filter((side) => chordLength(side) >= Math.max(MIN_SIDE_FT, MIN_SIDE_FRACTION * longest));
  // A sliver parcel can have no side long enough to count; its longest side is still a front.
  return (kept.length ? kept : sides.slice(0, 1))
    .map((side, index) => {
      const from = side[0]!;
      const to = side[side.length - 1]!;
      return { index, from, to, lengthFt: chordLength(side), path: side, outward: rightNormal(from, to) };
    });
}

function closedLoopFromSharpestCorner(ring: Ring): XY[] {
  let best = 0;
  let bestTurn = -1;
  ring.forEach((p, i) => {
    const prev = ring[(i - 1 + ring.length) % ring.length]!;
    const next = ring[(i + 1) % ring.length]!;
    const turn = Math.abs(angleBetween(heading(prev, p), heading(p, next)));
    if (turn > bestTurn) [best, bestTurn] = [i, turn];
  });
  const loop = ring.slice(best).concat(ring.slice(0, best));
  return [...loop, loop[0]!];
}

function splitIntoSides(run: XY[]): XY[][] {
  const sides: XY[][] = [];
  let side: XY[] = [run[0]!];
  let reference: number | null = null;
  for (let i = 1; i < run.length; i++) {
    const h = heading(run[i - 1]!, run[i]!);
    if (reference !== null && Math.abs(angleBetween(reference, h)) > SIDE_TURN_DEG) {
      sides.push(side);
      side = [run[i - 1]!];
      reference = null;
    }
    reference ??= h;
    side.push(run[i]!);
  }
  sides.push(side);
  return sides;
}

function simplifyCollinear(side: XY[]): XY[] {
  return side.filter((p, i) => {
    if (i === 0 || i === side.length - 1) return true;
    return Math.abs(angleBetween(heading(side[i - 1]!, p), heading(p, side[i + 1]!))) > 1e-6;
  });
}

// ---------- lot frame and measurements ----------

/**
 * The lot frame: s runs along the front line, d runs inward from it.
 * `toWorld` maps (s, d) back to world feet.
 */
export interface LotFrame {
  origin: XY;
  u: XY;
  n: XY;
  widthFt: number;
  depthFt: number;
  approximate: boolean;
  toFrame(p: XY): XY;
  toWorld(s: number, d: number): XY;
}

export function lotFrame(lot: PlanarMultiPolygon, front: FrontCandidate): LotFrame {
  const origin = front.from;
  const widthFt = front.lengthFt;
  const u: XY = [(front.to[0] - front.from[0]) / widthFt, (front.to[1] - front.from[1]) / widthFt];
  const n: XY = [-u[1], u[0]]; // inward: left of travel along a CCW ring
  const toFrame = (p: XY): XY => {
    const dx = p[0] - origin[0];
    const dy = p[1] - origin[1];
    return [dx * u[0] + dy * u[1], dx * n[0] + dy * n[1]];
  };
  const ds = lot.flat(2).map((p) => toFrame(p)[1]);
  const depthFt = Math.max(...ds);
  const area = multiPolygonArea(lot);
  const pathLength = polylineLength(front.path);
  const approximate =
    lot.length > 1 ||
    lot.some((polygon) => polygon.length > 1) ||
    Math.min(...ds) < -0.5 ||
    pathLength > widthFt * 1.02 ||
    Math.abs(area / (widthFt * depthFt) - 1) > RECTANGULARITY_TOLERANCE;
  return {
    origin,
    u,
    n,
    widthFt,
    depthFt,
    approximate,
    toFrame,
    toWorld: (s, d) => [origin[0] + s * u[0] + d * n[0], origin[1] + s * u[1] + d * n[1]],
  };
}

// ---------- small helpers ----------

function largestPolygon(multi: PlanarMultiPolygon): PlanarPolygon {
  return [...multi].sort((a, b) => Math.abs(signedRingArea(b[0]!)) - Math.abs(signedRingArea(a[0]!)))[0]!;
}

function lerp(a: XY, b: XY, t: number): XY {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/** Unit normal to the right of a→b: outward for a counter-clockwise outer ring. */
function rightNormal(a: XY, b: XY): XY {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return [(b[1] - a[1]) / len, -(b[0] - a[0]) / len];
}

function heading(a: XY, b: XY): number {
  return (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
}

function angleBetween(h1: number, h2: number): number {
  return ((h2 - h1 + 540) % 360) - 180;
}

function chordLength(side: XY[]): number {
  const a = side[0]!;
  const b = side[side.length - 1]!;
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

function polylineLength(points: XY[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i]![0] - points[i - 1]![0], points[i]![1] - points[i - 1]![1]);
  }
  return total;
}

type Box = [number, number, number, number];

function bbox(multi: PlanarMultiPolygon): Box {
  const points = multi.flat(2);
  return [
    Math.min(...points.map((p) => p[0])),
    Math.min(...points.map((p) => p[1])),
    Math.max(...points.map((p) => p[0])),
    Math.max(...points.map((p) => p[1])),
  ];
}

function bboxesTouch(a: Box, b: Box, margin: number): boolean {
  return a[0] <= b[2] + margin && b[0] <= a[2] + margin && a[1] <= b[3] + margin && b[1] <= a[3] + margin;
}

function pointInMultiPolygon(p: XY, multi: PlanarMultiPolygon): boolean {
  let inside = false;
  for (const polygon of multi) {
    for (const ring of polygon) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i]!;
        const [xj, yj] = ring[j]!;
        if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
      }
    }
  }
  return inside;
}
