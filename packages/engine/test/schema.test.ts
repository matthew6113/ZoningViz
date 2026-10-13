import { describe, expect, it } from "vitest";
import { parseDistrictFile } from "../src";
import { loadDistrict } from "./helpers";

const rh2 = loadDistrict("RH-2");
const rule = (overrides: Record<string, unknown>) => ({
  id: "x",
  kind: "info",
  title: "T",
  plain: "P",
  params: {},
  citation: "§1",
  url: "https://example.org/code",
  verified: false,
  effectiveDate: null,
  ...overrides,
});
const file = (rules: unknown[]) => ({ jurisdiction: "sf", district: "T", name: "Test", rules });

describe("district schema", () => {
  it("accepts RH-2.json with SPEC.md's rules in order", () => {
    expect(rh2.rules.map((r) => r.id)).toEqual([
      "use",
      "height-reference",
      "local-program",
      "mapped-height",
      "rh-dwelling-height",
      "rear-yard",
      "front-setback",
      "front-plane",
      "bulk",
      "narrow-street",
      "cross-slope",
    ]);
    // Checked against the code text in the verification pass (VERIFY.md); the rest are drafts.
    expect(rh2.rules.filter((r) => r.verified).map((r) => r.id)).toEqual([
      "height-reference",
      "mapped-height",
      "rh-dwelling-height",
      "front-plane",
      "cross-slope",
    ]);
    expect(rh2.rules.find((r) => r.id === "rear-yard")!.params).toEqual({
      pctOfLotDepth: 0.3,
      minFeet: 15,
      appliesAt: "grade_and_every_story",
    });
  });

  const DRAFTS = ["RH-1(D)", "RH-1", "RH-1(S)", "RH-2", "RH-3", "RM-1", "RM-2", "RM-3", "RM-4", "NC-1", "NC-2", "NC-3", "NC-S"];
  it.each(DRAFTS)("accepts the %s file, every rule cited and dated only once verified", (code) => {
    const district = loadDistrict(code);
    expect(district.district).toBe(code);
    for (const r of district.rules) {
      expect(r.citation).toMatch(/§/);
      expect(r.url).toMatch(/^https:\/\//);
      if (r.verified) expect(r.effectiveDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      else expect(r.effectiveDate).toBeNull();
    }
  });

  it("gives only RH-1(D) side yards, and RH-3 no dwelling cap or front plane", () => {
    const kinds = (code: string) => loadDistrict(code).rules.map((r) => r.id);
    expect(kinds("RH-1(D)")).toContain("side-yards");
    for (const code of ["RH-1", "RH-1(S)", "RH-2", "RH-3"]) expect(kinds(code)).not.toContain("side-yards");
    expect(kinds("RH-3")).not.toContain("rh-dwelling-height");
    expect(kinds("RH-3")).not.toContain("front-plane");
  });

  it("accepts a verified rule with an effective date", () => {
    expect(() => parseDistrictFile(file([rule({ verified: true, effectiveDate: "2025-12-12" })]))).not.toThrow();
  });

  it.each([
    ["a verified rule without an effective date", [rule({ verified: true })], /effective date/],
    ["an unknown kind", [rule({ kind: "lot_coverage" })], /kind/],
    ["duplicate ids", [rule({}), rule({})], /duplicate rule id/],
    ["a malformed URL", [rule({ url: "not a url" })], /url/i],
    ["a missing plain sentence", [rule({ plain: "" })], /plain/],
    ["unexpected params", [rule({ params: { feet: 40 } })], /params/],
    ["an out-of-range sky plane angle", [rule({ kind: "sky_plane", params: { fromLine: "front_setback", startHeightFeet: 30, angleDeg: 90 } })], /angleDeg/],
    ["the old block_average setback method", [rule({ kind: "front_setback", params: { method: "block_average", maxFeet: 10, userOverride: true } })], /method/],
    ["a side-yard table that doesn't start at 0", [rule({ kind: "side_yard", params: { byLotWidth: [{ minWidthFeet: 28, eachSideFeet: 3 }] } })], /start at 0/],
    [
      "a side-yard table out of order",
      [rule({ kind: "side_yard", params: { byLotWidth: [{ minWidthFeet: 0, eachSideFeet: 0 }, { minWidthFeet: 40, eachSideFeet: 4 }, { minWidthFeet: 31, eachSideFeet: 3 }] } })],
      /narrow to wide/,
    ],
  ])("rejects %s", (_, rules, message) => {
    expect(() => parseDistrictFile(file(rules))).toThrow(message);
  });
});
