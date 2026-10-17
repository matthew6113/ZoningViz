import { describe, expect, it } from "vitest";
import { coverageNote, districtList, namedDistrictIndex, resolveNamedDistrict, zoningCodes, zoningCoverage } from "../zoning";

describe("zoning codes on the parcel record", () => {
  it.each([
    ["RH-2", ["RH-2"]],
    ["RH-2|RH-2", ["RH-2"]],
    ["RH-2|RH-2|RH-2|RH-2|RH-2", ["RH-2"]],
    ["RH-1|RH-2", ["RH-1", "RH-2"]],
    ["RH-1|RH-2|RH-2|RM-1", ["RH-1", "RH-2", "RM-1"]],
    [" RH-1(D) ", ["RH-1(D)"]],
    ["", []],
    [null, []],
  ])("%j → %j", (raw, codes) => {
    expect(zoningCodes(raw)).toEqual(codes);
  });

  it("tells covered, uncovered, split and unknown lots apart", () => {
    const covered = ["RH-1(D)", "RH-1", "RH-1(S)", "RH-2", "RH-3"];
    expect(zoningCoverage("RH-1(D)", covered)).toEqual({ kind: "covered", code: "RH-1(D)" });
    expect(zoningCoverage("RH-2|RH-2", covered)).toEqual({ kind: "covered", code: "RH-2" });
    expect(zoningCoverage("RM-1", covered)).toEqual({ kind: "not_covered", code: "RM-1" });
    expect(zoningCoverage("RH DTR", covered)).toEqual({ kind: "not_covered", code: "RH DTR" });
    expect(zoningCoverage("RH-1|RH-2", covered)).toEqual({ kind: "split", codes: ["RH-1", "RH-2"] });
    expect(zoningCoverage(null, covered)).toEqual({ kind: "unknown" });
  });

  it("covers every RH house district by default", () => {
    for (const code of ["RH-1(D)", "RH-1", "RH-1(S)", "RH-2", "RH-3"]) expect(zoningCoverage(code).kind).toBe("covered");
  });

  it("explains why a lot has no envelope", () => {
    expect(coverageNote(zoningCoverage("RH-2"))).toBeNull();
    expect(coverageNote(zoningCoverage("RH-1|RH-2"))).toBe("This lot is split between RH-1 and RH-2. Split-zoned lots aren't modeled yet.");
    expect(coverageNote(zoningCoverage("NCT-3"), ["RH-2"])).toBe("Zoned NCT-3. Rule files exist for RH-2 only so far, so its envelope isn't shown.");
  });

  it("shortens runs of a numbered family in the covered list", () => {
    expect(districtList(["RH-1(D)", "RH-1", "RH-1(S)", "RH-2", "RH-3", "RM-1", "RM-2", "RM-3", "RM-4", "NC-1", "NC-2", "NC-3", "NC-S"])).toBe(
      "RH-1(D), RH-1, RH-1(S), RH-2, RH-3, RM-1–RM-4, NC-1–NC-3, NC-S",
    );
    expect(districtList(["RM-1", "RM-3"])).toBe("RM-1, RM-3");
    expect(districtList([])).toBe("");
  });
});

describe("named neighborhood commercial districts", () => {
  // As the zoning layer serves them (zoning, districtna), with one name used for two codes.
  const index = namedDistrictIndex([
    { zoning: "NCD-NORTH BEACH", districtna: "NORTH BEACH NEIGHBORHOOD COMMERCIAL" },
    { zoning: "NCT-MISSION", districtna: "MISSION STREET NEIGHBORHOOD COMMERCIAL TRANSIT" },
    { zoning: "M-2", districtna: "PDR PRODUCTION, DISTRIBUTION, AND REPAIR" },
    { zoning: "PDR-2", districtna: "PDR PRODUCTION, DISTRIBUTION, AND REPAIR" },
    { zoning: "RH-2" },
  ]);

  it("finds a generic NCD or NCT code's own district by name", () => {
    expect(resolveNamedDistrict("NCD", "North Beach Neighborhood Commercial ", index)).toBe("NCD-NORTH BEACH");
    expect(resolveNamedDistrict("NCT", "MISSION STREET  NEIGHBORHOOD COMMERCIAL TRANSIT", index)).toBe("NCT-MISSION");
  });

  it("leaves other codes, unknown names and ambiguous names alone", () => {
    expect(resolveNamedDistrict("RH-2", "NORTH BEACH NEIGHBORHOOD COMMERCIAL", index)).toBe("RH-2");
    expect(resolveNamedDistrict("NCD", "POLK STREET NEIGHBORHOOD COMMERCIAL", index)).toBe("NCD");
    expect(resolveNamedDistrict("NCD", null, index)).toBe("NCD");
    expect(index.has("PDR PRODUCTION, DISTRIBUTION, AND REPAIR")).toBe(false);
  });

  it("covers the named districts that have rule files", () => {
    for (const code of ["NCD-EXCELSIOR", "NCD-GEARY BOULEVARD", "NCD-NORTH BEACH", "NCT-MISSION", "NCT-VALENCIA"]) {
      expect(zoningCoverage(code)).toEqual({ kind: "covered", code });
    }
    expect(zoningCoverage("NCD-POLK")).toEqual({ kind: "not_covered", code: "NCD-POLK" });
  });
});
