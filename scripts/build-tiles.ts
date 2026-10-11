// Builds the map's vector tiles: San Francisco land parcels and zoning districts
// from DataSF, tiled by tippecanoe into one static PMTiles file.
//
//   pnpm build-tiles                      # whole city → apps/web/public/tiles/sf.pmtiles
//   pnpm build-tiles --fixture            # small area around the demo lots → the e2e fixture
//   pnpm build-tiles --bbox "minLon,minLat,maxLon,maxLat;..." --out path.pmtiles
//   pnpm build-tiles --no-cache           # refetch from DataSF
//
// Needs tippecanoe (https://github.com/felt/tippecanoe): `brew install tippecanoe`,
// or build it from source and point $TIPPECANOE at the binary.
import { spawnSync } from "node:child_process";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { DATASETS, metadataUrl, type DatasetId, type FetchJson } from "../packages/jurisdictions/sf/datasf";
import { parseCliArgs } from "../packages/jurisdictions/sf/node/args";
import { devFetchJson } from "../packages/jurisdictions/sf/node/cache";
import {
  parcelPageUrl,
  parseBoxes,
  TILE_LAYERS,
  toParcelFeature,
  toZoningFeature,
  zoningPageUrl,
  type Box,
  type ParcelTileRow,
  type ZoningTileRow,
} from "../packages/jurisdictions/sf/tiles";

const ROOT = resolve(import.meta.dirname, "..");
const CITY_OUT = join(ROOT, "apps", "web", "public", "tiles", "sf.pmtiles");
const FIXTURE_OUT = join(ROOT, "apps", "web", "e2e", "fixtures", "tiles", "sf.pmtiles");
const WORK = join(ROOT, ".cache", "tiles");
const PAGE_SIZE = 50_000;
const MIN_ZOOM = 12;
const MAX_ZOOM = 16;

// About 130 m around each demo lot the browser tests use (see apps/web/e2e).
const FIXTURE_CENTERS: [number, number][] = [
  [-122.40779, 37.76102], // 667 Hampshire St, RH-2 (and the corner lot next door)
  [-122.40674, 37.75021], // 1391 Hampshire St, two height districts
  [-122.41787, 37.80438], // 766–772 Francisco St, R-4 condo lot
  [-122.45195, 37.75864], // 124 Clarendon Ave, RH-1(D)
  [-122.46134, 37.77465], // 752 4th Ave, RH-1
  [-122.44576, 37.79064], // 2120 Lyon St, RH-3
];
const FIXTURE_BOXES: Box[] = FIXTURE_CENTERS.map(([lon, lat]) => [lon - 0.0015, lat - 0.0012, lon + 0.0015, lat + 0.0012]);

const args = parseCliArgs(process.argv.slice(2), ["--fixture", "--no-cache", "--help"], ["--out", "--bbox"]);
if (args.flags.has("--help")) {
  console.log(readmeLines().join("\n"));
  process.exit(0);
}
const fixture = args.flags.has("--fixture");
const boxes = args.values.has("--bbox") ? parseBoxes(args.values.get("--bbox")!) : fixture ? FIXTURE_BOXES : [];
const out = resolve(args.values.get("--out") ?? (fixture ? FIXTURE_OUT : CITY_OUT));
const fetchJson = devFetchJson({ noCache: args.flags.has("--no-cache") });

const tippecanoe = findTippecanoe();
if (!tippecanoe) {
  console.error(
    [
      "tippecanoe not found. Install it, then run this again:",
      "  macOS:  brew install tippecanoe",
      "  Linux:  git clone https://github.com/felt/tippecanoe && cd tippecanoe && make -j && sudo make install",
      "Or set TIPPECANOE=/path/to/tippecanoe.",
    ].join("\n"),
  );
  process.exit(1);
}

const started = Date.now();
await mkdir(WORK, { recursive: true });
const area = boxes.length ? `${boxes.length} box${boxes.length > 1 ? "es" : ""}` : "the whole city";
console.log(`Fetching parcels and zoning districts for ${area}…`);

