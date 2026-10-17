// Coverage sweep: runs random land parcels from every covered RH district
// through the DataSF adapter and the engine, the same path a click on the map
// takes, and checks the SPEC.md invariants on each result.
//
//   pnpm sweep [--per-district 50] [--seed 1] [--split 10] [--program] [--only CODE,CODE] [--no-cache]
//
// Prints a table per district and every failure with its block/lot. With
// --program, lots with a local-program height (R-4) are run again with
// Housing Choice-SF on, checked the same way, and tallied by what it adds.
import { createEngine, UnreadableHeightError, type EnvelopeResult } from "../packages/engine/src";
import { createSfAdapter } from "../packages/jurisdictions/sf/adapter";
import { DATASETS, soqlString, soqlUrl } from "../packages/jurisdictions/sf/datasf";
import { availableDistricts, loadDistrict } from "../packages/jurisdictions/sf/districts";
import { toParcelInput } from "../packages/jurisdictions/sf/engineInput";
import { parseCliArgs } from "../packages/jurisdictions/sf/node/args";
import { devFetchJson } from "../packages/jurisdictions/sf/node/cache";
import { coverageNote, namedDistrictIndex, namedDistrictsUrl, zoningCoverage } from "../packages/jurisdictions/sf/zoning";

const args = parseCliArgs(process.argv.slice(2), ["--no-cache", "--program"], ["--per-district", "--seed", "--split", "--only"]);
/** --only "NC-3,NCT-MISSION": sweep just these districts. */
const only = args.values.get("--only")?.split(",").map((code) => code.trim()).filter(Boolean);
const withProgram = args.flags.has("--program");
const perDistrict = Number(args.values.get("--per-district") ?? 50);
const splitCount = Number(args.values.get("--split") ?? 10);
let seed = Number(args.values.get("--seed") ?? 1);
const fetchJson = devFetchJson({ noCache: args.flags.has("--no-cache") });
const adapter = createSfAdapter({ fetchJson });
const engine = await createEngine();
const CONCURRENCY = 6;

type Outcome =
  /** `emptyFronts`: front choices whose rules leave nothing (short lots measured from their long side). */
  | { kind: "ok"; frontChoice: boolean; emptyFronts: number[]; rise: number | null; bulk: BulkOutcome; program: ProgramOutcome | null }
  | { kind: "not_modeled"; note: string }
  | { kind: "error"; message: string };

/** What the local program changes on the first front shown (lots with a local-program height, under --program). */
interface ProgramOutcome {
  heightGainFt: number;
  /** The program's minimum height raised the lot (corner or large lot), and why. */
  minHeight: "corner" | "large" | "corner and large" | null;
  floorAreaGainSqFt: number;
}

/** The bulk rule's outcome on the first front shown, and the bulk letters mapped on the lot. */
interface BulkOutcome {
  status: string;
  letters: string[];
}

