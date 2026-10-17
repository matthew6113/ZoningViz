import { describe, expect, it } from "vitest";
import { syntheticLot, type EnvelopeResult, type Step } from "../src";
import { getEngine, loadDistrict, rectangularLot } from "./helpers";

// Named neighborhood commercial districts (Article 7 tables). Fixture W is hand-checked.
const NO_SETBACK = { overrides: { "front-setback": { feet: 0 } } };

type Ok = Extract<EnvelopeResult, { status: "ok" }>;
function ok(result: EnvelopeResult): Ok {
  if (result.status !== "ok") throw new Error(`expected an envelope, got ${result.status}`);
  return result;
}
const step = (r: Ok, id: string): Step => r.steps.find((s) => s.rule.id === id)!;
const plates = (r: Ok) => r.floors.map((f) => Math.round(f.plateSqFt));

const engine = await getEngine();
const envelope = (district: string, heightFt = 40) =>
  ok(engine.computeEnvelope(syntheticLot(25, 100, { label: `${heightFt}-X`, heightFt, bulk: "X" }), loadDistrict(district), NO_SETBACK));

describe("fixture W: 25 x 100 ft Mission Street NCT lot, 40-X", () => {
  const r = envelope("NCT-MISSION");

  it("draws a 14 ft first story: NCT districts have no 10 ft exception (§145.1(c)(4)(B))", () => {
    const ground = step(r, "ground-floor");
    expect(ground.numbers.firstStoryFt).toBe(14);
    expect(ground.sentence).toBe(
      "Ground floor height: a shop or other non-residential ground floor must be at least 14 ft floor to floor, in every height district. " +
        "The first story is drawn 14 ft tall; a taller one is allowed.",
    );
  });

  it("takes a 25 ft rear yard from the first story's top up", () => {
    const rear = step(r, "rear-yard");
    expect(rear.numbers).toMatchObject({ rearYardFt: 25, aboveFt: 14 });
    expect(rear.measurements.removedVolume).toBeCloseTo(25 * 25 * (40 - 14), 3);
  });

  it("ends at 83,750 cu ft and 8,125 sq ft: stories from 0, 14, 24 and 34 ft (the last counts, its middle being under 40 ft)", () => {
    expect(r.totals.volume).toBeCloseTo(83_750, 3);
    expect(r.floors.map((f) => [f.bottomFt, f.topFt])).toEqual([[0, 14], [14, 24], [24, 34], [34, 44]]);
    expect(plates(r)).toEqual([2500, 1875, 1875, 1875]);
    expect(r.totals.grossFloorAreaSqFt).toBeCloseTo(8125, 3);
    expect(step(r, "far").numbers.budgetSqFt).toBeCloseTo(3.6 * 2500, 6);
  });
});

describe("other named districts", () => {
  it("North Beach: the 10 ft first story in a 40 ft district, FAR 1.8, no ground-floor bonus", () => {
    const r = envelope("NCD-NORTH BEACH");
    expect(step(r, "ground-floor").numbers.firstStoryFt).toBe(10);
    expect(r.totals.volume).toBeCloseTo(81_250, 3); // fixture H's shape
    expect(step(r, "far").numbers.budgetSqFt).toBeCloseTo(1.8 * 2500, 6);
    expect(r.steps.map((s) => s.rule.id)).not.toContain("ground-floor-bonus");
  });

  it("Valencia Street NCT: 14 ft even in a 40 ft district, FAR 2.5", () => {
    const r = envelope("NCT-VALENCIA");
    expect(step(r, "ground-floor").numbers.firstStoryFt).toBe(14);
    expect(step(r, "far").numbers.budgetSqFt).toBeCloseTo(2.5 * 2500, 6);
  });

  it("Excelsior and Geary: NC-2's and NC-3's rear yards above a 10 ft first story", () => {
    for (const code of ["NCD-EXCELSIOR", "NCD-GEARY BOULEVARD"]) {
      const r = envelope(code);
      expect(step(r, "rear-yard").numbers).toMatchObject({ rearYardFt: 25, aboveFt: 10 });
      expect(r.totals.volume).toBeCloseTo(81_250, 3);
    }
  });

  it("uses each district's own 14 ft minimum in a 65 ft district", () => {
    expect(step(envelope("NCD-EXCELSIOR", 65), "ground-floor").numbers.firstStoryFt).toBe(14);
    expect(rectangularLot(25, 100).heightZones[0]!.heightFt).toBe(40);
  });
});
