import { describe, expect, it } from "vitest";
import { parseDistrictFile, syntheticLot, type EnvelopeResult, type Step } from "../src";
import { depthForRearArea, findStreetSides, lotFrame, toPlanar } from "../src/geometry/lot";
import { getEngine, loadDistrict } from "./helpers";

// Fixture Z: C-2 lot coverage (§134(d)(6)) on flat lots. Levels with homes may cover 80%
// of the lot, or all of it where every home is within 40 ft of a street; the first story
// (10 ft in a 40-ft district, §145.1(c)(4)(C)) is assumed non-residential and may fill the lot.
type Ok = Extract<EnvelopeResult, { status: "ok" }>;
function ok(result: EnvelopeResult): Ok {
  if (result.status !== "ok") throw new Error(`expected an envelope, got ${result.status}`);
  return result;
}
const step = (r: Ok, id: string): Step => r.steps.find((s) => s.rule.id === id)!;
const levels = (r: Ok) => r.floors.map((f) => [f.bottomFt, f.topFt]);
const plates = (r: Ok) => r.floors.map((f) => Math.round(f.plateSqFt));

const engine = await getEngine();
const c2 = loadDistrict("C-2");
const x40 = { label: "40-X", heightFt: 40, bulk: "X" };
const envelope = (width: number, depth: number, options = {}) => ok(engine.computeEnvelope(syntheticLot(width, depth, x40), c2, options));

describe("fixture Z: C-2 lot coverage", () => {
  it("25 x 100 ft at 40-X: the open 500 sq ft is 20 ft deep across the back, above a 10 ft first story", () => {
    const r = envelope(25, 100);
    expect(step(r, "ground-floor").numbers.firstStoryFt).toBe(10);
    const coverage = step(r, "lot-coverage");
    expect(coverage.status).toBe("cut");
    expect(coverage.numbers).toMatchObject({ maxCoverage: 0.8, coveredSqFt: 2000, openSqFt: 500, aboveFt: 10 });
    expect(coverage.numbers.openDepthFt).toBeCloseTo(20, 6);
    expect(coverage.numbers.streetBandSqFt).toBeCloseTo(1000, 1);
    expect(coverage.measurements.removedVolume).toBeCloseTo(25 * 20 * 30, 3);
    expect(coverage.sentence).toContain("The open 500 sq ft is drawn across the back, 20 ft deep");
    expect(r.totals.volume).toBeCloseTo(85_000, 3);
    expect(levels(r)).toEqual([[0, 10], [10, 20], [20, 30], [30, 40]]);
    expect(plates(r)).toEqual([2500, 2000, 2000, 2000]);
    expect(r.totals.grossFloorAreaSqFt).toBeCloseTo(8500, 3);
  });

  it("counts homes in C-2's FAR (§124(b) exempts only R, RC, NC and mixed-use districts): 3.6 x 2,500 = 9,000 sq ft", () => {
    const far = step(envelope(25, 100), "far");
    expect(far.rule.params).toMatchObject({ appliesTo: "all_uses" });
    expect(far.numbers.budgetSqFt).toBeCloseTo(9000, 6);
    expect(far.sentence).toContain("homes included");
  });

  it("25 x 45 ft: the 40 ft street band (1,000 sq ft) builds more than 80% (900 sq ft), so it is drawn", () => {
    const r = envelope(25, 45);
    const coverage = step(r, "lot-coverage");
    expect(coverage.status).toBe("cut");
    expect(coverage.numbers.streetBandSqFt).toBeCloseTo(1000, 1);
    expect(coverage.sentence).toContain("the 40 ft band (1,000 sq ft) builds more");
    expect(r.totals.volume).toBeCloseTo(41_250, 1);
    expect(coverage.dimensions.map((d) => d.label)).toEqual(["40 ft from the street", "10 ft first story"]);
  });

  it("25 x 40 ft: every part of the lot is within 40 ft of the street, so it may be fully built", () => {
    const r = envelope(25, 40);
    const coverage = step(r, "lot-coverage");
    expect(coverage.status).toBe("not_applicable");
    expect(coverage.sentence).toContain("so it may be fully built");
    expect(r.totals.volume).toBeCloseTo(40_000, 3);
  });

  it("a 50 x 100 ft corner lot: the band along both streets (4,400 sq ft) beats 80% (4,000), an L-shaped keep from either front", () => {
    const lot = syntheticLot(50, 100, x40, { streets: "front_and_left" });
    for (const frontSide of [0, 1]) {
      const r = ok(engine.computeEnvelope(lot, c2, { frontSide }));
      const coverage = step(r, "lot-coverage");
      expect(coverage.numbers.streetBandSqFt).toBeCloseTo(4400, 1);
      expect(coverage.measurements.removedVolume).toBeCloseTo(600 * 30, 1);
      expect(r.totals.volume).toBeCloseTo(182_000, 1);
      expect(plates(r)).toEqual([5000, 4400, 4400, 4400]);
      expect(coverage.dimensions.filter((d) => d.label === "40 ft from the street")).toHaveLength(2);
    }
  });

  it("under Housing Choice-SF at 40//65-R-4: 82% (450 sq ft open, 18 ft deep) above a 14 ft first story, and FAR no longer counts homes", () => {
    const parcel = syntheticLot(25, 100, { label: "40//65-R-4", heightFt: 40, localProgramHeightFt: 65, bulk: "R-4" });
    const r = ok(engine.computeEnvelope(parcel, c2, { localProgram: true }));
    const coverage = step(r, "lot-coverage");
    expect(coverage.numbers).toMatchObject({ maxCoverage: 0.82, aboveFt: 14 });
    expect(coverage.numbers.openSqFt).toBeCloseTo(450, 6);
    expect(coverage.numbers.openDepthFt).toBeCloseTo(18, 6);
    expect(coverage.rule.citation).toContain("§206.10(d)(1)(E)(ii), (iv)");
    expect(step(r, "far").rule.params).toMatchObject({ appliesTo: "non_residential" });
    expect(step(r, "far").rule.citation).toContain("§206.10(d)(1)(A)");
    expect(r.totals.volume).toBeCloseTo(139_550, 3);
    expect(r.totals.grossFloorAreaSqFt).toBeCloseTo(2500 + 5 * 2050, 3);
    expect(step(r, "local-program").sentence).toContain("the lot coverage and the floor area limit follow the program's own rule");
  });

  it("can be switched off: the whole 40 ft block is left", () => {
    expect(envelope(25, 100, { disabledRuleIds: ["lot-coverage"] }).totals.volume).toBeCloseTo(100_000, 3);
  });

  it("stands its cut plane 40 ft in from the street, from the first story's top up", () => {
    const [plane, ...rest] = step(envelope(25, 45), "lot-coverage").cutPlanes;
    expect(rest).toHaveLength(0);
    // The 25 x 45 lot spans x −12.5…12.5 and y −22.5…22.5, with the street to the south.
    expect(plane!.origin.map((v) => Number(v.toFixed(6)))).toEqual([-12.5, 17.5, 10]);
    expect(plane!.u.map((v) => Number(v.toFixed(6)))).toEqual([25, 0, 0]);
    expect(plane!.v.map((v) => Number(v.toFixed(6)))).toEqual([0, 0, 30]);
  });
});

