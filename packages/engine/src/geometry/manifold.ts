import Module, { type CrossSection, type Manifold, type ManifoldToplevel } from "manifold-3d";
import type { Solid, Vec3 } from "../types";
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
