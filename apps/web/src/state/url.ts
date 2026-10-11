// Every view state lives in the URL, so a link reopens the same lot at the same step:
//   ?parcel=4025007&step=4&front=1&setback=0&off=rear-yard&at=-122.40779,37.76102,18
// `at` is the map view (longitude, latitude, zoom); it is kept while a lot is open
// so going back returns to the same spot on the map.
export interface MapView {
  lon: number;
  lat: number;
  zoom: number;
}

export interface UrlState {
  /** A block/lot number, or a synthetic fixture id such as "fixture-a". */
  parcel: string | null;
  step: number | null;
  /** Which street side is the front, for lots with more than one. */
  front: number | null;
  /** The user's front setback, in feet. */
  setback: number | null;
  /** Rules switched off to see what they cost. */
  off: string[];
  at: MapView | null;
}

export const EMPTY_URL_STATE: UrlState = { parcel: null, step: null, front: null, setback: null, off: [], at: null };

/** Patch that closes the lot and returns to the map (the map view is kept). */
export const CLOSE_LOT: Partial<UrlState> = { parcel: null, step: null, front: null, setback: null, off: [] };

export function parseUrlState(search: string): UrlState {
  const params = new URLSearchParams(search);
  const parcel = params.get("parcel")?.trim() || null;
  return {
    parcel,
    step: wholeNumber(params.get("step")),
    front: wholeNumber(params.get("front")),
    setback: nonNegative(params.get("setback")),
    off: (params.get("off") ?? "").split(",").map((id) => id.trim()).filter((id) => /^[a-z0-9-]+$/.test(id)),
    at: mapView(params.get("at")),
  };
}

export function toSearch(state: UrlState): string {
  const params = new URLSearchParams();
  if (state.parcel) params.set("parcel", state.parcel);
  if (state.step !== null) params.set("step", String(state.step));
  if (state.front !== null) params.set("front", String(state.front));
  if (state.setback !== null) params.set("setback", String(state.setback));
  if (state.off.length) params.set("off", state.off.join(","));
  if (state.at) params.set("at", [state.at.lon.toFixed(5), state.at.lat.toFixed(5), state.at.zoom.toFixed(2)].join(","));
  // Commas are safe in a query string; keep them readable.
  const text = params.toString().replace(/%2C/g, ",");
  return text ? `?${text}` : "";
}

function mapView(value: string | null): MapView | null {
  const parts = (value ?? "").split(",").map(Number);
  if (parts.length !== 3 || !parts.every(Number.isFinite)) return null;
  const [lon, lat, zoom] = parts as [number, number, number];
  if (Math.abs(lon) > 180 || Math.abs(lat) > 85 || zoom < 0 || zoom > 24) return null;
  return { lon, lat, zoom };
}

function wholeNumber(value: string | null): number | null {
  if (value === null || !/^\d+$/.test(value)) return null;
  return Number(value);
}

function nonNegative(value: string | null): number | null {
  if (value === null || value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
