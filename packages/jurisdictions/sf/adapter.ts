import type { MultiPolygon, Polygon } from "geojson";
import { multiPolygonArea, projectMultiPolygon, type TerrainInput } from "@zoningviz/engine";
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
import type { SfAddressMatch, SfBuildings, SfHeightDistrict, SfNeighbor, SfParcel, SfZoning } from "./types";
import { addressOf, displayAddress, normalizeAddressQuery } from "./address";
import { getTerrain } from "./terrain";
import { zoningCodes } from "./zoning";

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

// Most ids are block + lot ("4025007", "0792T001A"), but about 140 land records
// use other ids: common areas ("5335ACOMH"), open space ("4991OS1"), vacated
// streets ("VACST22S"). Letters, digits and "*" only, so a value is always safe in SoQL.
const BLKLOT_PATTERN = /^[0-9A-Z*]{4,12}$/;

// Neighbors (for front detection) and buildings (for scene context) are fetched
// from the lot's bounding box grown by about this much.
const NEIGHBOR_PAD_FT = 50;
const BUILDING_PAD_FT = 150;
const FT_PER_DEGREE_LAT = 364_000;
const FT_PER_METER = 3.28084;

export interface SfAdapter {
  getParcelByBlockLot(blklot: string): Promise<SfParcel | null>;
  getParcelAt(lon: number, lat: number): Promise<SfParcel | null>;
  /** Active land parcels within about 50 ft of the lot (condo units collapsed to their land record). */
  getNeighbors(parcel: SfParcel): Promise<SfNeighbor[]>;
  /** Buildings within `padFt` of the lot, minus any standing on the lot itself. */
  getBuildings(parcel: SfParcel, padFt?: number): Promise<SfBuildings>;
  /** Street addresses starting with what was typed (house number first), from the city's address list. */
  searchAddresses(text: string, limit?: number): Promise<SfAddressMatch[]>;
  /** Ground elevations around the lot (USGS 3DEP), or null when they can't be loaded. */
  getTerrain(parcel: SfParcel): Promise<TerrainInput | null>;
}