describe("rear-area depth on an irregular lot", () => {
  it("finds the line behind which a triangle has a fifth of its area", () => {
    // A right triangle 30 ft along the street and 60 ft deep: the part behind depth d has (60 − d)² / 4 sq ft.
    const lot = toPlanar({ type: "MultiPolygon", coordinates: [[[[0, 0], [30, 0], [0, 60], [0, 0]]]] }, null);
    const front = findStreetSides(lot, []).find((side) => Math.abs(side.lengthFt - 30) < 1e-9)!;
    const depth = depthForRearArea(lot, lotFrame(lot, front), 180);
    expect(depth).toBeCloseTo(60 - Math.sqrt(720), 6);
  });
});

describe("lot coverage schema", () => {
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
  const coverage = (appliesAt: string, maxCoverage = 0.8) =>
    rule({ id: "coverage", kind: "lot_coverage", params: { maxCoverage, appliesAt, streetExemptionFeet: 40 } });
  const ground = rule({ id: "ground", kind: "ground_story", params: { minFloorToFloorFeet: 14 } });
  const far = rule({ id: "far", kind: "far", params: { ratio: 3.6, appliesTo: "all_uses" } });
  const program = (params: Record<string, unknown>) =>
    rule({
      id: "program",
      kind: "local_program",
      params: { minHeight: { feet: 65, onCornerLot: true, lotAreaOverSqFt: 8000 }, waives: [], replaces: [], assumes: "A", notDrawn: "N", ...params },
    });

  it("accepts a limit above a first story set earlier, and a program replacing it and the FAR", () => {
    const replaces = [
      { ruleId: "coverage", params: { maxCoverage: 0.82, appliesAt: "above_first_story", streetExemptionFeet: 40 }, citation: "§2" },
      { ruleId: "far", params: { ratio: 3.6, appliesTo: "non_residential" }, citation: "§3" },
    ];
    expect(() => parseDistrictFile(file([program({ replaces }), ground, coverage("above_first_story"), far]))).not.toThrow();
  });

  it.each([
    ["a limit above the first story with no ground_story rule", [coverage("above_first_story")], /lot coverage limit above the first story needs a ground_story rule/],
    ["full coverage written as a limit", [coverage("grade_and_every_story", 1)], /maxCoverage/],
    [
      "replacement params that don't fit",
      [program({ replaces: [{ ruleId: "coverage", params: { maxCoverage: 0.82 }, citation: "§2" }] }), coverage("grade_and_every_story")],
      /don't fit a lot_coverage rule/,
    ],
    ["a waived FAR (it cuts no volume)", [program({ waives: [{ ruleId: "far", because: "B", citation: "§2" }] }), far], /"far" must name a later rule that cuts volume/],
  ])("refuses %s", (_, rules, message) => {
    expect(() => parseDistrictFile(file(rules))).toThrow(message);
  });
});
