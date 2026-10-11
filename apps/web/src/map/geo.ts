// Small pure helpers for the map screen (no MapLibre import, so they test in Node).

const METERS_PER_FOOT = 0.3048;
const EARTH_CIRCUMFERENCE_M = 40_075_016.686;

/** Ground feet per screen pixel at a latitude and MapLibre zoom (zoom 0 is one 512 px tile). */
export function feetPerPixel(lat: number, zoom: number): number {
  return (Math.cos((lat * Math.PI) / 180) * EARTH_CIRCUMFERENCE_M) / (512 * 2 ** zoom) / METERS_PER_FOOT;
}

/** "4025/007", "4025 007", "4025-007" or "4025007" → "4025007"; anything else → null. */
export function parseBlockLot(text: string): string | null {
  const compact = text.trim().toUpperCase().replace(/[\s/-]+/g, "");
  return /^\d{4}[A-Z]?\d{3}[A-Z]?$/.test(compact) ? compact : null;
}
