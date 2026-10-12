import { describe, expect, it } from "vitest";
import { parseDistrictFile, syntheticLot, UnreadableHeightError, type EnvelopeResult, type Step } from "../src";
import { getEngine, loadDistrict, rectangularLot } from "./helpers";

// RM and NC districts: floor-area-ratio budgets, commercial ground floors and
// rear yards that start above them. Fixtures H–J are hand-checked (CLAUDE.md).
const NO_SETBACK = { overrides: { "front-setback": { feet: 0 } } };

type Ok = Extract<EnvelopeResult, { status: "ok" }>;
function ok(result: EnvelopeResult): Ok {
  if (result.status !== "ok") throw new Error(`expected an envelope, got ${result.status}`);
  return result;
}
const step = (r: Ok, id: string): Step => r.steps.find((s) => s.rule.id === id)!;
const minZ = (positions: Float32Array) => Math.min(...positions.filter((_, i) => i % 3 === 2));

describe("fixture H: 25 x 100 ft NC-2 lot, 40-X", async () => {
  const engine = await getEngine();
  const r = ok(engine.computeEnvelope(rectangularLot(25, 100), loadDistrict("NC-2"), NO_SETBACK));

  it("draws a 10 ft first story, the minimum in a 40 ft district", () => {
    const ground = step(r, "ground-floor");
    expect(ground.status).toBe("info");
    expect(ground.numbers).toMatchObject({ firstStoryFt: 10, heightDistrictFt: 40 });
    expect(ground.sentence).toMatch(/at least 10 ft floor to floor, because this lot is in a 40 ft height district \(14 ft elsewhere\)/);
  });

  it("takes a 25 ft rear yard from the first story's top up", () => {
    const rear = step(r, "rear-yard");
    expect(rear.numbers).toMatchObject({ rearYardFt: 25, aboveFt: 10 });
    expect(rear.sentence).toMatch(/^Rear yard: 25% of 100 ft lot depth = 25 ft\. It starts above the 10 ft first story/);
    expect(rear.measurements.removedVolume).toBeCloseTo(25 * 25 * 30, 3);
    expect(minZ(rear.removed!.positions)).toBeCloseTo(10, 4);
    // The first story still fills the lot, so the footprint doesn't shrink.
    expect(rear.measurements.footprintSqFt).toBeCloseTo(2500, 3);
    expect(rear.dimensions.map((d) => d.label)).toEqual(["25 ft", "10 ft first story"]);
  });

  it("ends at 81,250 cu ft: 4 stories and 8,125 sq ft", () => {
    expect(r.totals.volume).toBeCloseTo(81_250, 3);
    expect(r.floors.map((f) => [f.bottomFt, f.topFt, Math.round(f.plateSqFt)])).toEqual([
      [0, 10, 2500],
      [10, 20, 1875],
      [20, 30, 1875],
      [30, 40, 1875],
    ]);
    expect(r.totals.grossFloorAreaSqFt).toBeCloseTo(8125, 3);
  });

  it("gives non-residential uses a 2.5 FAR budget of 6,250 sq ft without cutting", () => {
    const far = step(r, "far");
    expect(far.status).toBe("info");
    expect(far.numbers).toEqual({ ratio: 2.5, lotAreaSqFt: 2500, budgetSqFt: 6250 });
    expect(far.sentence).toBe(
      "Floor area for non-residential uses: 2.5 to 1 for non-residential uses, so shops, offices and other non-residential floor area may total 2.5 × 2,500 sq ft = 6,250 sq ft. Homes don't count toward it.",
    );
    expect(far.removed).toBeNull();
  });

  it("flags the sidewalk setback, the ground-floor bonus and bulk", () => {
    for (const id of ["front-setback", "ground-floor-bonus", "bulk", "narrow-street", "cross-slope"]) {
      expect(step(r, id).status).toBe("not_modeled");
    }
  });
});

describe("fixture I: 25 x 100 ft NC-2 lot, 65-A", async () => {
  const engine = await getEngine();
  const r = ok(engine.computeEnvelope(syntheticLot(25, 100, { label: "65-A", heightFt: 65 }), loadDistrict("NC-2"), NO_SETBACK));

  it("draws a 14 ft first story outside 40 and 50 ft districts", () => {
    expect(step(r, "ground-floor").numbers.firstStoryFt).toBe(14);
    expect(step(r, "rear-yard").numbers.aboveFt).toBe(14);
  });

  it("ends at 130,625 cu ft: a 14 ft ground story, then 10 ft stories, 11,875 sq ft", () => {
    expect(r.totals.volume).toBeCloseTo(35_000 + 1875 * 51, 3);
    expect(r.floors.map((f) => [f.bottomFt, f.topFt])).toEqual([
      [0, 14],
      [14, 24],
      [24, 34],
      [34, 44],
      [44, 54],
      [54, 64],
    ]);
    expect(r.totals.grossFloorAreaSqFt).toBeCloseTo(2500 + 5 * 1875, 3);
  });
});

