import type { MultiPolygon, Polygon, Position } from "geojson";
import proj4 from "proj4";

/** A planar point in the projection's units (feet for SF's EPSG:2227). */
export type XY = [number, number];
/** A closed or open ring of planar points. */
export type Ring = XY[];
/** Outer ring first, then holes — same layout as GeoJSON. */
export type PlanarPolygon = Ring[];
export type PlanarMultiPolygon = PlanarPolygon[];

/**
 * Returns a lon/lat → planar converter for a proj4 definition string. The
 * jurisdiction supplies the definition (e.g. EPSG:2227 for San Francisco), so
 * the engine stays city-agnostic.
 */
export function createProjector(projDef: string): (lonLat: Position) => XY {
  const converter = proj4("EPSG:4326", projDef);
  return (lonLat) => {
    const [x, y] = converter.forward([lonLat[0]!, lonLat[1]!]);
    return [x!, y!];
  };
}

export function projectMultiPolygon(geometry: MultiPolygon | Polygon, projDef: string): PlanarMultiPolygon {
  const project = createProjector(projDef);
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  return polygons.map((polygon) => polygon.map((ring) => ring.map(project)));
}

/** Signed shoelace area: positive for counter-clockwise rings. */
export function signedRingArea(ring: Ring): number {
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i]!;
    const [x2, y2] = ring[(i + 1) % ring.length]!;
    sum += x1 * y2 - x2 * y1;
  }
  return sum / 2;
}

/** Area of a polygon: outer ring minus holes, independent of winding order. */
export function polygonArea(polygon: PlanarPolygon): number {
  const [outer, ...holes] = polygon;
  if (!outer) return 0;
  return holes.reduce((area, hole) => area - Math.abs(signedRingArea(hole)), Math.abs(signedRingArea(outer)));
}

export function multiPolygonArea(multi: PlanarMultiPolygon): number {
  return multi.reduce((area, polygon) => area + polygonArea(polygon), 0);
}