const random = () => {
  // mulberry32: a seeded sample, so a rerun hits the same lots (and the cache)
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

function sample<T>(items: T[], n: number): T[] {
  const pool = [...items];
  const picked: T[] = [];
  while (picked.length < n && pool.length) picked.push(pool.splice(Math.floor(random() * pool.length), 1)[0]!);
  return picked;
}

async function landParcels(where: string): Promise<string[]> {
  const rows = (await fetchJson(
    soqlUrl(DATASETS.parcels, { select: "mapblklot", where: `active=true AND blklot=mapblklot AND ${where}`, order: "mapblklot", limit: 100_000 }),
  )) as { mapblklot: string }[];
  return rows.map((r) => r.mapblklot);
}

/** The SPEC.md invariants that don't need the geometry kernel; the unit tests cover containment. */
function invariantProblems(result: Extract<EnvelopeResult, { status: "ok" }>): string[] {
  const problems: string[] = [];
  let previous = result.start.volume;
  for (const step of result.steps) {
    if (step.measurements.volume > previous + 1e-6) problems.push(`volume grew at ${step.rule.id}`);
    previous = step.measurements.volume;
    const numbers = [...Object.values(step.measurements), ...Object.values(step.numbers)];
    if (!numbers.every(Number.isFinite)) problems.push(`non-finite number at ${step.rule.id}`);
    const cuts = step.status === "cut" || step.status === "already_satisfied";
    if (cuts && (step.measurements.removedVolume === 0) !== (step.status === "already_satisfied")) {
      problems.push(`${step.rule.id}: status ${step.status} but removed ${step.measurements.removedVolume}`);
    }
  }
  const removed = result.steps.reduce((sum, s) => sum + s.measurements.removedVolume, 0);
  if (Math.abs(result.start.volume - result.totals.volume - removed) > 0.001 * result.start.volume) {
    problems.push("removed volumes don't add up");
  }
  if (result.totals.volume === 0 && !result.notes.some((n) => n.startsWith("Nothing is left"))) {
    problems.push("empty envelope without a note saying so");
  }
  return problems;
}

async function run(blklot: string): Promise<Outcome> {
  try {
    const parcel = await adapter.getParcelByBlockLot(blklot);
    if (!parcel) return { kind: "error", message: "parcel not found" };
    const coverage = zoningCoverage(parcel.zoning.code);
    if (coverage.kind !== "covered") return { kind: "not_modeled", note: coverageNote(coverage)! };
    const district = loadDistrict(coverage.code)!;
    const [neighbors, terrain] = await Promise.all([adapter.getNeighbors(parcel), adapter.getTerrain(parcel)]);
    const input = toParcelInput(parcel, neighbors, terrain);
    const first = engine.computeEnvelope(input, district);
    // Every street side must work, since the viewer may pick any of them.
    const fronts = first.status === "needs_front_choice" ? first.candidates.map((_, i) => i) : [null];
    if (fronts.length === 0) return { kind: "error", message: "no front candidates" };
    const emptyFronts: number[] = [];
    let rise: number | null = null;
    let bulk: BulkOutcome | null = null;
    let baseFloorArea: number | null = null;
    for (const side of fronts) {
      const result = side === null ? first : engine.computeEnvelope(input, district, { frontSide: side });
      const label = side === null ? "" : `front side ${side}: `;
      if (result.status !== "ok") return { kind: "error", message: `${label}${result.status}` };
      const problems = invariantProblems(result);
      if (problems.length) return { kind: "error", message: `${label}${problems.join("; ")}` };
      if (result.totals.volume === 0) emptyFronts.push(side ?? 0);
      // Slope as measured from the first front the viewer would see.
      if (rise === null && result.lot.terrain) rise = result.lot.terrain.rearMinusFrontFt;
      bulk ??= { status: result.steps.find((s) => s.rule.kind === "bulk")?.status ?? "none", letters: input.heightZones.map((z) => z.bulk ?? "?") };
      baseFloorArea ??= result.totals.grossFloorAreaSqFt;
    }

    let program: ProgramOutcome | null = null;
    if (withProgram && input.heightZones.some((z) => z.localProgramHeightFt != null)) {
      for (const side of fronts) {
        const result = engine.computeEnvelope(input, district, { localProgram: true, ...(side === null ? {} : { frontSide: side }) });
        const label = `Housing Choice-SF, ${side === null ? "" : `front side ${side}: `}`;
        if (result.status !== "ok") return { kind: "error", message: `${label}${result.status}` };
        const problems = invariantProblems(result);
        if (problems.length) return { kind: "error", message: `${label}${problems.join("; ")}` };
        if (program) continue;
        const card = result.steps.find((s) => s.rule.kind === "local_program");
        if (!card || card.status !== "info") return { kind: "error", message: `${label}program card is ${card?.status ?? "missing"}` };
        const corner = /a corner lot/.test(card.sentence);
        const large = /larger than/.test(card.sentence);
        program = {
          heightGainFt: card.numbers.programHeightFt! - (card.numbers.baseHeightFt ?? card.numbers.programHeightFt!),
          minHeight: card.numbers.minHeightFt === undefined ? null : corner && large ? "corner and large" : corner ? "corner" : "large",
          floorAreaGainSqFt: result.totals.grossFloorAreaSqFt - baseFloorArea!,
        };
      }
    }
    return { kind: "ok", frontChoice: first.status === "needs_front_choice", emptyFronts, rise, bulk: bulk!, program };
  } catch (error) {
    // An unreadable height label is flagged to the viewer, not guessed.
    if (error instanceof UnreadableHeightError) return { kind: "not_modeled", note: error.message };
    return { kind: "error", message: error instanceof Error ? error.message : String(error) };
  }
}

async function runAll(blklots: string[]): Promise<Map<string, Outcome>> {
  const outcomes = new Map<string, Outcome>();
  let next = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < blklots.length) {
        const blklot = blklots[next++]!;
        outcomes.set(blklot, await run(blklot));
      }
    }),
  );
  return outcomes;
}

