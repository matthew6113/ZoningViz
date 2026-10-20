import { describe, expect, it } from "vitest";
import { syntheticLot, type EnvelopeResult, type Step } from "../src";
import { getEngine, loadDistrict } from "./helpers";

// RC-3 and RC-4 (Table 209.3), RED and RED-MX (Tables 834 and 835) on a 25 x 100 ft lot.
type Ok = Extract<EnvelopeResult, { status: "ok" }>;
function ok(result: EnvelopeResult): Ok {
  if (result.status !== "ok") throw new Error(`expected an envelope, got ${result.status}`);
  return result;
}
const step = (r: Ok, id: string): Step => r.steps.find((s) => s.rule.id === id)!;

const engine = await getEngine();
const envelope = (district: string) =>
  ok(engine.computeEnvelope(syntheticLot(25, 100, { label: "40-X", heightFt: 40, bulk: "X" }), loadDistrict(district), {}));
const r4Envelope = (district: string) =>
  ok(engine.computeEnvelope(
    syntheticLot(25, 100, { label: "40//65-R-4", heightFt: 40, localProgramHeightFt: 65, bulk: "R-4" }),
    loadDistrict(district),
    { localProgram: true },
  ));

describe("RC-3 and RC-4", () => {
  it("take fixture H's shape: a 10 ft first story at 40 ft and the rear yard above it; FAR 3.6 and 4.8", () => {
    for (const [code, ratio] of [["RC-3", 3.6], ["RC-4", 4.8]] as const) {
      const r = envelope(code);
      expect(step(r, "ground-floor").numbers.firstStoryFt).toBe(10);
      expect(step(r, "rear-yard").numbers).toMatchObject({ rearYardFt: 25, aboveFt: 10 });
      expect(r.totals.volume).toBeCloseTo(81_250, 3);
      expect(step(r, "far").numbers.budgetSqFt).toBeCloseTo(ratio * 2500, 6);
      expect(r.steps.map((s) => s.rule.id)).not.toContain("front-setback");
    }
  });

  it("under Housing Choice-SF take fixture Q's 18% yard above the first story (§206.10(d)(1)(E)(i)–(ii))", () => {
    for (const code of ["RC-3", "RC-4"]) {
      const on = r4Envelope(code);
      expect(step(on, "rear-yard").numbers).toMatchObject({ rearYardFt: 18, aboveFt: 14 });
      expect(on.totals.volume).toBeCloseTo(139_550, 3);
    }
  });
});

describe("RED and RED-MX", () => {
  it("keep the rear yard at ground level (§134(d)(5)): 75,000 cu ft; FAR 1.0", () => {
    const r = envelope("RED");
    expect(step(r, "rear-yard").rule.params).toMatchObject({ appliesAt: "grade_and_every_story" });
    expect(r.totals.volume).toBeCloseTo(75_000, 3);
    expect(r.floors.map((f) => [f.bottomFt, f.topFt])).toEqual([[0, 10], [10, 20], [20, 30], [30, 40]]);
    expect(step(r, "far").numbers.budgetSqFt).toBeCloseTo(2500, 6);
    expect(step(r, "large-lots").status).toBe("not_modeled");
  });

  it("RED-MX draws a 14 ft first story (§145.1(c)(4)(B)) under the same yard", () => {
    const r = envelope("RED-MX");
    expect(step(r, "ground-floor").numbers.firstStoryFt).toBe(14);
    expect(r.totals.volume).toBeCloseTo(75_000, 3);
    expect(r.floors.map((f) => [f.bottomFt, f.topFt])).toEqual([[0, 14], [14, 24], [24, 34], [34, 44]]);
  });

  it("under Housing Choice-SF take fixture V's 18% yard at every level: 133,250 cu ft", () => {
    for (const code of ["RED", "RED-MX"]) {
      const on = r4Envelope(code);
      expect(step(on, "rear-yard").numbers).toMatchObject({ rearYardFt: 18 });
      expect(on.totals.volume).toBeCloseTo(133_250, 3);
    }
  });
});
