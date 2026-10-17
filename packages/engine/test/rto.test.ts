import { describe, expect, it } from "vitest";
import { syntheticLot, type EnvelopeOptions, type EnvelopeResult, type ParcelInput, type Step } from "../src";
import { getEngine, loadDistrict, rectangularLot } from "./helpers";

// RTO districts (Table 209.4). Fixtures U and V are hand-checked.
const NO_SETBACK = { overrides: { "front-setback": { feet: 0 } } };
const ON = { ...NO_SETBACK, localProgram: true };

type Ok = Extract<EnvelopeResult, { status: "ok" }>;
function ok(result: EnvelopeResult): Ok {
  if (result.status !== "ok") throw new Error(`expected an envelope, got ${result.status}`);
  return result;
}
const step = (r: Ok, id: string): Step => r.steps.find((s) => s.rule.id === id)!;
const plates = (r: Ok) => r.floors.map((f) => Math.round(f.plateSqFt));
const r4Lot = (base: number, local: number) =>
  syntheticLot(25, 100, { label: `${base}//${local}-R-4`, heightFt: base, localProgramHeightFt: local, bulk: "R-4" });

const engine = await getEngine();
const envelope = (input: ParcelInput, district: string, options: EnvelopeOptions = NO_SETBACK) =>
  ok(engine.computeEnvelope(input, loadDistrict(district), options));

describe("fixture U: 25 x 100 ft RTO-C lot, 40-X, no front setback", () => {
  const r = envelope(rectangularLot(25, 100), "RTO-C");

  it("takes a 25 ft rear yard at every level, since no first-story height is set", () => {
    const rear = step(r, "rear-yard");
    expect(rear.numbers).toMatchObject({ pctOfLotDepth: 0.25, minFeet: 15, rearYardFt: 25 });
    expect(rear.numbers.aboveFt).toBeUndefined();
    expect(rear.measurements.removedVolume).toBeCloseTo(25 * 25 * 40, 3);
    expect(rear.measurements.footprintSqFt).toBeCloseTo(1875, 3);
  });

  it("has no side yards, dwelling cap, front plane or ground-floor rule, and flags the sidewalk setback", () => {
    const ids = r.steps.map((s) => s.rule.id);
    for (const id of ["side-yards", "rh-dwelling-height", "front-plane", "ground-floor", "front-modulation"]) expect(ids).not.toContain(id);
    expect(step(r, "sidewalk-setback").status).toBe("not_modeled");
  });

  it("ends at 75,000 cu ft: 4 stories and 7,500 sq ft, with a 4,500 sq ft non-residential budget", () => {
    expect(r.totals.volume).toBeCloseTo(75_000, 3);
    expect(plates(r)).toEqual([1875, 1875, 1875, 1875]);
    expect(r.totals.grossFloorAreaSqFt).toBeCloseTo(7500, 3);
    expect(step(r, "far").numbers.budgetSqFt).toBeCloseTo(4500, 6);
  });
});

describe("RTO-1 and RTO-M", () => {
  it("take a 30 ft rear yard at every level, like RM-1 (fixture J)", () => {
    for (const code of ["RTO-1", "RTO-M"]) {
      const r = envelope(rectangularLot(25, 100), code);
      expect(step(r, "rear-yard").numbers.rearYardFt).toBe(30);
      expect(r.totals.volume).toBeCloseTo(70_000, 3);
    }
  });
});

describe("fixture V: 25 x 100 ft RTO-C lot, 40//65-R-4, Housing Choice-SF on", () => {
  const on = envelope(r4Lot(40, 65), "RTO-C", ON);

  it("builds to 65 ft from a 130 ft starting block", () => {
    expect(on.start.heightFt).toBe(130);
    expect(step(on, "mapped-height").numbers).toEqual({ heightFt: 65, localProgramHeightFt: 65, baseHeightFt: 40 });
  });

  it("takes the program's 18% rear yard at every level, citing both sections", () => {
    const rear = step(on, "rear-yard");
    expect(rear.numbers).toMatchObject({ pctOfLotDepth: 0.18, minFeet: 15, rearYardFt: 18 });
    expect(rear.numbers.aboveFt).toBeUndefined();
    expect(rear.rule.citation).toMatch(/; §206\.10\(d\)\(1\)\(E\)\(i\)–\(ii\)$/);
  });

  it("leaves bulk to the 85 ft podium", () => {
    expect(step(on, "bulk").status).toBe("not_applicable");
  });

  it("ends at 133,250 cu ft and 12,300 sq ft (75,000 cu ft without the program)", () => {
    expect(on.totals.volume).toBeCloseTo(25 * 82 * 65, 3);
    expect(plates(on)).toEqual([2050, 2050, 2050, 2050, 2050, 2050]);
    expect(on.totals.grossFloorAreaSqFt).toBeCloseTo(12_300, 3);
    expect(envelope(r4Lot(40, 65), "RTO-C").totals.volume).toBeCloseTo(75_000, 3);
  });

  it("keeps RTO-1's 30% rear yard under the program, which changes only RTO-C's (§206.10(d)(1)(E)(i))", () => {
    const rto1 = envelope(r4Lot(40, 65), "RTO-1", ON);
    expect(step(rto1, "rear-yard").numbers.rearYardFt).toBe(30);
    expect(rto1.totals.volume).toBeCloseTo(25 * 70 * 65, 3);
  });
});