export function createSfAdapter(options: { fetchJson?: FetchJson; terrainRetryDelaysMs?: number[] } = {}): SfAdapter {
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
      const codes = zoningCodes(land.zoning_code);
      return { code: codes.join("|"), codes, name: land.zoning_district?.trim() || null, source: "parcel" };
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
    const codes = zoningCodes(hit?.zoning);
    return { code: codes.join("|") || null, codes, name: hit?.districtna?.trim() || null, source: "zoning-layer" };
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
    const box = paddedBboxWkt(parcel, NEIGHBOR_PAD_FT);
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

  async function getBuildings(parcel: SfParcel, padFt = BUILDING_PAD_FT): Promise<SfBuildings> {
    const found = await rows<{ sf16_bldgid: string; mblr?: string; hgt_median_m?: string; shape?: MultiPolygon | Polygon; data_as_of?: string }>(
      soqlUrl(DATASETS.buildingFootprints, {
        select: "sf16_bldgid,mblr,hgt_median_m,shape,data_as_of",
        where: `intersects(shape,${soqlString(paddedBboxWkt(parcel, padFt))})`,
        limit: 5000,
      }),
    );
    const buildings = found.flatMap((row) => {
      if (!row.shape) return [];
      const geometry = asMultiPolygon(row.shape);
      if (pointInGeometry(ringCentroid(geometry), parcel.geometry)) return []; // standing on the lot itself
      const meters = row.hgt_median_m === undefined ? NaN : Number(row.hgt_median_m);
      // mblr is "SF" + block/lot, e.g. "SF4025006A"; right-of-way records don't parse.
      const block = /^SF(\d{4}[A-Z]?)\d{3}[A-Z]?$/.exec(row.mblr ?? "")?.[1] ?? null;
      return [{ id: row.sf16_bldgid, block, heightFt: Number.isFinite(meters) ? meters * FT_PER_METER : null, geometry }];
    });
    const dates = found.map((row) => row.data_as_of?.slice(0, 10)).filter((d): d is string => !!d).sort();
    return { buildings, asOf: dates[dates.length - 1] ?? null };
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

  async function searchAddresses(text: string, limit = 8): Promise<SfAddressMatch[]> {
    const query = normalizeAddressQuery(text);
    if (query.length < 3 || !/^\d/.test(query)) return [];
    const hits = await rows<{ address?: string; parcel_number?: string; longitude?: string; latitude?: string }>(
      soqlUrl(DATASETS.addresses, {
        select: "address,parcel_number,longitude,latitude",
        // Unit rows ("227 BAY ST #208") repeat their building's address.
        where: `starts_with(address,${soqlString(query)}) AND unit_number IS NULL`,
        order: "address",
        limit: limit * 2,
      }),
    );
    const seen = new Set<string>();
    const matches: SfAddressMatch[] = [];
    for (const hit of hits) {
      const lon = Number(hit.longitude);
      const lat = Number(hit.latitude);
      if (!hit.address || !Number.isFinite(lon) || !Number.isFinite(lat)) continue;
      const blklot = hit.parcel_number?.trim() || null;
      const key = `${hit.address}|${blklot}`;
      if (seen.has(key)) continue;
      seen.add(key);
      matches.push({ label: displayAddress(hit.address), blklot, lon, lat });
    }
    return matches.slice(0, limit);
  }

  return {
    getParcelByBlockLot,
    getParcelAt,
    getNeighbors,
    getBuildings,
    searchAddresses,
    getTerrain: (parcel) => getTerrain(get, parcel, options.terrainRetryDelaysMs),
  };
}

function paddedBboxWkt(parcel: SfParcel, padFt: number): string {
  const padLat = padFt / FT_PER_DEGREE_LAT;
  const padLon = padLat / Math.cos((parcel.centroid.lat * Math.PI) / 180);
  const points = parcel.geometry.coordinates.flat(2);
  const xs = points.map((p) => p[0]!);
  const ys = points.map((p) => p[1]!);
  return bboxWkt({
    type: "Polygon",
    coordinates: [[
      [Math.min(...xs) - padLon, Math.min(...ys) - padLat],
      [Math.max(...xs) + padLon, Math.max(...ys) + padLat],
    ]],
  });
}

/** Vertex average of the first outer ring: good enough to tell which lot a building stands on. */
function ringCentroid(geometry: MultiPolygon): [number, number] {
  const ring = geometry.coordinates[0]![0]!.slice(0, -1);
  let x = 0;
  let y = 0;
  for (const p of ring) {
    x += p[0]!;
    y += p[1]!;
  }
  return [x / ring.length, y / ring.length];
}

function pointInGeometry([px, py]: [number, number], geometry: MultiPolygon): boolean {
  let inside = false;
  for (const polygon of geometry.coordinates) {
    for (const ring of polygon) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i]!;
        const [xj, yj] = ring[j]!;
        if (yi! > py !== yj! > py && px < ((xj! - xi!) * (py - yi!)) / (yj! - yi!) + xi!) inside = !inside;
      }
    }
  }
  return inside;
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
          ? `Family Zoning Plan R-4 district ${d.label}: ${base} ft with or without Housing Choice-SF; see its card for what else the program changes.`
          : `Family Zoning Plan R-4 district ${d.label}: base height ${base} ft; ${local} ft under Housing Choice-SF, which its card can switch on.`,
      ];
    }
    if (d.parsed.kind === "unparsed") {
      return [`Height label "${d.label}" not modeled (${d.parsed.reason}); check the height limit manually.`];
    }
    return [];
  });
}


function formatShare(share: number | null): string {
  return share === null ? "unknown share" : `${(share * 100).toFixed(1)}%`;
}