describe("fixture J: 25 x 100 ft RM-1 lot, 40-X, no front setback", async () => {
  const engine = await getEngine();
  const r = ok(engine.computeEnvelope(rectangularLot(25, 100), loadDistrict("RM-1"), NO_SETBACK));

  it("takes a 30 ft rear yard at every level, with no slope cap or front plane", () => {
    expect(step(r, "rear-yard").numbers.rearYardFt).toBe(30);
    expect(step(r, "rear-yard").measurements.footprintSqFt).toBeCloseTo(1750, 3);
    expect(r.steps.map((s) => s.rule.id)).not.toContain("front-plane");
    expect(r.steps.map((s) => s.rule.id)).not.toContain("rh-dwelling-height");
  });

  it("ends at 70,000 cu ft: 4 stories and 7,000 sq ft, with a 4,500 sq ft non-residential budget", () => {
    expect(r.totals.volume).toBeCloseTo(70_000, 3);
    expect(r.floors.map((f) => Math.round(f.plateSqFt))).toEqual([1750, 1750, 1750, 1750]);
    expect(step(r, "far").numbers.budgetSqFt).toBeCloseTo(4500, 6);
  });
});

describe("other RM and NC lots", async () => {
  const engine = await getEngine();
  const envelope = (district: string, heightFt = 40, options = {}) =>
    ok(engine.computeEnvelope(syntheticLot(25, 100, { label: `${heightFt}-X`, heightFt }), loadDistrict(district), { ...NO_SETBACK, ...options }));

  it("keeps NC-1's rear yard open from the ground up", () => {
    const r = envelope("NC-1");
    expect(step(r, "rear-yard").numbers.aboveFt).toBeUndefined();
    expect(r.totals.volume).toBeCloseTo(25 * 75 * 40, 3);
  });

  it("starts NC-3's and NC-S's rear yards above the first story", () => {
    for (const code of ["NC-3", "NC-S"]) expect(envelope(code).totals.volume).toBeCloseTo(81_250, 3);
  });

  it("uses the 10 ft first story in a 50 ft district too", () => {
    expect(step(envelope("NC-2", 50), "ground-floor").numbers.firstStoryFt).toBe(10);
  });

  it("uses RM-3's and RM-4's 25% rear yards and their FAR", () => {
    expect(step(envelope("RM-3"), "rear-yard").numbers.rearYardFt).toBe(25);
    expect(step(envelope("RM-3"), "far").numbers.ratio).toBe(3.6);
    expect(step(envelope("RM-4"), "far").numbers.budgetSqFt).toBeCloseTo(4.8 * 2500, 6);
  });

  it("says so, rather than guessing, when the height label can't be read", () => {
    const lot = syntheticLot(25, 100, { label: "20/160-IB", heightFt: 0 });
    lot.heightZones[0]!.heightFt = null;
    expect(() => engine.computeEnvelope(lot, loadDistrict("NC-2"))).toThrow(UnreadableHeightError);
    expect(() => engine.computeEnvelope(lot, loadDistrict("NC-2"))).toThrow("This lot's height district (20/160-IB) can't be read");
  });

  it("drops the budget when the FAR rule is switched off", () => {
    const far = step(envelope("NC-2", 40, { disabledRuleIds: ["far"] }), "far");
    expect(far.status).toBe("disabled");
    expect(far.numbers).toEqual({});
  });
});

describe("district schema for the new kinds", () => {
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
  const ground = rule({ id: "ground", kind: "ground_story", params: { minFloorToFloorFeet: 14 } });
  const rear = rule({ id: "rear", kind: "rear_yard", params: { pctOfLotDepth: 0.25, minFeet: 15, appliesAt: "above_first_story" } });

  it("accepts a rear yard above the first story after a ground_story rule", () => {
    expect(parseDistrictFile(file([ground, rear])).rules[0]).toMatchObject({ params: { exceptions: [] } });
  });

  it.each([
    ["without a ground_story rule", [rear]],
    ["before the ground_story rule", [rear, ground]],
  ])("refuses a rear yard above the first story %s", (_, rules) => {
    expect(() => parseDistrictFile(file(rules))).toThrow(/ground_story rule before it/);
  });

  it("refuses a FAR for residential floor area", () => {
    expect(() => parseDistrictFile(file([rule({ kind: "far", params: { ratio: 1.8, appliesTo: "residential" } })]))).toThrow(/appliesTo/);
  });
});
