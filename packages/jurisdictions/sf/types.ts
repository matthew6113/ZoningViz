import type { MultiPolygon } from "geojson";
import type { ParsedHeightLabel } from "./heightLabel";

export interface SfAddress {
  from: string | null;
  to: string | null;
  street: string | null;
  streetType: string | null;
  /** Display form, e.g. "766–772 Francisco St". Null when the record has no street. */
  label: string | null;
}

export interface SfZoning {
  /** The district code; a "|"-joined list when the lot is split between districts. */
  code: string | null;
  /** The distinct district codes on the lot (repeats such as "RH-2|RH-2" collapse to one). */
  codes: string[];
  name: string | null;
  /** "parcel" when read from the parcel record; "zoning-layer" when the record was blank. */
  source: "parcel" | "zoning-layer";
}

export interface SfHeightDistrict {
  /** Raw `height` label, e.g. "40-X" or "40//85-R-4". */
  label: string;
  /** Raw `gen_hght`. For R-4 rows this is the local program height, not the base. */
  genHeightFt: number | null;
  parsed: ParsedHeightLabel;
  /**
   * Fraction of the lot inside this district (0–1). 1 when it is the only
   * district touching the lot; null when the overlap could not be computed.
   */
  shareOfLot: number | null;
  /** The part of the lot inside this district (lon/lat); the whole lot when it is the only district. */
  geometry: MultiPolygon | null;
}

export interface SfParcel {
  /** The land record's block/lot. For condo stacks this equals `mapblklot`. */
  blklot: string;
  mapblklot: string;
  /** Other active records on the same footprint (condo units), sorted. */
  unitBlklots: string[];
  /** The blklot the caller asked for, when it differs from the land record. */
  requestedBlklot: string | null;
  active: boolean;
  address: SfAddress;
  zoning: SfZoning;
  heightDistricts: SfHeightDistrict[];
  /** WGS84 lon/lat, as served by DataSF. */
  geometry: MultiPolygon;
  centroid: { lon: number; lat: number };
  /** Planar area in EPSG:2227 square feet, holes subtracted. */
  lotAreaSqFt: number;
  /** ISO dates the source datasets were last updated. */
  asOf: { parcels: string | null; heightDistricts: string | null };
  warnings: string[];
}

export interface SfNeighbor {
  blklot: string;
  geometry: MultiPolygon;
}

export interface SfBuilding {
  id: string;
  /** Assessor block the building stands on (from `mblr`), or null for right-of-way records. */
  block: string | null;
  /** Median LiDAR height above ground (2010 survey), in feet. Null when the dataset has none. */
  heightFt: number | null;
  geometry: MultiPolygon;
}

export interface SfBuildings {
  buildings: SfBuilding[];
  /** The dataset's own as-of date (the LiDAR heights themselves date from 2010). */
  asOf: string | null;
}
