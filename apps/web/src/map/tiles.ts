import { addProtocol, setWorkerUrl } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import { PMTiles, Protocol } from "pmtiles";

// Where the map's data comes from. The parcel tiles are one static PMTiles file
// built by `pnpm build-tiles`; the basemap is a keyless public style.

export const TILES_URL = new URL(import.meta.env.VITE_SF_TILES ?? "tiles/sf.pmtiles", document.baseURI).href;
export const BASEMAP_STYLE = import.meta.env.VITE_BASEMAP_STYLE ?? "https://tiles.openfreemap.org/styles/positron";

let protocol: Protocol | null = null;

/** Registers the pmtiles:// protocol and MapLibre's worker, once. */
export function setUpMapLibre(): Protocol {
  if (!protocol) {
    // Under Vite the worker must be pointed at explicitly; MapLibre can't find it after pre-bundling.
    setWorkerUrl(workerUrl);
    protocol = new Protocol();
    addProtocol("pmtiles", protocol.tile);
  }
  return protocol;
}

export type TilesStatus = { ok: true; attribution: string | null } | { ok: false; reason: string };

/**
 * Checks that the tiles file is really there (a dev server answers a missing
 * file with index.html) and reads its attribution, which carries the data dates.
 */
export async function checkTiles(): Promise<TilesStatus> {
  const archive = new PMTiles(TILES_URL);
  setUpMapLibre().add(archive);
  try {
    await archive.getHeader();
    const metadata = (await archive.getMetadata()) as { attribution?: string };
    return { ok: true, attribution: metadata.attribution ?? null };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
}
