import { describe, expect, it } from "vitest";
import { parseDistrictFile, syntheticLot, type EnvelopeResult, type ParcelInput, type Step } from "../src";
import { getEngine, loadDistrict } from "./helpers";

// Bulk limits (Table 270): above a set height, every floor's length and
// diagonal stay within the district's limits. Fixtures K, L and N are hand-checked.
const NO_SETBACK = { overrides: { "front-setback": { feet: 0 } } };

type Ok = Extract<EnvelopeResult, { status: "ok" }>;
function ok(result: EnvelopeResult): Ok {
  if (result.status !== "ok") throw new Error(`expected an envelope, got ${result.status}`);
  return result;
}
const step = (r: Ok, id: string): Step => r.steps.find((s) => s.rule.id === id)!;
const lot = (width: number, depth: number, label: string, heightFt: number, bulk: string | null): ParcelInput => {
  const input = syntheticLot(width, depth, { label, heightFt });
  input.heightZones[0]!.bulk = bulk;
  return input;
};

describe("fixture K: 50 x 150 ft RM-4 lot, 65-A (the length limit binds)", async () => {
  const engine = await getEngine();
  const r = ok(engine.computeEnvelope(lot(50, 150, "65-A", 65, "A"), loadDistrict("RM-4"), NO_SETBACK));
  const bulk = step(r, "bulk");

  it("measures 50 x 112.5 ft above 40 ft and keeps a 50 x 110 ft box at the front", () => {
    expect(step(r, "rear-yard").numbers.rearYardFt).toBeCloseTo(37.5, 6);
    expect(bulk.status).toBe("cut");
    expect(bulk.numbers).toMatchObject({ aboveFt: 40, lengthFt: 110, diagonalFt: 125 });
    expect(bulk.numbers.measuredWidthFt).toBeCloseTo(50, 4);
    expect(bulk.numbers.measuredDepthFt).toBeCloseTo(112.5, 4);
    expect(bulk.numbers.boxWidthFt).toBeCloseTo(50, 4);
    expect(bulk.numbers.boxDepthFt).toBeCloseTo(110, 4);
    expect(bulk.sentence).toBe(
      "Bulk limits: 65-A: above 40 ft, no floor may be longer than 110 ft or measure more than 125 ft corner to corner. " +
        "Above 40 ft the envelope is 50 ft wide and 112.5 ft deep (123.1 ft corner to corner), so the upper floors are drawn as a 50 ft × 110 ft box at the front; " +
        "they could sit anywhere on the lot within those dimensions.",
    );
  });

  it("removes 3,125 cu ft above 40 ft only", () => {
    expect(bulk.measurements.removedVolume).toBeCloseTo(50 * 2.5 * 25, 3);
    const z = bulk.removed!.positions.filter((_, i) => i % 3 === 2);
    expect(Math.min(...z)).toBeCloseTo(40, 4);
    expect(bulk.measurements.footprintSqFt).toBeCloseTo(50 * 112.5, 3);
    expect(bulk.dimensions.map((d) => d.label)).toEqual(["110 ft"]);
  });

  it("ends at 362,500 cu ft: 4 stories of 5,625 sq ft below 40 ft, 2 of 5,500 above", () => {
    expect(r.totals.volume).toBeCloseTo(50 * 112.5 * 40 + 50 * 110 * 25, 3);
    expect(r.floors.map((f) => Math.round(f.plateSqFt))).toEqual([5625, 5625, 5625, 5625, 5500, 5500]);
    expect(r.totals.grossFloorAreaSqFt).toBeCloseTo(33_500, 3);
  });
});

describe("fixture L: 105 x 100 ft RM-4 lot, 65-A (the diagonal binds)", async () => {
  const engine = await getEngine();
  const r = ok(engine.computeEnvelope(lot(105, 100, "65-A", 65, "A"), loadDistrict("RM-4"), NO_SETBACK));
  const bulk = step(r, "bulk");
  const depth = Math.sqrt(125 ** 2 - 105 ** 2);

  it("keeps the full 105 ft front and shortens the depth to fit the 125 ft diagonal", () => {
    expect(bulk.numbers.measuredDiagonalFt).toBeCloseTo(Math.hypot(105, 75), 4);
    expect(bulk.numbers.boxWidthFt).toBeCloseTo(105, 4);
    expect(bulk.numbers.boxDepthFt).toBeCloseTo(depth, 4);
    expect(bulk.measurements.removedVolume).toBeCloseTo(105 * (75 - depth) * 25, 2);
  });
});

