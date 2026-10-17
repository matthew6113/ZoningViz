import type { Feature, MultiPolygon, Polygon } from "geojson";
import { addressOf, type ParcelAddressFields } from "./address";
import { DATASETS, soqlString, soqlUrl } from "./datasf";
import { resolveNamedDistrict, zoningCodes } from "./zoning";

// What goes into the map's vector tiles (scripts/build-tiles.ts), and the
// queries that fetch it. The app reads these property names, so they are the
// contract between the tiles and the map screen.

export const TILE_LAYERS = { parcels: "parcels", zoning: "zoning" } as const;

/** Properties on each parcel feature. */
export interface ParcelTileProps {
  /** The land record's block/lot (condo units are left out). */
  blklot: string;
  /**
   * zoning_code, "|"-joined when the lot is split between districts, with a named NC district's
   * generic code ("NCD", "NCT") replaced by its own ("NCD-NORTH BEACH"). Absent when blank.
   */
  zoning?: string;
  /** Display address, e.g. "667 Hampshire St". Absent when the record has no street. */
  address?: string;
}

/** Properties on each zoning district feature. */
export interface ZoningTileProps {
  zoning?: string;
  /** Broad category from the zoning layer: Residential, Mixed Use, Commercial, Public, Industrial. */
  gen?: string;
}

/** [minLon, minLat, maxLon, maxLat] */
export type Box = [number, number, number, number];

/** "-122.41,37.75,-122.40,37.77;..." → boxes. */
export function parseBoxes(text: string): Box[] {
  return text
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const n = part.split(",").map(Number);
      if (n.length !== 4 || n.some((v) => !Number.isFinite(v)) || n[0]! >= n[2]! || n[1]! >= n[3]!) {
        throw new Error(`Bad box "${part}": expected minLon,minLat,maxLon,maxLat`);
      }
      return n as Box;
    });
}

function boxesWhere(column: string, boxes: Box[]): string | null {
  if (!boxes.length) return null;
  const tests = boxes.map(
    ([x0, y0, x1, y1]) => `intersects(${column},${soqlString(`POLYGON((${x0} ${y0},${x1} ${y0},${x1} ${y1},${x0} ${y1},${x0} ${y0}))`)})`,
  );
  return tests.length === 1 ? tests[0]! : `(${tests.join(" OR ")})`;
}

/** One page of active land parcels (condo unit records share the land record's shape and are skipped). */
export function parcelPageUrl(offset: number, limit: number, boxes: Box[] = []): string {
  const where = ["active=true", "blklot=mapblklot", boxesWhere("shape", boxes)].filter(Boolean).join(" AND ");
  return soqlUrl(DATASETS.parcels, {
    select: "mapblklot,zoning_code,zoning_district,from_address_num,to_address_num,street_name,street_type,shape",
    where,
    order: "mapblklot",
    limit,
    offset,
  });
}

/** One page of zoning district polygons. */
export function zoningPageUrl(offset: number, limit: number, boxes: Box[] = []): string {
  const where = boxesWhere("the_geom", boxes);
  return soqlUrl(DATASETS.zoningDistricts, {
    select: "zoning,gen,the_geom",
    ...(where ? { where } : {}),
    order: ":id",
    limit,
    offset,
  });
}

export interface ParcelTileRow extends ParcelAddressFields {
  mapblklot?: string;
  zoning_code?: string;
  zoning_district?: string;
  shape?: MultiPolygon | Polygon;
}

/** `namedDistricts` comes from `namedDistrictIndex` (sf/zoning.ts). */
export function toParcelFeature(
  row: ParcelTileRow,
  namedDistricts: ReadonlyMap<string, string> = new Map(),
): Feature<MultiPolygon | Polygon, ParcelTileProps> | null {
  if (!row.mapblklot || !row.shape) return null;
  const properties: ParcelTileProps = { blklot: row.mapblklot };
  let codes = zoningCodes(row.zoning_code);
  if (codes.length === 1) codes = [resolveNamedDistrict(codes[0]!, row.zoning_district, namedDistricts)];
  if (codes.length) properties.zoning = codes.join("|");
  const address = addressOf(row).label;
  if (address) properties.address = address;
  return { type: "Feature", properties, geometry: row.shape };
}

export interface ZoningTileRow {
  zoning?: string;
  gen?: string;
  the_geom?: MultiPolygon | Polygon;
}

export function toZoningFeature(row: ZoningTileRow): Feature<MultiPolygon | Polygon, ZoningTileProps> | null {
  if (!row.the_geom) return null;
  const properties: ZoningTileProps = {};
  if (row.zoning?.trim()) properties.zoning = row.zoning.trim();
  if (row.gen?.trim()) properties.gen = row.gen.trim();
  return { type: "Feature", properties, geometry: row.the_geom };
}
