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
  it("accepts RH-2.json with SPEC.md's rules in order, all unverified", () => {
    expect(rh2.rules.map((r) => r.id)).toEqual([
      "use",
      "mapped-height",
      "rh-dwelling-height",
      "rear-yard",
      "front-setback",
      "front-plane",
      "slope",
    ]);
    expect(rh2.rules.every((r) => r.verified === false)).toBe(true);
    expect(rh2.rules.find((r) => r.id === "rear-yard")!.params).toEqual({
      pctOfLotDepth: 0.3,
      minFeet: 15,
      appliesAt: "grade_and_every_story",
    });
  });

  it("accepts a verified rule with an effective date", () => {
    expect(() => parseDistrictFile(file([rule({ verified: true, effectiveDate: "2025-12-12" })]))).not.toThrow();
  });

  it.each([
    ["a verified rule without an effective date", [rule({ verified: true })], /effective date/],
    ["an unknown kind", [rule({ kind: "bulk" })], /kind/],
    ["duplicate ids", [rule({}), rule({})], /duplicate rule id/],
    ["a malformed URL", [rule({ url: "not a url" })], /url/i],
    ["a missing plain sentence", [rule({ plain: "" })], /plain/],
    ["unexpected params", [rule({ params: { feet: 40 } })], /params/],
    ["an out-of-range sky plane angle", [rule({ kind: "sky_plane", params: { fromLine: "front_setback", startHeightFeet: 30, angleDeg: 90 } })], /angleDeg/],
  ])("rejects %s", (_, rules, message) => {
    expect(() => parseDistrictFile(file(rules))).toThrow(message);
  });
});