describe("fixture N: 25 x 100 ft RM-4 lot, 65-N (a 50 ft length limit)", async () => {
  const engine = await getEngine();
  const r = ok(engine.computeEnvelope(lot(25, 100, "65-N", 65, "N"), loadDistrict("RM-4"), NO_SETBACK));
  const bulk = step(r, "bulk");

  it("keeps 50 ft of the 75 ft depth above 40 ft", () => {
    expect(bulk.numbers.boxDepthFt).toBeCloseTo(50, 4);
    expect(bulk.measurements.removedVolume).toBeCloseTo(25 * 25 * 25, 3);
  });
});

describe("bulk outcomes by letter", async () => {
  const engine = await getEngine();
  const bulkStep = (input: ParcelInput, district = "RM-4", options = {}) =>
    step(ok(engine.computeEnvelope(input, loadDistrict(district), { ...NO_SETBACK, ...options })), "bulk");

  it("is already satisfied when the envelope fits (a 25 x 137.5 ft lot is about 103 ft deep above 40 ft)", () => {
    const s = bulkStep(lot(25, 137.5, "65-A", 65, "A"));
    expect(s.status).toBe("already_satisfied");
    expect(s.sentence).toMatch(/within both limits\. Already satisfied/);
    expect(s.measurements.removedVolume).toBe(0);
  });

  it("is already satisfied on a lot exactly as wide as the length limit", () => {
    // 110 x 40 ft, RM-3: 110 ft wide and 25 ft deep above 40 ft.
    const s = bulkStep(lot(110, 40, "65-A", 65, "A"), "RM-3");
    expect(s.status).toBe("already_satisfied");
    expect(s.measurements.removedVolume).toBe(0);
  });

  it("doesn't apply in bulk district X", () => {
    const s = bulkStep(lot(25, 100, "40-X", 40, "X"), "RH-2");
    expect(s.status).toBe("not_applicable");
    expect(s.sentence).toBe("Bulk limits: 40-X: bulk district X has no length or diagonal limits.");
  });

  it("doesn't apply on R-4 lots below the 85 ft podium", () => {
    const s = bulkStep(lot(25, 100, "40//65-R-4", 40, "R-4"), "RH-2");
    expect(s.status).toBe("not_applicable");
    expect(s.sentence).toMatch(/R-4 bulk limits start above the 85 ft podium, and the height limit here is 40 ft/);
  });

  it("doesn't apply when the letter's limits start at or above the height limit", () => {
    expect(bulkStep(lot(25, 100, "40-D", 40, "D")).status).toBe("not_applicable");
  });

  it("says other letters aren't modeled", () => {
    const s = bulkStep(lot(25, 100, "85-S", 85, "S"));
    expect(s.status).toBe("not_modeled");
    expect(s.sentence).toMatch(/bulk district S has rules this app doesn't model/);
  });

  it("can be switched off", () => {
    expect(bulkStep(lot(50, 150, "65-A", 65, "A"), "RM-4", { disabledRuleIds: ["bulk"] }).status).toBe("disabled");
  });
});

describe("bulk schema", () => {
  const rule = (params: unknown) => ({
    id: "bulk",
    kind: "bulk",
    title: "Bulk",
    plain: "P",
    params,
    citation: "§270",
    url: "https://example.org/code",
    verified: false,
    effectiveDate: null,
  });
  const file = (params: unknown) => ({ jurisdiction: "sf", district: "T", name: "Test", rules: [rule(params)] });

  it("refuses a length longer than its diagonal", () => {
    const params = { letters: { Q: { aboveFeet: 40, lengthFeet: 130, diagonalFeet: 125 } }, noLimit: [], podiumOnly: {} };
    expect(() => parseDistrictFile(file(params))).toThrow(/longer than its diagonal/);
  });
});
