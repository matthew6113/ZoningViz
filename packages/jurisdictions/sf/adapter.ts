import type { MultiPolygon, Polygon } from "geojson";
import { multiPolygonArea, projectMultiPolygon } from "@zoningviz/engine";
import polygonClipping, { type MultiPolygon as ClipMultiPolygon } from "polygon-clipping";
import {
  bboxWkt,
  DATASETS,
  EPSG_2227,
  fetchJson as defaultFetchJson,
  metadataUrl,
  multiPolygonWkt,
  pointWkt,
  soqlString,
  soqlUrl,
  type FetchJson,
} from "./datasf";
import { parseHeightLabel } from "./heightLabel";
import type { SfAddress, SfHeightDistrict, SfNeighbor, SfParcel, SfZoning } from "./types";

/** Raw row from acdm-wktn (Socrata serves numbers as strings). */
interface ParcelRow {
  blklot: string;
  mapblklot: string;
  from_address_num?: string;
  to_address_num?: string;
  street_name?: string;
  street_type?: string;
  zoning_code?: string;
  zoning_district?: string;
  active: boolean;
  shape?: MultiPolygon | Polygon;
  centroid_latitude?: string;
  centroid_longitude?: string;
  data_as_of?: string;
}

interface HeightRow {
  height: string;
  gen_hght?: string;
  the_geom?: MultiPolygon | Polygon;
}

// Socrata rejects URLs somewhere between ~9 KB and ~18 KB (HTTP 414). Above this
// many WKT characters the height lookup sends the parcel's bounding box instead,
// which can only find extra districts; the overlap check then discards them.
const MAX_WKT_CHARS = 6000;

// Districts covering less than this fraction of the lot are treated as boundary
// contact (shared edges, digitizing slivers). A data-cleaning tolerance, not a zoning value.
const MIN_DISTRICT_SHARE = 0.001;

const BLKLOT_PATTERN = /^\d{4}[A-Z]?\d{3}[A-Z]?$/;

// Neighbors are fetched from the lot's bounding box grown by about this much.
const NEIGHBOR_PAD_FT = 50;
const FT_PER_DEGREE_LAT = 364_000;

export interface SfAdapter {
  getParcelByBlockLot(blklot: string): Promise<SfParcel | null>;
  getParcelAt(lon: number, lat: number): Promise<SfParcel | null>;
  /** Active land parcels within about 50 ft of the lot (condo units collapsed to their land record). */
  getNeighbors(parcel: SfParcel): Promise<SfNeighbor[]>;
}

