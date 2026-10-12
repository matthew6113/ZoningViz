// Builds the hosted demo: the web app with recorded city data for the example
// lots, the parcel tiles in 1 MB chunks (base64 text) and a plain basemap, for
// static hosts that serve whole files of web types only and let the page reach
// no other site.
//
//   pnpm build-demo [--no-cache]    → apps/web/dist-demo (needs pnpm build-tiles first)
//
// The demo opens the lots under "Try one" (apps/web/src/map/examples.ts); any
// other lot explains that it needs the full app.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { fetchLotData } from "../apps/web/src/data/lotData";
import { recordingPath, requestKey } from "../apps/web/src/demo/key";
import type { ChunkManifest } from "../apps/web/src/demo/tiles";
import { EXAMPLES } from "../apps/web/src/map/examples";
import { createSfAdapter } from "../packages/jurisdictions/sf/adapter";
import type { FetchJson } from "../packages/jurisdictions/sf/datasf";
import { parseCliArgs } from "../packages/jurisdictions/sf/node/args";
import { devFetchJson } from "../packages/jurisdictions/sf/node/cache";

const ROOT = resolve(import.meta.dirname, "..");
const WEB = join(ROOT, "apps", "web");
const OUT = join(WEB, "dist-demo");
const CITY_TILES = join(WEB, "public", "tiles", "sf.pmtiles");
const TILES_PATH = "tiles/sf.pmtiles";
const CHUNK_BYTES = 1 << 20;
// No basemap host is reachable, so the parcels draw over a plain ground and the streets show as the gaps between them.
const BASEMAP = {
  version: 8,
  name: "Demo basemap (background only)",
  sources: {},
  layers: [{ id: "background", type: "background", paint: { "background-color": "#e6e4dd" } }],
};

const args = parseCliArgs(process.argv.slice(2), ["--no-cache"], []);
if (!existsSync(CITY_TILES)) {
  console.error(`No city tiles at ${relative(ROOT, CITY_TILES)}: run pnpm build-tiles first.`);
  process.exit(1);
}

// 1. The app, with relative asset paths and the demo switches on.
execFileSync("pnpm", ["exec", "vite", "build", "--outDir", "dist-demo", "--emptyOutDir"], {
  cwd: WEB,
  stdio: "inherit",
  env: { ...process.env, VITE_DEMO: "1", VITE_SF_TILES: TILES_PATH, VITE_BASEMAP_STYLE: "demo/basemap.json" },
});

// 2. City data for the example lots: the same requests the lot view makes, recorded.
const fetchJson = devFetchJson({ noCache: args.flags.has("--no-cache") });
const recorded = new Map<string, unknown>();
const recording: FetchJson = async (url, body) => {
  const value = await fetchJson(url, body);
  recorded.set(await requestKey(url, body), value);
  return value;
};
const adapter = createSfAdapter({ fetchJson: recording });
for (const example of EXAMPLES) {
  if (!example.at) continue; // synthetic fixtures need no city data
  const data = await fetchLotData(adapter, example.id);
  if (!data) throw new Error(`${example.id} (${example.label}): no such parcel`);
  if (data.district && !data.terrain) throw new Error(`${example.id}: USGS elevations failed to load; run again`);
  console.log(`  recorded ${example.id} ${example.label}`);
}
await mkdir(join(OUT, "demo", "r"), { recursive: true });
for (const [key, value] of recorded) await writeFile(join(OUT, recordingPath(key)), JSON.stringify(value));
await writeFile(join(OUT, "demo", "basemap.json"), JSON.stringify(BASEMAP));

// 3. The city tiles in chunks (Vite copied the whole file from public/).
await rm(join(OUT, TILES_PATH), { force: true });
const tiles = await readFile(CITY_TILES);
const chunks: string[] = [];
for (let offset = 0, i = 0; offset < tiles.length; offset += CHUNK_BYTES, i++) {
  const name = `sf.pmtiles.${i}.txt`;
  await writeFile(join(OUT, "tiles", name), tiles.subarray(offset, offset + CHUNK_BYTES).toString("base64"));
  chunks.push(name);
}
const manifest: ChunkManifest = { size: tiles.length, chunkSize: CHUNK_BYTES, encoding: "base64", chunks };
await writeFile(join(OUT, `${TILES_PATH}.chunks.json`), JSON.stringify(manifest));

// 4. The page itself without its document skeleton (artifact hosts add their own).
const html = await readFile(join(OUT, "index.html"), "utf8");
const tags = [...html.matchAll(/<(title)>[^<]*<\/title>|<script[^>]*><\/script>|<link rel="(?:stylesheet|modulepreload)"[^>]*>/g)].map((m) => m[0]);
await writeFile(join(OUT, "index.html"), `${tags.join("\n")}\n<div id="root"></div>\n`);

const files = await listFiles(OUT);
let bytes = 0;
for (const file of files) bytes += (await stat(join(OUT, file))).size;
console.log(`\n${relative(ROOT, OUT)}: ${files.length} files, ${(bytes / 1e6).toFixed(1)} MB (${recorded.size} recorded requests, ${chunks.length} tile chunks)`);

async function listFiles(dir: string, prefix = ""): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...(await listFiles(join(dir, entry.name), path)));
    else out.push(path);
  }
  return out;
}