const parcelsFile = join(WORK, fixture ? "parcels-fixture.ndjson" : "parcels.ndjson");
const zoningFile = join(WORK, fixture ? "zoning-fixture.ndjson" : "zoning.ndjson");
const [parcelCount, zoningCount, parcelsAsOf, zoningAsOf] = await Promise.all([
  writeLayer(parcelsFile, (offset) => parcelPageUrl(offset, PAGE_SIZE, boxes), (row: ParcelTileRow) => toParcelFeature(row)),
  writeLayer(zoningFile, (offset) => zoningPageUrl(offset, PAGE_SIZE, boxes), (row: ZoningTileRow) => toZoningFeature(row)),
  asOf(fetchJson, DATASETS.parcels),
  asOf(fetchJson, DATASETS.zoningDistricts),
]);
console.log(`  ${parcelCount.toLocaleString()} land parcels (as of ${parcelsAsOf ?? "unknown"})`);
console.log(`  ${zoningCount.toLocaleString()} zoning district polygons (as of ${zoningAsOf ?? "unknown"})`);

await mkdir(dirname(out), { recursive: true });
const result = spawnSync(
  tippecanoe,
  [
    "--output", out,
    "--force",
    "--quiet",
    `--minimum-zoom=${MIN_ZOOM}`,
    `--maximum-zoom=${MAX_ZOOM}`,
    // Every parcel at every zoom: a lot that drops out can't be clicked.
    "--no-tile-size-limit",
    "--no-feature-limit",
    "--read-parallel",
    "--name", "San Francisco parcels and zoning",
    "--attribution", `Parcels (${parcelsAsOf ?? "date unknown"}) and zoning (${zoningAsOf ?? "date unknown"}): DataSF`,
    "--description", `Land parcels (DataSF ${DATASETS.parcels}) and zoning districts (DataSF ${DATASETS.zoningDistricts}).`,
    "--named-layer", `${TILE_LAYERS.parcels}:${parcelsFile}`,
    "--named-layer", `${TILE_LAYERS.zoning}:${zoningFile}`,
  ],
  { stdio: "inherit" },
);
if (result.status !== 0) {
  console.error(`tippecanoe failed (exit ${result.status ?? result.signal})`);
  process.exit(1);
}
const { size } = await stat(out);
console.log(
  `Wrote ${relative(ROOT, out)}: ${(size / 1e6).toFixed(1)} MB, zoom ${MIN_ZOOM}–${MAX_ZOOM}, in ${((Date.now() - started) / 1000).toFixed(0)} s`,
);

// ---------- helpers ----------

/** Fetches every page of a layer and writes one GeoJSON feature per line. */
async function writeLayer<Row>(
  file: string,
  pageUrl: (offset: number) => string,
  toFeature: (row: Row) => object | null,
): Promise<number> {
  const lines: string[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const rows = (await fetchJson(pageUrl(offset))) as Row[];
    for (const row of rows) {
      const feature = toFeature(row);
      if (feature) lines.push(JSON.stringify(feature));
    }
    if (rows.length < PAGE_SIZE) break;
  }
  await writeFile(file, lines.join("\n") + "\n");
  return lines.length;
}

async function asOf(fetch: FetchJson, dataset: DatasetId): Promise<string | null> {
  const meta = (await fetch(metadataUrl(dataset))) as { rowsUpdatedAt?: number };
  return meta.rowsUpdatedAt ? new Date(meta.rowsUpdatedAt * 1000).toISOString().slice(0, 10) : null;
}

function findTippecanoe(): string | null {
  const candidate = process.env.TIPPECANOE || "tippecanoe";
  const probe = spawnSync(candidate, ["--version"], { encoding: "utf8" });
  return probe.status === 0 ? candidate : null;
}

function readmeLines(): string[] {
  return [
    "pnpm build-tiles [--fixture] [--bbox \"minLon,minLat,maxLon,maxLat;...\"] [--out file.pmtiles] [--no-cache]",
    `  default output: ${relative(ROOT, CITY_OUT)} (whole city)`,
    `  --fixture:      ${relative(ROOT, FIXTURE_OUT)} (demo lots only, for the browser tests)`,
  ];
}
