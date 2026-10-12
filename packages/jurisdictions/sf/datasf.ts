import type { MultiPolygon, Polygon } from "geojson";

// DataSF (Socrata) access: dataset IDs, SoQL URL building and fetching.
// data.sfgov.org moved to data.sf.gov; dataset IDs are unchanged.

export const DATASF_BASE = "https://data.sf.gov";

export const DATASETS = {
  parcels: "acdm-wktn",
  zoningDistricts: "3i4a-hu95",
  heightBulkDistricts: "h9wh-cg3m",
  /** Building outlines with LiDAR-derived heights (2010), for context around a lot. */
  buildingFootprints: "ynuv-fyni",
  /** The city's address list (Enterprise Addressing System), for address search. */
  addresses: "ramy-di5m",
} as const;

export type DatasetId = (typeof DATASETS)[keyof typeof DATASETS];

/** EPSG:2227, NAD83 / California State Plane Zone III, US survey feet (as PROJ expands it). */
export const EPSG_2227 =
  "+proj=lcc +lat_0=36.5 +lon_0=-120.5 +lat_1=38.4333333333333 +lat_2=37.0666666666667 " +
  "+x_0=2000000.0001016 +y_0=500000.0001016 +datum=NAD83 +units=us-ft +no_defs";

/**
 * Fetches a URL and returns parsed JSON; with `body`, POSTs it form-encoded.
 * Injectable so the CLI can cache and tests can replay.
 */
export type FetchJson = (url: string, body?: string) => Promise<unknown>;

export class DataSfError extends Error {
  constructor(
    message: string,
    readonly url: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "DataSfError";
  }
}

export const fetchJson: FetchJson = async (url, body) => {
  const response = await fetch(
    url,
    body === undefined
      ? { headers: { Accept: "application/json" } }
      : { method: "POST", body, headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" } },
  );
  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = (await response.json()) as { message?: string };
      if (body.message) detail = body.message;
    } catch {
      // keep statusText
    }
    throw new DataSfError(`Request to ${new URL(url).host} failed (${response.status}): ${detail}`, url, response.status);
  }
  return response.json();
};

/** Builds a SODA resource URL. Keys are SoQL clauses without the `$`, e.g. { where, select }. */
export function soqlUrl(dataset: DatasetId, clauses: Record<string, string | number>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(clauses)) params.set(`$${key}`, String(value));
  return `${DATASF_BASE}/resource/${dataset}.json?${params}`;
}

export function metadataUrl(dataset: DatasetId): string {
  return `${DATASF_BASE}/api/views/${dataset}.json`;
}

/** Quotes a value as a SoQL string literal. */
export function soqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

export function pointWkt(lon: number, lat: number): string {
  return `POINT(${lon} ${lat})`;
}

export function multiPolygonWkt(geometry: MultiPolygon | Polygon): string {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  const body = polygons
    .map((polygon) => `(${polygon.map((ring) => `(${ring.map(([x, y]) => `${x} ${y}`).join(",")})`).join(",")})`)
    .join(",");
  return `MULTIPOLYGON(${body})`;
}

export function bboxWkt(geometry: MultiPolygon | Polygon): string {
  const points = (geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates).flat(2);
  const xs = points.map((p) => p[0]!);
  const ys = points.map((p) => p[1]!);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  return `POLYGON((${minX} ${minY},${maxX} ${minY},${maxX} ${maxY},${minX} ${maxY},${minX} ${minY}))`;
}
