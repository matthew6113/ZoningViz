import { parseDistrictFile, type DistrictFile } from "@zoningviz/engine";
import rh1 from "./RH-1.json";
import rh1d from "./RH-1(D).json";
import rh1s from "./RH-1(S).json";
import rh2 from "./RH-2.json";
import rh3 from "./RH-3.json";
import rm1 from "./RM-1.json";
import rm2 from "./RM-2.json";
import rm3 from "./RM-3.json";
import rm4 from "./RM-4.json";
import rto1 from "./RTO-1.json";
import rtoM from "./RTO-M.json";
import rtoC from "./RTO-C.json";
import nc1 from "./NC-1.json";
import nc2 from "./NC-2.json";
import nc3 from "./NC-3.json";
import ncs from "./NC-S.json";
import ncdExcelsior from "./NCD-EXCELSIOR.json";
import ncdGeary from "./NCD-GEARY-BOULEVARD.json";
import ncdNorthBeach from "./NCD-NORTH-BEACH.json";
import ncdInnerSunset from "./NCD-INNER-SUNSET.json";
import ncdPolk from "./NCD-POLK.json";
import ncdTaraval from "./NCD-TARAVAL.json";
import ncdUnion from "./NCD-UNION.json";
import nctHayes from "./NCT-HAYES.json";
import ncd24thNoeValley from "./NCD-24TH-NOE-VALLEY.json";
import ncdInnerClement from "./NCD-INNER-CLEMENT.json";
import ncdMissionBernal from "./NCD-MISSION-BERNAL.json";
import ncdSanBruno from "./NCD-SAN-BRUNO-AVENUE.json";
import nctDivisadero from "./NCT-DIVISADERO.json";
import ncdNoriega from "./NCD-NORIEGA.json";
import ncdOuterClement from "./NCD-OUTER-CLEMENT.json";
import ncdUpperFillmore from "./NCD-UPPER-FILLMORE.json";
import nct24thMission from "./NCT-24TH-MISSION.json";
import nctUpperMarket from "./NCT-UPPER-MARKET.json";
import ncdBayview from "./NCD-BAYVIEW.json";
import ncdCastro from "./NCD-CASTRO.json";
import ncdHaight from "./NCD-HAIGHT.json";
import ncdPacific from "./NCD-PACIFIC.json";
import nctOcean from "./NCT-OCEAN.json";
import nctMission from "./NCT-MISSION.json";
import nctValencia from "./NCT-VALENCIA.json";

// One hand-written rule file per district, keyed by its zoning code; a file is named
// by the code with spaces as hyphens. Add new files here.
const FILES: Record<string, unknown> = {
  "RH-1(D)": rh1d,
  "RH-1": rh1,
  "RH-1(S)": rh1s,
  "RH-2": rh2,
  "RH-3": rh3,
  "RM-1": rm1,
  "RM-2": rm2,
  "RM-3": rm3,
  "RM-4": rm4,
  "RTO-1": rto1,
  "RTO-M": rtoM,
  "RTO-C": rtoC,
  "NC-1": nc1,
  "NC-2": nc2,
  "NC-3": nc3,
  "NC-S": ncs,
  // Named NC districts, by their zoning-layer codes (sf/zoning.ts, resolveNamedDistrict).
  "NCD-24TH-NOE-VALLEY": ncd24thNoeValley,
  "NCD-BAYVIEW": ncdBayview,
  "NCD-CASTRO": ncdCastro,
  "NCD-EXCELSIOR": ncdExcelsior,
  "NCD-GEARY BOULEVARD": ncdGeary,
  "NCD-HAIGHT": ncdHaight,
  "NCD-INNER CLEMENT": ncdInnerClement,
  "NCD-INNER SUNSET": ncdInnerSunset,
  "NCD-MISSION BERNAL": ncdMissionBernal,
  "NCD-NORIEGA": ncdNoriega,
  "NCD-NORTH BEACH": ncdNorthBeach,
  "NCD-OUTER CLEMENT": ncdOuterClement,
  "NCD-PACIFIC": ncdPacific,
  "NCD-POLK": ncdPolk,
  "NCD-SAN BRUNO AVENUE": ncdSanBruno,
  "NCD-TARAVAL": ncdTaraval,
  "NCD-UNION": ncdUnion,
  "NCD-UPPER FILLMORE": ncdUpperFillmore,
  "NCT-24TH-MISSION": nct24thMission,
  "NCT-DIVISADERO": nctDivisadero,
  "NCT-HAYES": nctHayes,
  "NCT-MISSION": nctMission,
  "NCT-OCEAN": nctOcean,
  "NCT-UPPER MARKET": nctUpperMarket,
  "NCT-VALENCIA": nctValencia,
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
  const district = parseDistrictFile(file, `districts/${code.replaceAll(" ", "-")}.json`);
  parsed.set(code, district);
  return district;
}
