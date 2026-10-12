import type { MultiPolygon } from "geojson";
import type { HeightZoneInput, ParcelInput } from "./types";

function rect(x0: number, y0: number, x1: number, y1: number): MultiPolygon {
  return { type: "MultiPolygon", coordinates: [[[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]]] };
}

/**
 * A synthetic lot in planar feet for tests and demos (SPEC.md fixtures A and
 * B): `width` along a street to the south (y = 0), `depth` deep. By default it
 * is mid-block, with neighbors on both sides and behind; `streets` opens a
 * second street on the left (a corner lot) or behind (a through lot). The
 * mapped height district is passed in; this builder supplies no zoning values
 * of its own.
 */
export function syntheticLot(
  width: number,
  depth: number,
  heightDistrict: Omit<HeightZoneInput, "geometry" | "heightFt"> & { heightFt: number },
  { streets = "front" }: { streets?: "front" | "front_and_left" | "front_and_rear" } = {},
): ParcelInput {
  const footprint = rect(0, 0, width, depth);
  const left = rect(-width, 0, 0, depth);
  const right = rect(width, 0, 2 * width, depth);
  const behind = rect(streets === "front_and_left" ? 0 : -width, depth, 2 * width, 2 * depth);
  const neighbors = streets === "front_and_left" ? [right, behind] : streets === "front_and_rear" ? [left, right] : [left, right, behind];
  return {
    id: `synthetic-${width}x${depth}${streets === "front" ? "" : `-${streets}`}`,
    projection: null,
    footprint,
    neighbors,
    heightZones: [{ ...heightDistrict, geometry: footprint }],
  };
}
