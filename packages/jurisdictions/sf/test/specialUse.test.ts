import { describe, expect, it } from "vitest";
import { SPECIAL_USE_NOTES, specialUseFacts } from "../specialUse";
import type { SfParcel } from "../types";

const FSHO = "Family and Senior Housing Opportunity SUD";
const lot = (codes: string[], names: string[] | null): Pick<SfParcel, "zoning" | "specialUseDistricts"> => ({
  zoning: { code: codes.join("|") || null, codes, name: null, source: "parcel" },
  specialUseDistricts: names && names.map((name) => ({ name, url: `https://example.org/${encodeURIComponent(name)}` })),
});

describe("special use notes", () => {
  it("follow the district files' rules: cited, and dated only once verified", () => {
    for (const note of SPECIAL_USE_NOTES) {
      expect(note.citation).toMatch(/^§/);
      expect(note.eligibility.citation).toMatch(/^§/);
      expect(note.plain.length).toBeGreaterThan(0);
      if (note.verified) expect(note.effectiveDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      else expect(note.effectiveDate).toBeNull();
    }
    expect(SPECIAL_USE_NOTES.map((n) => n.name)).toContain(FSHO);
  });
});

describe("specialUseFacts", () => {
  it("lists noted districts first and the rest by name, with the layer's links", () => {
    const facts = specialUseFacts(lot(["RH-2"], ["Central Neighborhoods Large Residence", FSHO]))!;
    expect(facts.map((f) => f.name)).toEqual([FSHO, "Central Neighborhoods Large Residence"]);
    expect(facts[0]!.note).toMatchObject({ citation: expect.stringMatching(/^§249\.94/), verified: false, effectiveDate: null });
    expect(facts[0]!.url).toBe(`https://example.org/${encodeURIComponent(FSHO)}`);
    expect(facts[1]).toMatchObject({ note: null, applies: null });
  });

  it("says whether the lot's zoning can use §249.94", () => {
    const applies = (codes: string[], others: string[] = []) => specialUseFacts(lot(codes, [FSHO, ...others]))![0]!.applies;
    expect(applies(["RH-1(D)"])).toEqual({ status: "yes", sentence: "RH-1(D) lots here can use it (§249.94(c)(1))." });
    expect(applies(["RM-1"])).toMatchObject({ status: "depends", sentence: expect.stringContaining("only in the area bounded by the Great Highway") });
    expect(applies(["NC-1"])).toMatchObject({ status: "no", sentence: expect.stringContaining("this lot is NC-1, so it can't use this") });
    expect(applies(["RH-2", "RM-1"])).toMatchObject({ status: "depends", sentence: expect.stringContaining("split between RH-2 and RM-1") });
    expect(applies([])).toMatchObject({ status: "depends", sentence: expect.stringContaining("zoning is unknown") });
    // §249.94(c)(1)(A) leaves out the Telegraph Hill – North Beach Residential SUD.
    expect(applies(["RH-2"], ["Telegraph Hill-NB Residential"])).toMatchObject({
      status: "no",
      sentence: expect.stringContaining("Telegraph Hill – North Beach Residential SUD (§249.49)"),
    });
  });

  it("has nothing to say when the layer couldn't be read", () => {
    expect(specialUseFacts(lot(["RH-2"], null))).toBeNull();
    expect(specialUseFacts(lot(["RH-2"], []))).toEqual([]);
  });
});