export function createSfAdapter(options: { fetchJson?: FetchJson } = {}): SfAdapter {
  const get = options.fetchJson ?? defaultFetchJson;
  const rows = async <T>(url: string) => (await get(url)) as T[];

  async function getParcelByBlockLot(input: string): Promise<SfParcel | null> {
    const blklot = normalizeBlklot(input);
    const records = await rows<ParcelRow>(soqlUrl(DATASETS.parcels, { where: `blklot=${soqlString(blklot)}` }));
    const record = preferActive(records);
    if (!record) return null;

    const warnings: string[] = [];
    let land = record;
    if (record.blklot !== record.mapblklot) {
      const parents = await rows<ParcelRow>(
        soqlUrl(DATASETS.parcels, { where: `blklot=${soqlString(record.mapblklot)}` }),
      );
      const parent = preferActive(parents);
      if (parent) {
        land = parent;
        warnings.push(`Block/lot ${blklot} is a unit record; showing its land parcel ${parent.blklot}.`);
      } else {
        warnings.push(`No land record found for mapblklot ${record.mapblklot}; using unit record ${blklot}.`);
      }
    }
    return describe(land, blklot === land.blklot ? null : blklot, warnings);
  }

  async function getParcelAt(lon: number, lat: number): Promise<SfParcel | null> {
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) throw new Error(`Invalid coordinates: ${lon}, ${lat}`);
    // Condo stacks put hundreds of records on one footprint, so group by mapblklot.
    const stacks = await rows<{ mapblklot: string }>(
      soqlUrl(DATASETS.parcels, {
        select: "mapblklot",
        where: `active=true AND intersects(shape,${soqlString(pointWkt(lon, lat))})`,
        group: "mapblklot",
        order: "mapblklot",
      }),
    );
    const first = stacks[0];
    if (!first) return null;
    const parcel = await getParcelByBlockLot(first.mapblklot);
    if (parcel && stacks.length > 1) {
      parcel.warnings.push(
        `Point falls on ${stacks.length} overlapping parcels (${stacks.map((s) => s.mapblklot).join(", ")}); showing ${first.mapblklot}.`,
      );
    }
    return parcel;
  }

  async function describe(land: ParcelRow, requestedBlklot: string | null, warnings: string[]): Promise<SfParcel> {
    if (!land.shape) throw new Error(`Parcel ${land.blklot} has no geometry`);
    const geometry = asMultiPolygon(land.shape);
    const planar = projectMultiPolygon(geometry, EPSG_2227);
    const lotAreaSqFt = multiPolygonArea(planar);
    const centroid = {
      lon: Number(land.centroid_longitude),
      lat: Number(land.centroid_latitude),
    };

    if (!land.active) warnings.push(`Parcel ${land.blklot} is retired (not an active record).`);

    const [unitBlklots, zoning, heights, heightAsOf] = await Promise.all([
      unitsOf(land),
      zoningOf(land, centroid, warnings),
      heightDistrictsOf(geometry, lotAreaSqFt),
      datasetAsOf(DATASETS.heightBulkDistricts),
    ]);
    warnings.push(...heights.warnings);

    return {
      blklot: land.blklot,
      mapblklot: land.mapblklot,
      unitBlklots,
      requestedBlklot,
      active: land.active,
      address: addressOf(land),
      zoning,
      heightDistricts: heights.districts,
      geometry,
      centroid,
      lotAreaSqFt,
      asOf: { parcels: land.data_as_of?.slice(0, 10) ?? null, heightDistricts: heightAsOf },
      warnings,
    };
  }

  async function unitsOf(land: ParcelRow): Promise<string[]> {
    const units = await rows<{ blklot: string }>(
      soqlUrl(DATASETS.parcels, {
        select: "blklot",
        where: `mapblklot=${soqlString(land.mapblklot)} AND active=true AND blklot!=${soqlString(land.blklot)}`,
        order: "blklot",
        limit: 50000,
      }),
    );
    return units.map((u) => u.blklot);
  }

  async function zoningOf(
    land: ParcelRow,
    centroid: { lon: number; lat: number },
    warnings: string[],
  ): Promise<SfZoning> {
    if (land.zoning_code?.trim()) {
      return { code: land.zoning_code.trim(), name: land.zoning_district?.trim() || null, source: "parcel" };
    }
    const hits = await rows<{ zoning?: string; districtna?: string }>(
      soqlUrl(DATASETS.zoningDistricts, {
        select: "zoning,districtna",
        where: `intersects(the_geom,${soqlString(pointWkt(centroid.lon, centroid.lat))})`,
      }),
    );
    const hit = hits[0];
    warnings.push(
      hit
        ? "Parcel record has no zoning code; zoning taken from the Zoning Districts layer at the lot centroid."
        : "Parcel record has no zoning code and the Zoning Districts layer has none at the lot centroid.",
    );
    return { code: hit?.zoning?.trim() || null, name: hit?.districtna?.trim() || null, source: "zoning-layer" };
  }

  async function heightDistrictsOf(
    geometry: MultiPolygon,
    lotAreaSqFt: number,
  ): Promise<{ districts: SfHeightDistrict[]; warnings: string[] }> {
    const warnings: string[] = [];
    let wkt = multiPolygonWkt(geometry);
    const usedBbox = wkt.length > MAX_WKT_CHARS;
    if (usedBbox) wkt = bboxWkt(geometry);
    const where = `intersects(the_geom,${soqlString(wkt)})`;

    const labels = await rows<HeightRow>(soqlUrl(DATASETS.heightBulkDistricts, { select: "height,gen_hght", where }));
    const distinct = new Map(labels.map((row) => [row.height, row]));

    if (distinct.size === 0) {
      warnings.push("No height and bulk district found for this lot.");
      return { districts: [], warnings };
    }
    if (distinct.size === 1 && !usedBbox) {
      const [row] = distinct.values();
      const district = toDistrict(row!, 1, geometry);
      return { districts: [district], warnings: labelWarnings([district]) };
    }

    // More than one candidate: download the district shapes and clip each to the lot.
    const shaped = await rows<HeightRow>(
      soqlUrl(DATASETS.heightBulkDistricts, { select: "height,gen_hght,the_geom", where }),
    );
    const piecesByLabel = new Map<string, { row: HeightRow; pieces: ClipMultiPolygon[]; failed: boolean }>();
    for (const row of shaped) {
      if (!row.the_geom) continue;
      const entry = piecesByLabel.get(row.height) ?? { row, pieces: [], failed: false };
      try {
        entry.pieces.push(polygonClipping.intersection(clipCoords(geometry), clipCoords(row.the_geom)));
      } catch {
        entry.failed = true;
      }
      piecesByLabel.set(row.height, entry);
    }

    const districts: SfHeightDistrict[] = [];
    for (const [label, { row, pieces, failed }] of piecesByLabel) {
      const [first, ...rest] = pieces;
      const piece: MultiPolygon | null =
        failed || !first ? null : { type: "MultiPolygon", coordinates: rest.length ? polygonClipping.union(first, ...rest) : first };
      const share = piece ? multiPolygonArea(projectMultiPolygon(piece, EPSG_2227)) / lotAreaSqFt : null;
      if (share !== null && share < MIN_DISTRICT_SHARE) {
        warnings.push(`Ignored height district ${label}: it only touches the lot boundary.`);
        continue;
      }
      if (share === null) warnings.push(`Could not measure how much of the lot lies in height district ${label}.`);
      districts.push(toDistrict(row, share, piece));
    }
    districts.sort((a, b) => (b.shareOfLot ?? 0) - (a.shareOfLot ?? 0));
    // A lone survivor (the others only touched the boundary) governs the whole lot.
    if (districts.length === 1) districts[0]!.geometry = geometry;

    if (districts.length > 1) {
      const parts = districts.map((d) => `${d.label} (${formatShare(d.shareOfLot)})`).join(", ");
      warnings.push(`Lot spans ${districts.length} height districts: ${parts}.`);
    }
    const covered = districts.reduce((sum, d) => sum + (d.shareOfLot ?? 0), 0);
    if (districts.every((d) => d.shareOfLot !== null) && covered < 1 - MIN_DISTRICT_SHARE * 10) {
      warnings.push(`Only ${formatShare(covered)} of the lot lies inside a mapped height district.`);
    }
    return { districts, warnings: [...warnings, ...labelWarnings(districts)] };
  }

  async function getNeighbors(parcel: SfParcel): Promise<SfNeighbor[]> {
    const padLat = NEIGHBOR_PAD_FT / FT_PER_DEGREE_LAT;
    const padLon = padLat / Math.cos((parcel.centroid.lat * Math.PI) / 180);
    const points = parcel.geometry.coordinates.flat(2);
    const xs = points.map((p) => p[0]!);
    const ys = points.map((p) => p[1]!);
    const box = bboxWkt({
      type: "Polygon",
      coordinates: [[
        [Math.min(...xs) - padLon, Math.min(...ys) - padLat],
        [Math.max(...xs) + padLon, Math.max(...ys) + padLat],
      ]],
    });
    const found = await rows<ParcelRow>(
      soqlUrl(DATASETS.parcels, {
        select: "blklot,shape",
        where: `active=true AND blklot=mapblklot AND mapblklot!=${soqlString(parcel.mapblklot)} AND intersects(shape,${soqlString(box)})`,
        order: "blklot",
        limit: 2000,
      }),
    );
    return found.flatMap((row) => (row.shape ? [{ blklot: row.blklot, geometry: asMultiPolygon(row.shape) }] : []));
  }

  const asOfCache = new Map<string, Promise<string | null>>();
  function datasetAsOf(dataset: (typeof DATASETS)[keyof typeof DATASETS]): Promise<string | null> {
    let pending = asOfCache.get(dataset);
    if (!pending) {
      pending = get(metadataUrl(dataset)).then((meta) => {
        const seconds = (meta as { rowsUpdatedAt?: number }).rowsUpdatedAt;
        return typeof seconds === "number" ? new Date(seconds * 1000).toISOString().slice(0, 10) : null;
      });
      asOfCache.set(dataset, pending);
    }
    return pending;
  }

  return { getParcelByBlockLot, getParcelAt, getNeighbors };
}

