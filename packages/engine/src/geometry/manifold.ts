import Module, { type CrossSection, type Manifold, type ManifoldToplevel, type Mat4 } from "manifold-3d";
import type { HeightGrid, Solid, Vec3 } from "../types";
import type { PlanarMultiPolygon, XY } from "./projection";

// Thin wrapper over manifold-3d (WebAssembly). Manifold objects live in WASM
// memory and must be deleted; everything that leaves the engine is exported
// to plain arrays first.

let loading: Promise<ManifoldToplevel> | null = null;

/** Loads the WASM module once. Browsers pass `locateFile` to point at manifold.wasm. */
export function loadManifold(locateFile?: () => string): Promise<ManifoldToplevel> {
  loading ??= Module(locateFile ? { locateFile } : undefined).then((wasm) => {
    wasm.setup();
    return wasm;
  });
  return loading;
}

export function crossSection(wasm: ManifoldToplevel, multi: PlanarMultiPolygon): CrossSection {
  // EvenOdd treats inner rings as holes whatever their winding.
  return new wasm.CrossSection(multi.flat(1), "EvenOdd");
}

/** Returns the part of `m` on the side of the plane (through `through`) that `normal` points to. */
export function keepHalfSpace(m: Manifold, normal: Vec3, through: Vec3): Manifold {
  const length = Math.hypot(...normal);
  const unit: Vec3 = [normal[0] / length, normal[1] / length, normal[2] / length];
  const offset = unit[0] * through[0] + unit[1] * through[1] + unit[2] * through[2];
  return m.trimByPlane(unit, offset);
}

export function toSolid(m: Manifold): Solid {
  const mesh = m.getMesh();
  const vertexCount = mesh.vertProperties.length / mesh.numProp;
  const positions = new Float32Array(vertexCount * 3);
  for (let v = 0; v < vertexCount; v++) {
    for (let k = 0; k < 3; k++) positions[v * 3 + k] = mesh.vertProperties[v * mesh.numProp + k]!;
  }
  return { volume: m.volume(), positions, indices: new Uint32Array(mesh.triVerts) };
}

/** Plan area of `m` cut at height `z`. */
export function sliceArea(m: Manifold, z: number): number {
  const section = m.slice(z);
  const area = section.area();
  section.delete();
  return area;
}

export function sliceOutline(m: Manifold, z: number): XY[][] {
  const section = m.slice(z);
  const polygons = section.toPolygons().map((ring) => ring.map(([x, y]) => [x, y] as XY));
  section.delete();
  return polygons;
}

export function topOf(m: Manifold): number {
  return m.isEmpty() ? 0 : m.boundingBox().max[2];
}

/** Plan area of a solid: the area of its shadow on the ground plane. */
export function footprintArea(m: Manifold): number {
  if (m.isEmpty()) return 0;
  const shadow = m.project();
  const area = shadow.area();
  shadow.delete();
  return area;
}

/** The lowest point of a solid (0 when empty). */
export function bottomOf(m: Manifold): number {
  return m.isEmpty() ? 0 : m.boundingBox().min[2];
}

/**
 * A closed solid whose top is the grid's surface and whose bottom is flat at
 * `bottomZ`: the ground under a terrain grid, for cutting the lot prism to it.
 */
export function heightfieldSolid(wasm: ManifoldToplevel, grid: HeightGrid, bottomZ: number): Manifold {
  const { nx, ny, x0, y0, spacingFt: s } = grid;
  const count = nx * ny;
  const verts = new Float32Array(count * 2 * 3);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      verts.set([x0 + i * s, y0 + j * s, grid.elevationsFt[k]!], k * 3);
      verts.set([x0 + i * s, y0 + j * s, bottomZ], (count + k) * 3);
    }
  }
  const top = (i: number, j: number) => j * nx + i;
  const bottom = (i: number, j: number) => count + j * nx + i;
  const tris: number[] = [];
  for (let j = 0; j + 1 < ny; j++) {
    for (let i = 0; i + 1 < nx; i++) {
      const [a, b, c, d] = [top(i, j), top(i + 1, j), top(i + 1, j + 1), top(i, j + 1)];
      tris.push(a, b, c, a, c, d); // facing up
      const [A, B, C, D] = [bottom(i, j), bottom(i + 1, j), bottom(i + 1, j + 1), bottom(i, j + 1)];
      tris.push(A, C, B, A, D, C); // facing down
    }
  }
  // Walls around the edge, counter-clockwise seen from above so they face outward.
  const rim: [number, number][] = [];
  for (let i = 0; i < nx - 1; i++) rim.push([i, 0]);
  for (let j = 0; j < ny - 1; j++) rim.push([nx - 1, j]);
  for (let i = nx - 1; i > 0; i--) rim.push([i, ny - 1]);
  for (let j = ny - 1; j > 0; j--) rim.push([0, j]);
  for (let k = 0; k < rim.length; k++) {
    const [i1, j1] = rim[k]!;
    const [i2, j2] = rim[(k + 1) % rim.length]!;
    tris.push(top(i1, j1), bottom(i1, j1), bottom(i2, j2), top(i1, j1), bottom(i2, j2), top(i2, j2));
  }
  const mesh = new wasm.Mesh({ numProp: 3, vertProperties: verts, triVerts: new Uint32Array(tris) });
  mesh.merge();
  return new wasm.Manifold(mesh);
}

/**
 * Everything below a surface that varies only with depth behind the front line:
 * the (depth, z) profile `top` (front to back), extruded across the lot frame
 * from s = sLo to sHi and down to `bottomZ`. Beyond the first and last profile
 * points the surface stays level out to `reachFt`.
 */
export function profileSolid(
  wasm: ManifoldToplevel,
  frame: { origin: XY; u: XY; n: XY },
  sLo: number,
  sHi: number,
  top: [number, number][],
  bottomZ: number,
  reachFt: number,
): Manifold {
  const first = top[0]!;
  const last = top[top.length - 1]!;
  const outline: [number, number][] = [
    [first[0] - reachFt, first[1]],
    ...top,
    [last[0] + reachFt, last[1]],
    [last[0] + reachFt, bottomZ],
    [first[0] - reachFt, bottomZ],
  ];
  const section = new wasm.CrossSection([outline], "NonZero");
  const slab = section.extrude(sHi - sLo);
  section.delete();
  // (X, Y, Z) = (depth, height, along the front) → world: origin + n·X + ẑ·Y + u·(sLo + Z).
  const { origin, u, n } = frame;
  const matrix: Mat4 = [n[0], n[1], 0, 0, 0, 0, 1, 0, u[0], u[1], 0, 0, origin[0] + u[0] * sLo, origin[1] + u[1] * sLo, 0, 1];
  const placed = slab.transform(matrix);
  slab.delete();
  return placed;
}
