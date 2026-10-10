import type { MultiPolygon } from "geojson";
import type { ParcelInput } from "./types";

function rect(x0: number, y0: number, x1: number, y1: number): MultiPolygon {
  return { type: "MultiPolygon", coordinates: [[[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]]] };
}

/**
 * A synthetic mid-block lot in planar feet for tests and demos (SPEC.md
 * fixtures A and B): `width` along a street to the south (y = 0), `depth`
 * deep, with neighbors on both sides and behind. The mapped height district
 * is passed in; this builder supplies no zoning values of its own.
 */
export function syntheticLot(
  width: number,
  depth: number,
  heightDistrict: { label: string; heightFt: number },
): ParcelInput {
  const footprint = rect(0, 0, width, depth);
  return {
    id: `synthetic-${width}x${depth}`,
    projection: null,
    footprint,
    neighbors: [rect(-width, 0, 0, depth), rect(width, 0, 2 * width, depth), rect(-width, depth, 2 * width, 2 * depth)],
    heightZones: [{ ...heightDistrict, geometry: footprint }],
  };
}
