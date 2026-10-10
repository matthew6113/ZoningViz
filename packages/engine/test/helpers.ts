import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createEngine, parseDistrictFile, syntheticLot, type DistrictFile, type Engine, type ParcelInput } from "../src";
import { loadManifold } from "../src/geometry/manifold";

// Test-only: district files live with their jurisdiction; read them by path so
// the engine package never depends on a jurisdiction package.
const DISTRICTS = join(import.meta.dirname, "..", "..", "jurisdictions", "sf", "districts");

export function loadDistrict(code: string): DistrictFile {
  const path = join(DISTRICTS, `${code}.json`);
  return parseDistrictFile(JSON.parse(readFileSync(path, "utf8")), path);
}

/** A recorded real parcel (see scripts/record-engine-fixtures.ts). */
export function loadParcel(blklot: string): ParcelInput {
  return JSON.parse(readFileSync(join(import.meta.dirname, "fixtures", "parcels", `${blklot}.json`), "utf8"));
}

let engine: Promise<Engine> | null = null;
export function getEngine(): Promise<Engine> {
  engine ??= createEngine();
  return engine;
}

/** SPEC.md fixtures A/B: a mid-block lot in a 40-X district (the district file supplies the rules). */
export function rectangularLot(width: number, depth: number): ParcelInput {
  return syntheticLot(width, depth, { label: "40-X", heightFt: 40 });
}

/** Rebuilds a WASM solid from an exported mesh, for geometric assertions in tests. */
export async function toManifold(solid: { positions: Float32Array; indices: Uint32Array }) {
  const wasm = await loadManifold();
  return new wasm.Manifold(new wasm.Mesh({ numProp: 3, vertProperties: solid.positions, triVerts: solid.indices }));
}
