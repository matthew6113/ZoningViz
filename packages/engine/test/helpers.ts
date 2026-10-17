import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createEngine, parseDistrictFile, syntheticLot, type DistrictFile, type Engine, type ParcelInput } from "../src";
import { loadManifold } from "../src/geometry/manifold";

// Test-only: district files live with their jurisdiction; read them by path so
// the engine package never depends on a jurisdiction package.
const DISTRICTS = join(import.meta.dirname, "..", "..", "jurisdictions", "sf", "districts");

export function loadDistrict(code: string): DistrictFile {
  const path = join(DISTRICTS, `${code.replaceAll(" ", "-")}.json`); // files are named by the code, spaces as hyphens
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

/** The same lot in another height and bulk district (one zone covering the lot). */
export function withHeightDistrict(input: ParcelInput, label: string, heightFt: number, bulk: string | null): ParcelInput {
  return { ...input, heightZones: input.heightZones.map((zone) => ({ ...zone, label, heightFt, bulk })) };
}

/** SPEC.md fixtures A/B: a mid-block lot in a 40-X district (the district file supplies the rules). */
export function rectangularLot(width: number, depth: number): ParcelInput {
  return syntheticLot(width, depth, { label: "40-X", heightFt: 40, bulk: "X" });
}

/**
 * A rectangular lot (street to the south, as in rectangularLot) on ground that
 * rises `riseFt` from the front lot line to the rear one, evenly, with no
 * cross-slope. Negative `riseFt` falls toward the rear.
 */
export function slopedLot(width: number, depth: number, riseFt: number): ParcelInput {
  const lot = rectangularLot(width, depth);
  const spacing = 5;
  const [x0, y0] = [-10, -10];
  const nx = Math.round((width + 20) / spacing) + 1;
  const ny = Math.round((depth + 20) / spacing) + 1;
  const elevationsFt: number[] = [];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) elevationsFt.push((riseFt * (y0 + j * spacing)) / depth);
  return {
    ...lot,
    id: `${lot.id}-rise${riseFt}`,
    terrain: { fine: { x0, y0, spacingFt: spacing, nx, ny, elevationsFt }, context: null, source: "synthetic plane", asOf: null },
  };
}

/** Rebuilds a WASM solid from an exported mesh, for geometric assertions in tests. */
export async function toManifold(solid: { positions: Float32Array; indices: Uint32Array }) {
  const wasm = await loadManifold();
  return new wasm.Manifold(new wasm.Mesh({ numProp: 3, vertProperties: solid.positions, triVerts: solid.indices }));
}