const started = Date.now();
const rows: string[][] = [["District", "Lots", "Sampled", "Envelope", "Front prompt", "Nothing left*", "Not modeled", "Errors"]];
const empties: string[] = [];
const failures: string[] = [];
// Rear-minus-front ground, against the §261(b) thresholds in the RH-1 family files (20 and 40 ft).
const slopeRows: string[][] = [["District", "No ground", "Rear 20+ ft higher", "Within 20 ft", "Rear 20-40 ft lower", "Rear 40+ ft lower"]];
const steepUp: string[] = [];
const bulkRows: string[][] = [["District", "Letters seen", "Cut", "Already satisfied", "Doesn't apply", "Not modeled"]];
const bulkCuts: string[] = [];
const programRows: string[][] = [["District", "R-4 lots", "Taller", "Same height, more floor area", "No change", "65 ft minimum", "Median floor area gain"]];
const minHeightLots: string[] = [];
// Named NC districts: parcels carry the generic code ("NCD") and the district's name (sf/zoning.ts).
const namedDistrictNames = new Map(
  [...namedDistrictIndex((await fetchJson(namedDistrictsUrl())) as { zoning?: string; districtna?: string }[])].map(([name, code]) => [code, name]),
);
for (const code of only ?? availableDistricts()) {
  let all = await landParcels(`zoning_code=${soqlString(code)}`);
  const name = namedDistrictNames.get(code);
  if (all.length === 0 && name) {
    all = await landParcels(`zoning_code=${soqlString(code.split("-")[0]!)} AND upper(zoning_district)=${soqlString(name)}`);
  }
  const outcomes = await runAll(sample(all, perDistrict));
  const count = (kind: Outcome["kind"]) => [...outcomes.values()].filter((o) => o.kind === kind).length;
  const oks = [...outcomes.values()].filter((o): o is Extract<Outcome, { kind: "ok" }> => o.kind === "ok");
  const prompts = oks.filter((o) => o.frontChoice).length;
  const emptyCount = oks.filter((o) => o.emptyFronts.length).length;
  rows.push([code, all.length.toLocaleString(), String(outcomes.size), String(count("ok")), String(prompts), String(emptyCount), String(count("not_modeled")), String(count("error"))]);
  const rises = oks.map((o) => o.rise);
  const band = (test: (r: number) => boolean) => String(rises.filter((r) => r !== null && test(r)).length);
  slopeRows.push([
    code,
    String(rises.filter((r) => r === null).length),
    band((r) => r >= 20),
    band((r) => r > -20 && r < 20),
    band((r) => r <= -20 && r > -40),
    band((r) => r <= -40),
  ]);
  const letters = new Map<string, number>();
  for (const o of oks) for (const letter of o.bulk.letters) letters.set(letter, (letters.get(letter) ?? 0) + 1);
  const bulkCount = (status: string) => String(oks.filter((o) => o.bulk.status === status).length);
  bulkRows.push([
    code,
    [...letters].sort((a, b) => b[1] - a[1]).map(([letter, n]) => `${letter} ${n}`).join(", "),
    bulkCount("cut"),
    bulkCount("already_satisfied"),
    bulkCount("not_applicable"),
    bulkCount("not_modeled"),
  ]);
  const programs = oks.flatMap((o) => (o.program ? [o.program] : []));
  const gains = programs.map((p) => p.floorAreaGainSqFt).sort((a, b) => a - b);
  programRows.push([
    code,
    String(programs.length),
    String(programs.filter((p) => p.heightGainFt > 0).length),
    String(programs.filter((p) => p.heightGainFt === 0 && p.floorAreaGainSqFt > 0.5).length),
    String(programs.filter((p) => p.heightGainFt === 0 && p.floorAreaGainSqFt <= 0.5).length),
    String(programs.filter((p) => p.minHeight).length),
    gains.length ? `${Math.round(gains[Math.floor(gains.length / 2)]!).toLocaleString()} sq ft` : "—",
  ]);
  for (const [blklot, o] of outcomes) {
    if (o.kind === "ok" && o.program?.minHeight) minHeightLots.push(`${code} ${blklot} (${o.program.minHeight})`);
    if (o.kind === "ok" && o.bulk.status === "cut") bulkCuts.push(`${code} ${blklot} (${o.bulk.letters.join("/")})`);
    if (o.kind === "ok" && o.rise !== null && o.rise >= 20) steepUp.push(`${code} ${blklot} (+${o.rise.toFixed(1)} ft)`);
    if (o.kind === "ok" && o.emptyFronts.length) empties.push(`${code} ${blklot}: front ${o.emptyFronts.join(", ")}`);
    if (o.kind === "error") failures.push(`${code} ${blklot}: ${o.message}`);
    if (o.kind === "not_modeled") failures.push(`${code} ${blklot} (not modeled): ${o.note}`);
  }
  console.error(`  ${code}: ${outcomes.size} lots done`);
}

