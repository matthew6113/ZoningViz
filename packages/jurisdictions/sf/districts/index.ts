import { parseDistrictFile, type DistrictFile } from "@zoningviz/engine";
import rh1 from "./RH-1.json";
import rh1d from "./RH-1(D).json";
import rh1s from "./RH-1(S).json";
import rh2 from "./RH-2.json";
import rh3 from "./RH-3.json";

// One hand-written rule file per district. Add new files here.
const FILES: Record<string, unknown> = {
  "RH-1(D)": rh1d,
  "RH-1": rh1,
  "RH-1(S)": rh1s,
  "RH-2": rh2,
  "RH-3": rh3,
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