export function normalizeBlklot(input: string): string {
  const blklot = input.trim().toUpperCase();
  if (!BLKLOT_PATTERN.test(blklot)) {
    throw new Error(`"${input}" is not a block/lot number (expected e.g. 0044030 or 0792T001A)`);
  }
  return blklot;
}

function preferActive(records: ParcelRow[]): ParcelRow | undefined {
  return records.find((r) => r.active) ?? records[0];
}

function clipCoords(shape: MultiPolygon | Polygon): ClipMultiPolygon {
  return asMultiPolygon(shape).coordinates as unknown as ClipMultiPolygon;
}

function asMultiPolygon(shape: MultiPolygon | Polygon): MultiPolygon {
  return shape.type === "MultiPolygon" ? shape : { type: "MultiPolygon", coordinates: [shape.coordinates] };
}

function toDistrict(row: HeightRow, shareOfLot: number | null, geometry: MultiPolygon | null): SfHeightDistrict {
  const gen = row.gen_hght === undefined ? null : Number(row.gen_hght);
  return {
    label: row.height,
    genHeightFt: gen !== null && Number.isFinite(gen) ? gen : null,
    parsed: parseHeightLabel(row.height),
    shareOfLot,
    geometry,
  };
}

function labelWarnings(districts: SfHeightDistrict[]): string[] {
  return districts.flatMap((d): string[] => {
    if (d.parsed.kind === "r4") {
      const { baseHeightFt: base, localProgramHeightFt: local } = d.parsed;
      return [
        base === local
          ? `Family Zoning Plan R-4 district ${d.label}: base and local program heights are both ${base} ft.`
          : `Family Zoning Plan R-4 district ${d.label}: base height ${base} ft; ${local} ft only through the Housing Choice SF local program.`,
      ];
    }
    if (d.parsed.kind === "unparsed") {
      return [`Height label "${d.label}" not modeled (${d.parsed.reason}); check the height limit manually.`];
    }
    return [];
  });
}

function addressOf(row: ParcelRow): SfAddress {
  const from = cleanNumber(row.from_address_num);
  const to = cleanNumber(row.to_address_num);
  // About 1,400 active records carry the literal street name "UNKNOWN".
  const rawStreet = row.street_name?.trim();
  const street = rawStreet && rawStreet.toUpperCase() !== "UNKNOWN" ? rawStreet : null;
  const streetType = row.street_type?.trim() || null;
  let label: string | null = null;
  if (street) {
    const numbers = from && to && from !== to ? `${from}–${to}` : (from ?? to);
    label = [numbers, titleCase(street), streetType && titleCase(streetType)].filter(Boolean).join(" ");
  }
  return { from, to, street, streetType, label };
}

function cleanNumber(value: string | undefined): string | null {
  const text = value?.trim();
  return text && text !== "0" ? text : null;
}

function titleCase(text: string): string {
  return text.toLowerCase().replace(/(^|[\s\-'])([a-z])/g, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

function formatShare(share: number | null): string {
  return share === null ? "unknown share" : `${(share * 100).toFixed(1)}%`;
}
