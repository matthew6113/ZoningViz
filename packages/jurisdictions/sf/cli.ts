// pnpm parcel <blklot> | --at <lon> <lat>   [--json] [--no-cache]
//
// Prints the facts for one San Francisco parcel. Responses are cached under
// .cache/datasf (override with ZONINGVIZ_CACHE_DIR; disable with --no-cache
// or ZONINGVIZ_NO_CACHE=1).
import { createSfAdapter } from "./adapter";
import { parseCliArgs } from "./node/args";
import { devFetchJson } from "./node/cache";
import type { SfHeightDistrict, SfParcel } from "./types";

const USAGE = "Usage: pnpm parcel <blklot> | pnpm parcel --at <lon> <lat>   [--json] [--no-cache]";

async function main(): Promise<number> {
  let args;
  try {
    args = parseCliArgs(process.argv.slice(2), ["--at", "--json", "--no-cache", "--help", "-h"]);
  } catch (error) {
    console.error(`${(error as Error).message}\n${USAGE}`);
    return 1;
  }
  const { flags, positionals } = args;
  const values = { at: flags.has("--at"), json: flags.has("--json"), noCache: flags.has("--no-cache") };
  const wantsHelp = flags.has("--help") || flags.has("-h");
  if (wantsHelp || positionals.length === 0) {
    console.log(USAGE);
    return wantsHelp ? 0 : 1;
  }

  const adapter = createSfAdapter({ fetchJson: devFetchJson({ noCache: values.noCache }) });

  let parcel: SfParcel | null;
  let query: string;
  if (values.at) {
    const [lon, lat] = positionals.map(Number);
    if (positionals.length !== 2 || !Number.isFinite(lon) || !Number.isFinite(lat)) {
      console.error(USAGE);
      return 1;
    }
    query = `${lon}, ${lat}`;
    parcel = await adapter.getParcelAt(lon!, lat!);
  } else {
    query = positionals[0]!;
    parcel = await adapter.getParcelByBlockLot(query);
  }

  if (!parcel) {
    console.error(`No parcel found for ${query}.`);
    return 2;
  }
  console.log(values.json ? JSON.stringify(parcel, null, 2) : format(parcel));
  return 0;
}

function format(p: SfParcel): string {
  const rows: [string, string][] = [
    ["Zoning", [p.zoning.code ?? "unknown", p.zoning.name].filter(Boolean).join(" — ") + (p.zoning.source === "zoning-layer" ? " (from zoning layer)" : "")],
    ["Height/bulk", p.heightDistricts.length ? p.heightDistricts.map(formatHeight).join("\n") : "none found"],
    ["Lot area", `${Math.round(p.lotAreaSqFt).toLocaleString("en-US")} sq ft (computed in EPSG:2227)`],
    ["Centroid", `${p.centroid.lon.toFixed(6)}, ${p.centroid.lat.toFixed(6)}`],
  ];
  if (p.unitBlklots.length) {
    const shown = p.unitBlklots.slice(0, 8).join(", ");
    const more = p.unitBlklots.length > 8 ? `, … (${p.unitBlklots.length - 8} more)` : "";
    rows.push(["Condo stack", `${p.unitBlklots.length} unit records: ${shown}${more}`]);
  }
  rows.push(["Data as of", `parcels ${p.asOf.parcels ?? "unknown"} · height districts ${p.asOf.heightDistricts ?? "unknown"}`]);
  if (p.warnings.length) rows.push(["Notes", p.warnings.map((w) => `• ${w}`).join("\n")]);

  const header = `${p.address.label ?? "(no street address)"}  ·  block/lot ${p.blklot}${p.active ? "" : "  ·  RETIRED"}`;
  const width = Math.max(...rows.map(([k]) => k.length)) + 2;
  const body = rows.map(([k, v]) => {
    const [first, ...rest] = v.split("\n");
    return [k.padEnd(width) + first, ...rest.map((line) => " ".repeat(width) + line)].join("\n");
  });
  return [header, "", ...body].join("\n");
}

function formatHeight(d: SfHeightDistrict): string {
  const share = d.shareOfLot === null ? "share unknown" : `${(d.shareOfLot * 100).toFixed(1)}% of lot`;
  let meaning: string;
  switch (d.parsed.kind) {
    case "standard":
      meaning = `${d.parsed.heightFt} ft, bulk ${d.parsed.bulk}`;
      break;
    case "r4":
      meaning = `base ${d.parsed.baseHeightFt} ft; local program ${d.parsed.localProgramHeightFt} ft (Family Zoning Plan R-4)`;
      break;
    case "unparsed":
      meaning = `not modeled: ${d.parsed.reason}`;
      break;
  }
  return `${d.label} → ${meaning}  ·  ${share}`;
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
