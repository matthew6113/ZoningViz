// pnpm envelope <blklot> [--front N] [--setback FT] [--floor FT] [--off rule-id,...] [--program] [--json] [--no-cache]
//
// Runs the zoning engine on a real San Francisco parcel and prints each rule's
// step: what it cuts, what's left, and the card sentence.
import { createEngine, type EnvelopeOptions, type EnvelopeResult, type FrontCandidate } from "@zoningviz/engine";
import { createSfAdapter } from "./adapter";
import { loadDistrict, availableDistricts } from "./districts";
import { toParcelInput } from "./engineInput";
import { parseCliArgs } from "./node/args";
import { devFetchJson } from "./node/cache";
import type { SfParcel } from "./types";

const USAGE =
  "Usage: pnpm envelope <blklot> [--front N] [--setback FT] [--floor FT] [--off rule-id,...] [--program] [--json] [--no-cache]";

async function main(): Promise<number> {
  let args;
  try {
    args = parseCliArgs(process.argv.slice(2), ["--json", "--no-cache", "--program", "--help", "-h"], [
      "--front",
      "--setback",
      "--floor",
      "--off",
    ]);
  } catch (error) {
    console.error(`${(error as Error).message}\n${USAGE}`);
    return 1;
  }
  const { flags, values, positionals } = args;
  if (flags.has("--help") || flags.has("-h") || positionals.length !== 1) {
    console.log(USAGE);
    return positionals.length === 1 ? 0 : 1;
  }

  const adapter = createSfAdapter({ fetchJson: devFetchJson({ noCache: flags.has("--no-cache") }) });
  const parcel = await adapter.getParcelByBlockLot(positionals[0]!);
  if (!parcel) {
    console.error(`No parcel found for ${positionals[0]}.`);
    return 2;
  }
  const code = parcel.zoning.code;
  const district = code ? loadDistrict(code) : null;
  if (!district) {
    console.error(
      `${parcel.blklot} is zoned ${code ?? "unknown"}; rule files exist for ${availableDistricts().join(", ")} only.`,
    );
    return 3;
  }

  const options: EnvelopeOptions = {};
  if (values.has("--front")) options.frontSide = Number(values.get("--front"));
  if (values.has("--setback")) {
    const rule = district.rules.find((r) => r.kind === "front_setback");
    if (rule) options.overrides = { [rule.id]: { feet: Number(values.get("--setback")) } };
  }
  if (values.has("--floor")) options.floorToFloorFeet = Number(values.get("--floor"));
  if (values.has("--off")) options.disabledRuleIds = values.get("--off")!.split(",");
  // Housing Choice-SF on R-4 lots.
  if (flags.has("--program")) options.localProgram = true;

  const engine = await createEngine();
  const [neighbors, terrain] = await Promise.all([adapter.getNeighbors(parcel), adapter.getTerrain(parcel)]);
  const result = engine.computeEnvelope(toParcelInput(parcel, neighbors, terrain), district, options);

  if (flags.has("--json")) {
    console.log(JSON.stringify(result, (_, v) => (ArrayBuffer.isView(v) ? `[${(v as Float32Array).length} values]` : v), 2));
    return 0;
  }
  console.log(format(parcel, result));
  return result.status === "ok" ? 0 : 4;
}

function format(parcel: SfParcel, result: EnvelopeResult): string {
  const lines = [`${parcel.address.label ?? "(no street address)"}  ·  block/lot ${parcel.blklot}  ·  ${parcel.zoning.code}`, ""];
  if (result.status === "needs_front_choice") {
    lines.push(`This lot has ${result.candidates.length} street sides. Choose the front with --front N:`);
    for (const c of result.candidates) lines.push(`  --front ${c.index}   ${n(c.lengthFt, 1)} ft side facing ${compass(c)}`);
    return lines.join("\n");
  }

  const { lot, start, steps, floors, totals, notes } = result;
  lines.push(
    `Lot          ${n(lot.areaSqFt)} sq ft · ${n(lot.widthFt, 1)} ft wide × ${n(lot.depthFt, 1)} ft deep · front faces ${compass(lot.front)}${lot.approximate ? " · approximate geometry" : ""}`,
    `Start block  ${n(start.heightFt)} ft tall · ${n(start.volume)} cu ft`,
    "",
    ` #  ${"Rule".padEnd(26)}${"Status".padEnd(19)}${"Removed".padStart(12)}${"Remaining".padStart(13)}${"Left".padStart(7)}`,
  );
  steps.forEach((step, i) => {
    const m = step.measurements;
    const tag = step.rule.verified ? "" : " [unverified]";
    lines.push(
      `${String(i + 1).padStart(2)}  ${step.rule.title.slice(0, 25).padEnd(26)}${step.status.padEnd(19)}${(m.removedVolume ? n(m.removedVolume) : "—").padStart(12)}${n(m.volume).padStart(13)}${`${n(m.percentOfStart)}%`.padStart(7)}`,
      `    ${step.sentence}${tag}`,
      `    ${step.rule.citation}`,
    );
  });
  lines.push(
    "",
    `Floors       ${floors.length}: ${floors.map((f) => `${n(f.plateSqFt)} (${n(f.bottomFt)}–${n(f.topFt)} ft)`).join(" · ")} sq ft`,
    `Result       ${n(totals.volume)} cu ft · footprint ${n(totals.footprintSqFt)} sq ft · ${totals.stories} stories · ${n(totals.grossFloorAreaSqFt)} sq ft floor area · ${n(totals.percentSurvived, 1)}% of the block survived`,
  );
  if (notes.length || parcel.warnings.length) {
    lines.push("Notes", ...[...notes, ...parcel.warnings].map((w) => `  • ${w}`));
  }
  return lines.join("\n");
}

function n(value: number, digits = 0): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

function compass(side: FrontCandidate): string {
  const [x, y] = side.outward;
  const names = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"];
  const bearing = ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360;
  return names[Math.round(bearing / 45) % 8]!;
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
