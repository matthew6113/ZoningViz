import { describe, expect, it } from "vitest";
import { syntheticLot, type EnvelopeResult, type Step } from "../src";
import { getEngine, loadDistrict, rectangularLot } from "./helpers";

// Named neighborhood commercial districts (Article 7 tables). Fixtures W, X and Y are hand-checked.
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
const r4Envelope = (district: string) =>
  ok(engine.computeEnvelope(
    syntheticLot(25, 100, { label: "40//65-R-4", heightFt: 40, localProgramHeightFt: 65, bulk: "R-4" }),
    loadDistrict(district),
    { ...NO_SETBACK, localProgram: true },
  ));

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

describe("fixture X: 25 x 100 ft Inner Sunset lot, 40-X", () => {
  const r = envelope("NCD-INNER SUNSET");

  it("takes a 25 ft rear yard at grade and every story (§134(d)(1)), with a 10 ft first story", () => {
    const rear = step(r, "rear-yard");
    expect(rear.numbers).toMatchObject({ rearYardFt: 25 });
    expect(rear.numbers.aboveFt).toBeUndefined();
    expect(rear.measurements.removedVolume).toBeCloseTo(25 * 25 * 40, 3);
    expect(step(r, "ground-floor").numbers.firstStoryFt).toBe(10);
  });

  it("ends at 75,000 cu ft: 4 stories of 1,875 sq ft, with a 4,500 sq ft non-residential budget", () => {
    expect(r.totals.volume).toBeCloseTo(75_000, 3);
    expect(r.floors.map((f) => [f.bottomFt, f.topFt])).toEqual([[0, 10], [10, 20], [20, 30], [30, 40]]);
    expect(plates(r)).toEqual([1875, 1875, 1875, 1875]);
    expect(step(r, "far").numbers.budgetSqFt).toBeCloseTo(1.8 * 2500, 6);
    expect(r.steps.map((s) => s.rule.id)).not.toContain("ground-floor-bonus");
  });

  it("under Housing Choice-SF takes the program's 18% yard above the first story, as fixture Q", () => {
    const on = r4Envelope("NCD-INNER SUNSET");
    expect(step(on, "rear-yard").numbers).toMatchObject({ rearYardFt: 18, aboveFt: 14 });
    expect(on.totals.volume).toBeCloseTo(139_550, 3);
  });
});

describe("named districts, batch 2", () => {
  it("Polk and Union: the NCD first story and rear yard of fixture H; FAR 2.5 and 3.0; no ground-floor bonus", () => {
    for (const [code, ratio] of [["NCD-POLK", 2.5], ["NCD-UNION", 3]] as const) {
      const r = envelope(code);
      expect(step(r, "rear-yard").numbers).toMatchObject({ rearYardFt: 25, aboveFt: 10 });
      expect(r.totals.volume).toBeCloseTo(81_250, 3);
      expect(step(r, "far").numbers.budgetSqFt).toBeCloseTo(ratio * 2500, 6);
      expect(r.steps.map((s) => s.rule.id)).not.toContain("ground-floor-bonus");
    }
  });

  it("Taraval: fixture H's shape, FAR 2.5, the ground-floor bonus flagged", () => {
    const r = envelope("NCD-TARAVAL");
    expect(r.totals.volume).toBeCloseTo(81_250, 3);
    expect(step(r, "far").numbers.budgetSqFt).toBeCloseTo(2.5 * 2500, 6);
    expect(step(r, "ground-floor-bonus").status).toBe("not_modeled");
  });

  it("Hayes-Gough NCT: fixture W's 14 ft first story and 83,750 cu ft; FAR 3.0", () => {
    const r = envelope("NCT-HAYES");
    expect(step(r, "ground-floor").numbers.firstStoryFt).toBe(14);
    expect(r.totals.volume).toBeCloseTo(83_750, 3);
    expect(step(r, "far").numbers.budgetSqFt).toBeCloseTo(3 * 2500, 6);
  });
});

describe("named districts, batch 3", () => {
  it("24th Street – Noe Valley: fixture X's ground-level rear yard and 75,000 cu ft; FAR 1.8; the bonus flagged", () => {
    const r = envelope("NCD-24TH-NOE-VALLEY");
    expect(step(r, "rear-yard").numbers.aboveFt).toBeUndefined();
    expect(r.totals.volume).toBeCloseTo(75_000, 3);
    expect(step(r, "far").numbers.budgetSqFt).toBeCloseTo(1.8 * 2500, 6);
    expect(step(r, "ground-floor-bonus").status).toBe("not_modeled");
  });

  it("Inner Clement, Mission Bernal and San Bruno Avenue: fixture H's shape; FAR 1.8, 3.6 and 2.5", () => {
    for (const [code, ratio] of [["NCD-INNER CLEMENT", 1.8], ["NCD-MISSION BERNAL", 3.6], ["NCD-SAN BRUNO AVENUE", 2.5]] as const) {
      const r = envelope(code);
      expect(step(r, "rear-yard").numbers).toMatchObject({ rearYardFt: 25, aboveFt: 10 });
      expect(r.totals.volume).toBeCloseTo(81_250, 3);
      expect(step(r, "far").numbers.budgetSqFt).toBeCloseTo(ratio * 2500, 6);
    }
  });

  it("Divisadero Street NCT: fixture W's 14 ft first story and 83,750 cu ft; FAR 2.5", () => {
    const r = envelope("NCT-DIVISADERO");
    expect(step(r, "ground-floor").numbers.firstStoryFt).toBe(14);
    expect(r.totals.volume).toBeCloseTo(83_750, 3);
    expect(step(r, "far").numbers.budgetSqFt).toBeCloseTo(2.5 * 2500, 6);
  });
});