// Split-zoned RH lots must explain themselves rather than fail.
const split = await landParcels(`starts_with(zoning_code,'RH-') AND zoning_code like '%|%'`);
const splitOutcomes = await runAll(sample(split, splitCount));
const splitExplained = [...splitOutcomes.values()].filter((o) => o.kind === "not_modeled" || o.kind === "ok").length;
for (const [blklot, o] of splitOutcomes) if (o.kind === "error") failures.push(`split ${blklot}: ${o.message}`);

function table(rows: string[][]) {
  const widths = rows[0]!.map((_, i) => Math.max(...rows.map((r) => r[i]!.length)));
  for (const r of rows) console.log(r.map((cell, i) => (i ? cell.padStart(widths[i]!) : cell.padEnd(widths[i]!))).join("  "));
}
table(rows);
console.log("\nGround (USGS 3DEP), rear lot line minus front, from the first front shown:");
table(slopeRows);
if (steepUp.length) console.log(`Rear 20+ ft higher: ${steepUp.join(", ")}`);
console.log("\nBulk limits (Table 270), from the first front shown:");
table(bulkRows);
if (bulkCuts.length) console.log(`Bulk cuts: ${bulkCuts.join(", ")}`);
if (withProgram) {
  console.log("\nHousing Choice-SF (switched on), from the first front shown:");
  table(programRows);
  if (minHeightLots.length) console.log(`Raised to the 65 ft minimum: ${minHeightLots.join(", ")}`);
}
console.log(
  `\nSplit-zoned RH lots: ${split.length} in all; ${splitOutcomes.size} sampled, ${splitExplained} explained (envelope or "not modeled" note), ${splitOutcomes.size - splitExplained} errors.`,
);
console.log(`\n* Lots where some front choice leaves nothing (the card notes say so):${empties.length ? `\n  ${empties.join("\n  ")}` : " none"}`);
console.log(failures.length ? `\nNot an envelope:\n  ${failures.join("\n  ")}` : "\nEvery sampled lot produced an envelope.");
console.log(`\n${((Date.now() - started) / 1000).toFixed(0)} s`);
