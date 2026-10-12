import { projectMultiPolygon, type HeightGrid, type TerrainInput } from "@zoningviz/engine";
import { EPSG_2227, type FetchJson } from "./datasf";
import type { SfParcel } from "./types";

// Ground elevations from USGS 3DEP (1 m bare-earth LiDAR; for San Francisco the
// "CA_SanFrancisco_B23" survey). The service takes EPSG:2227 points directly,
// answers CORS, and returns at most 1,000 samples per request, in meters.

export const ELEVATION_SERVICE = "https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer";
const MAX_POINTS = 1000;
const US_SURVEY_FEET_PER_METER = 3937 / 1200;

/** Grid over the lot used to measure it, and the wider one used to draw the neighborhood. */
const FINE = { padFt: 10, minSpacingFt: 3 };
const CONTEXT = { padFt: 150, minSpacingFt: 10 };

export type Bbox = [number, number, number, number];

/** A grid covering `bbox` grown by `padFt`, as fine as `minSpacingFt` allows within the point limit. */
export function gridOver(bbox: Bbox, padFt: number, minSpacingFt: number, maxPoints = MAX_POINTS): Omit<HeightGrid, "elevationsFt"> {
  // Whole hundredths of a foot, so the grid's own coordinates match the points sent (see gridPoints).
  const [minX, minY, maxX, maxY] = [round2(bbox[0] - padFt), round2(bbox[1] - padFt), bbox[2] + padFt, bbox[3] + padFt];
  const width = maxX - minX;
  const height = maxY - minY;
  let spacingFt = Math.max(minSpacingFt, Math.ceil(Math.sqrt((width * height) / maxPoints) * 2) / 2);
  const size = () => [Math.ceil(width / spacingFt) + 1, Math.ceil(height / spacingFt) + 1] as const;
  while (size()[0] * size()[1] > maxPoints) spacingFt += 0.5;
  const [nx, ny] = size();
  return { x0: minX, y0: minY, spacingFt, nx, ny };
}

/** Grid node coordinates, row by row, rounded to 0.01 ft so requests (and their cache keys) are stable. */
export function gridPoints(grid: Omit<HeightGrid, "elevationsFt">): [number, number][] {
  const points: [number, number][] = [];
  for (let j = 0; j < grid.ny; j++) {
    for (let i = 0; i < grid.nx; i++) {
      points.push([round2(grid.x0 + i * grid.spacingFt), round2(grid.y0 + j * grid.spacingFt)]);
    }
  }
  return points;
}

/** The form body for a getSamples request in EPSG:2227. */
export function samplesBody(points: [number, number][]): string {
  return new URLSearchParams({
    geometry: JSON.stringify({ points, spatialReference: { wkid: 2227 } }),
    geometryType: "esriGeometryMultipoint",
    returnFirstValueOnly: "true",
    f: "json",
  }).toString();
}

interface SamplesResponse {
  samples?: { locationId: number; value: string; rasterId?: number }[];
  error?: { message?: string };
}

/** Meters → US survey feet; NoData holes are filled from their nearest valid neighbors. */
export function toElevations(response: SamplesResponse, grid: Omit<HeightGrid, "elevationsFt">): { elevationsFt: number[]; rasterIds: number[] } {
  if (!response.samples) throw new Error(`Elevation service error: ${response.error?.message ?? "no samples"}`);
  const count = grid.nx * grid.ny;
  const values: (number | null)[] = new Array(count).fill(null);
  const rasterIds: number[] = [];
  for (const sample of response.samples) {
    const meters = Number(sample.value);
    if (sample.locationId >= 0 && sample.locationId < count && Number.isFinite(meters)) {
      values[sample.locationId] = meters * US_SURVEY_FEET_PER_METER;
    }
    if (sample.rasterId !== undefined) rasterIds.push(sample.rasterId);
  }
  if (values.every((v) => v === null)) throw new Error("Elevation service returned no data for this lot");
  // Fill holes ring by ring from the nearest filled cells.
  let missing = values.some((v) => v === null);
  while (missing) {
    missing = false;
    const next = [...values];
    for (let j = 0; j < grid.ny; j++) {
      for (let i = 0; i < grid.nx; i++) {
        const k = j * grid.nx + i;
        if (values[k] !== null) continue;
        const around = [
          [i - 1, j],
          [i + 1, j],
          [i, j - 1],
          [i, j + 1],
        ]
          .filter(([a, b]) => a! >= 0 && b! >= 0 && a! < grid.nx && b! < grid.ny)
          .map(([a, b]) => values[b! * grid.nx + a!])
          .filter((v): v is number => v !== null);
        if (around.length) next[k] = around.reduce((sum, v) => sum + v, 0) / around.length;
        else missing = true;
      }
    }
    values.splice(0, values.length, ...next);
  }
  return { elevationsFt: values as number[], rasterIds };
}

async function fetchGrid(fetchJson: FetchJson, spec: Omit<HeightGrid, "elevationsFt">) {
  const response = (await fetchJson(`${ELEVATION_SERVICE}/getSamples`, samplesBody(gridPoints(spec)))) as SamplesResponse;
  const { elevationsFt, rasterIds } = toElevations(response, spec);
  return { grid: { ...spec, elevationsFt }, rasterIds };
}

/** The survey behind the most-used raster: its name and acquisition date. */
async function surveyOf(fetchJson: FetchJson, rasterIds: number[]): Promise<{ name: string | null; date: string | null }> {
  const counts = new Map<number, number>();
  for (const id of rasterIds) counts.set(id, (counts.get(id) ?? 0) + 1);
  const id = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (id === undefined) return { name: null, date: null };
  const params = new URLSearchParams({ objectIds: String(id), outFields: "Name,AcquisitionDate", returnGeometry: "false", f: "json" });
  const response = (await fetchJson(`${ELEVATION_SERVICE}/query?${params}`)) as {
    features?: { attributes?: { Name?: string; AcquisitionDate?: number } }[];
  };
  const attributes = response.features?.[0]?.attributes;
  const ms = attributes?.AcquisitionDate;
  return { name: attributes?.Name ?? null, date: typeof ms === "number" ? new Date(ms).toISOString().slice(0, 10) : null };
}

/**
 * Ground elevations around a parcel, in EPSG:2227 feet, for the engine.
 * Returns null when the service can't be reached: the lot is then treated as flat.
 */
export async function getTerrain(fetchJson: FetchJson, parcel: SfParcel): Promise<TerrainInput | null> {
  try {
    const points = projectMultiPolygon(parcel.geometry, EPSG_2227).flat(2);
    const xs = points.map((p) => p[0]);
    const ys = points.map((p) => p[1]);
    const bbox: Bbox = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    const [fine, context] = await Promise.all([
      fetchGrid(fetchJson, gridOver(bbox, FINE.padFt, FINE.minSpacingFt)),
      fetchGrid(fetchJson, gridOver(bbox, CONTEXT.padFt, CONTEXT.minSpacingFt)),
    ]);
    const survey = await surveyOf(fetchJson, fine.rasterIds).catch(() => ({ name: null, date: null }));
    return {
      fine: fine.grid,
      context: context.grid,
      source: `USGS 3DEP 1 m LiDAR${survey.name ? ` (${survey.name})` : ""}`,
      asOf: survey.date,
    };
  } catch {
    return null;
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
