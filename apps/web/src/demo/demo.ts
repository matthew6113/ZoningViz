import { EXAMPLES } from "../map/examples";

// The hosted demo build (`pnpm build-demo`) runs where the page may not reach
// DataSF, USGS or the basemap: city data comes from recordings of the example
// lots, and the parcel tiles from chunks published next to the page.
export const DEMO = import.meta.env.VITE_DEMO === "1";

export const NOT_IN_DEMO =
  "This hosted demo carries recorded city data for the lots under “Try one” only. The full app (pnpm dev) looks up any lot live.";

const DEMO_LOTS = new Set(EXAMPLES.map((example) => example.id));

/** Whether this build can open the lot. */
export const canOpen = (blklot: string) => !DEMO || DEMO_LOTS.has(blklot);
