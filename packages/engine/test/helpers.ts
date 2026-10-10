import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { MultiPolygon } from "geojson";
import { createEngine, parseDistrictFile, type DistrictFile, type Engine, type ParcelInput } from "../src";

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

function rect(x0: number, y0: number, x1: number, y1: number): MultiPolygon {
  return { type: "MultiPolygon", coordinates: [[[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]]] };
}

/**
 * A mid-block lot in planar feet: `width` along a street to the south (y = 0),
 * `depth` deep, with neighbors on both sides and behind.
 */
export function rectangularLot(width: number, depth: number, heightFt = 40, label = "40-X"): ParcelInput {
  const footprint = rect(0, 0, width, depth);
  return {
    id: `synthetic-${width}x${depth}`,
    projection: null,
    footprint,
    neighbors: [rect(-width, 0, 0, depth), rect(width, 0, 2 * width, depth), rect(-width, depth, 2 * width, 2 * depth)],
    heightZones: [{ label, heightFt, geometry: footprint }],
  };
}