describe("fixture Y: 25 x 100 ft Upper Market Street NCT lot, 40-X", () => {
  const r = envelope("NCT-UPPER MARKET");

  it("takes a 25 ft rear yard at grade and every story (§134(d)(4)) under a 14 ft first story", () => {
    expect(step(r, "rear-yard").numbers.aboveFt).toBeUndefined();
    expect(step(r, "rear-yard").measurements.removedVolume).toBeCloseTo(25 * 25 * 40, 3);
    expect(step(r, "ground-floor").numbers.firstStoryFt).toBe(14);
  });

  it("ends at 75,000 cu ft: stories from 0, 14, 24 and 34 ft of 1,875 sq ft each; FAR 3.0", () => {
    expect(r.totals.volume).toBeCloseTo(75_000, 3);
    expect(r.floors.map((f) => [f.bottomFt, f.topFt])).toEqual([[0, 14], [14, 24], [24, 34], [34, 44]]);
    expect(plates(r)).toEqual([1875, 1875, 1875, 1875]);
    expect(step(r, "far").numbers.budgetSqFt).toBeCloseTo(3 * 2500, 6);
  });
});

describe("named districts, batch 4", () => {
  it("Outer Clement: fixture X's ground-level rear yard and 75,000 cu ft; FAR 1.8; the bonus flagged", () => {
    const r = envelope("NCD-OUTER CLEMENT");
    expect(step(r, "rear-yard").numbers.aboveFt).toBeUndefined();
    expect(r.totals.volume).toBeCloseTo(75_000, 3);
    expect(step(r, "far").numbers.budgetSqFt).toBeCloseTo(1.8 * 2500, 6);
    expect(step(r, "ground-floor-bonus").status).toBe("not_modeled");
  });

  it("Upper Fillmore and Noriega: fixture H's shape; FAR 2.5; only Noriega flags the bonus", () => {
    for (const code of ["NCD-UPPER FILLMORE", "NCD-NORIEGA"]) {
      const r = envelope(code);
      expect(step(r, "rear-yard").numbers).toMatchObject({ rearYardFt: 25, aboveFt: 10 });
      expect(r.totals.volume).toBeCloseTo(81_250, 3);
      expect(step(r, "far").numbers.budgetSqFt).toBeCloseTo(2.5 * 2500, 6);
    }
    expect(envelope("NCD-UPPER FILLMORE").steps.map((s) => s.rule.id)).not.toContain("ground-floor-bonus");
    expect(step(envelope("NCD-NORIEGA"), "ground-floor-bonus").status).toBe("not_modeled");
  });

  it("24th Street - Mission NCT: fixture W's 14 ft first story and 83,750 cu ft; FAR 2.5", () => {
    const r = envelope("NCT-24TH-MISSION");
    expect(step(r, "ground-floor").numbers.firstStoryFt).toBe(14);
    expect(r.totals.volume).toBeCloseTo(83_750, 3);
    expect(step(r, "far").numbers.budgetSqFt).toBeCloseTo(2.5 * 2500, 6);
  });
});

describe("named districts, batch 5", () => {
  it("Haight and Pacific: fixture X's ground-level rear yard and 75,000 cu ft; FAR 1.8 and 1.5; no ground-floor bonus", () => {
    for (const [code, ratio] of [["NCD-HAIGHT", 1.8], ["NCD-PACIFIC", 1.5]] as const) {
      const r = envelope(code);
      expect(step(r, "rear-yard").numbers.aboveFt).toBeUndefined();
      expect(r.totals.volume).toBeCloseTo(75_000, 3);
      expect(step(r, "far").numbers.budgetSqFt).toBeCloseTo(ratio * 2500, 6);
      expect(r.steps.map((s) => s.rule.id)).not.toContain("ground-floor-bonus");
    }
  });

  it("Castro and Bayview: fixture H's shape; FAR 3.0 and 3.6; the bonus flagged", () => {
    for (const [code, ratio] of [["NCD-CASTRO", 3], ["NCD-BAYVIEW", 3.6]] as const) {
      const r = envelope(code);
      expect(step(r, "rear-yard").numbers).toMatchObject({ rearYardFt: 25, aboveFt: 10 });
      expect(r.totals.volume).toBeCloseTo(81_250, 3);
      expect(step(r, "far").numbers.budgetSqFt).toBeCloseTo(ratio * 2500, 6);
      expect(step(r, "ground-floor-bonus").status).toBe("not_modeled");
    }
  });

  it("Ocean Avenue NCT: fixture W's 14 ft first story and 83,750 cu ft; FAR 2.5", () => {
    const r = envelope("NCT-OCEAN");
    expect(step(r, "ground-floor").numbers.firstStoryFt).toBe(14);
    expect(r.totals.volume).toBeCloseTo(83_750, 3);
    expect(step(r, "far").numbers.budgetSqFt).toBeCloseTo(2.5 * 2500, 6);
  });
});
