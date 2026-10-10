import { parseDistrictFile, type DistrictFile } from "@zoningviz/engine";
import rh2 from "./RH-2.json";

// One hand-written rule file per district. Add new files here.
const FILES: Record<string, unknown> = {
  "RH-2": rh2,
};

const parsed = new Map<string, DistrictFile>();

export function availableDistricts(): string[] {
  return Object.keys(FILES);
}

/** The validated rule file for a zoning code, or null when the district isn't covered yet. */
export function loadDistrict(code: string): DistrictFile | null {
  const cached = parsed.get(code);
  if (cached) return cached;
  const file = FILES[code];
  if (!file) return null;
  const district = parseDistrictFile(file, `districts/${code}.json`);
  parsed.set(code, district);
  return district;
}
