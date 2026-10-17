import { DATASETS, soqlUrl } from "./datasf";
import { availableDistricts } from "./districts";

// The parcel layer's zoning_code can name more than one district, separated by
// "|": "RH-1|RH-2" for a lot split between districts, and occasionally a repeat
// such as "RH-2|RH-2".

/** "RH-1|RH-2" → ["RH-1", "RH-2"]; repeats collapse ("RH-2|RH-2" → ["RH-2"]); blank → []. */
export function zoningCodes(raw: string | null | undefined): string[] {
  const codes = (raw ?? "").split("|").map((code) => code.trim()).filter(Boolean);
  return [...new Set(codes)];
}

// Parcels label every named neighborhood commercial district with a generic code
// ("NCD" or "NCT") and give its name in zoning_district. The zoning layer has each
// district's own code ("NCD-NORTH BEACH", "NCT-MISSION") next to the same name
// (districtna), so the specific code is looked up there by name.
export const NAMED_DISTRICT_CODES: readonly string[] = ["NCD", "NCT"];

/** Every (code, name) pair in the zoning layer: about 120 rows. */
export function namedDistrictsUrl(): string {
  return soqlUrl(DATASETS.zoningDistricts, { select: "zoning,districtna", group: "zoning,districtna", limit: 5000 });
}

/** District name → zoning-layer code, for names that map to exactly one code. */
export function namedDistrictIndex(rows: readonly { zoning?: string; districtna?: string }[]): Map<string, string> {
  const codes = new Map<string, Set<string>>();
  for (const row of rows) {
    const name = districtNameKey(row.districtna);
    const code = row.zoning?.trim();
    if (!name || !code) continue;
    if (!codes.has(name)) codes.set(name, new Set());
    codes.get(name)!.add(code);
  }
  return new Map([...codes].flatMap(([name, set]) => (set.size === 1 ? [[name, [...set][0]!] as const] : [])));
}

/** "NCD" named "NORTH BEACH NEIGHBORHOOD COMMERCIAL" → "NCD-NORTH BEACH". Other codes, and names not found, come back unchanged. */
export function resolveNamedDistrict(code: string, districtName: string | null | undefined, index: ReadonlyMap<string, string>): string {
  if (!NAMED_DISTRICT_CODES.includes(code)) return code;
  return index.get(districtNameKey(districtName)) ?? code;
}

function districtNameKey(name: string | null | undefined): string {
  return (name ?? "").trim().toUpperCase().replace(/\s+/g, " ");
}

export type ZoningCoverage =
  /** One district with a rule file. */
  | { kind: "covered"; code: string }
  /** One district without a rule file yet. */
  | { kind: "not_covered"; code: string }
  /** More than one district on the lot; not modeled yet. */
  | { kind: "split"; codes: string[] }
  | { kind: "unknown" };

export function zoningCoverage(raw: string | null | undefined, covered: readonly string[] = availableDistricts()): ZoningCoverage {
  const codes = zoningCodes(raw);
  if (codes.length === 0) return { kind: "unknown" };
  if (codes.length > 1) return { kind: "split", codes };
  const code = codes[0]!;
  return covered.includes(code) ? { kind: "covered", code } : { kind: "not_covered", code };
}

/** "RH-1(D), RH-1, RM-1, RM-2, RM-3" → "RH-1(D), RH-1, RM-1–RM-3": runs of one numbered family are shortened. */
export function districtList(codes: readonly string[]): string {
  const parts: string[] = [];
  for (let i = 0; i < codes.length; ) {
    const family = /^([A-Z]+)-(\d+)$/.exec(codes[i]!);
    let j = i + 1;
    if (family) {
      while (j < codes.length && codes[j] === `${family[1]}-${Number(family[2]) + (j - i)}`) j++;
    }
    parts.push(j - i >= 3 ? `${codes[i]}–${codes[j - 1]}` : codes.slice(i, j).join(", "));
    i = j;
  }
  return parts.join(", ");
}

/** One line on why a lot has no envelope, or null when it is covered. */
export function coverageNote(coverage: ZoningCoverage, covered: readonly string[] = availableDistricts()): string | null {
  const list = districtList(covered);
  switch (coverage.kind) {
    case "covered":
      return null;
    case "not_covered":
      return `Zoned ${coverage.code}. Rule files exist for ${list} only so far, so its envelope isn't shown.`;
    case "split":
      return `This lot is split between ${coverage.codes.join(" and ")}. Split-zoned lots aren't modeled yet.`;
    case "unknown":
      return "This lot has no zoning code in city data, so its envelope isn't shown.";
  }
}
