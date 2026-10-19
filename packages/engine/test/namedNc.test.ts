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

describe("named districts, batch 6", () => {
  it("Sacramento and West Portal: fixture X's ground-level rear yard and 75,000 cu ft; FAR 1.8; no ground-floor bonus", () => {
    for (const code of ["NCD-SACRAMENTO", "NCD-WEST PORTAL"]) {
      const r = envelope(code);
      expect(step(r, "rear-yard").numbers.aboveFt).toBeUndefined();
      expect(r.totals.volume).toBeCloseTo(75_000, 3);
      expect(step(r, "far").numbers.budgetSqFt).toBeCloseTo(1.8 * 2500, 6);
      expect(r.steps.map((s) => s.rule.id)).not.toContain("ground-floor-bonus");
    }
  });

  it("Irving, Outer Balboa and Inner Taraval: fixture H's shape; FAR 2.5; the bonus flagged (40-X and 50-X only in the last two)", () => {
    for (const code of ["NCD-IRVING", "NCD-OUTER BALBOA STREET", "NCD-INNER TARAVAL STREET"]) {
      const r = envelope(code);
      expect(step(r, "rear-yard").numbers).toMatchObject({ rearYardFt: 25, aboveFt: 10 });
      expect(r.totals.volume).toBeCloseTo(81_250, 3);
      expect(step(r, "far").numbers.budgetSqFt).toBeCloseTo(2.5 * 2500, 6);
      expect(step(r, "ground-floor-bonus").status).toBe("not_modeled");
    }
    expect(step(envelope("NCD-INNER TARAVAL STREET"), "ground-floor-bonus").rule.plain).toContain("zoned 40-X or 50-X");
  });
});

describe("named districts, batch 7", () => {
  it("Cortland Avenue: fixture H's shape; FAR 2.5; the bonus flagged as the table words it", () => {
    const r = envelope("NCD-CORTLAND AVENUE");
    expect(step(r, "rear-yard").numbers).toMatchObject({ rearYardFt: 25, aboveFt: 10 });
    expect(r.totals.volume).toBeCloseTo(81_250, 3);
    expect(step(r, "far").numbers.budgetSqFt).toBeCloseTo(2.5 * 2500, 6);
    expect(step(r, "ground-floor-bonus").rule.plain).toContain('"in some districts"');
  });

  it("Fillmore, SoMa, Glen Park and Folsom NCTs: fixture W's 14 ft first story and 83,750 cu ft", () => {
    for (const [code, ratio] of [["NCT-FILLMORE", 3.6], ["NCT-SOMA", 2.5], ["NCT-GLEN PARK", 2.5], ["NCT-FOLSOM", 2.5]] as const) {
      const r = envelope(code);
      expect(step(r, "ground-floor").numbers.firstStoryFt).toBe(14);
      expect(step(r, "rear-yard").numbers).toMatchObject({ rearYardFt: 25, aboveFt: 14 });
      expect(r.totals.volume).toBeCloseTo(83_750, 3);
      expect(step(r, "far").numbers.budgetSqFt).toBeCloseTo(ratio * 2500, 6);
    }
    expect(envelope("NCT-FOLSOM").steps.map((s) => s.rule.id)).not.toContain("ground-floor-bonus");
  });
});

describe("named districts, batch 8", () => {
  it("Broadway, Japantown, Leland, Lower Haight and Judah: fixture H's shape at 40-X; FAR from each table", () => {
    for (const [code, ratio] of [["NCD-BROADWAY", 2.5], ["NCD-JAPANTOWN", 3.6], ["NCD-LELAND", 2.5], ["NCD-LOWER HAIGHT STREET", 2.5], ["NCD-JUDAH", 2.5]] as const) {
      const r = envelope(code);
      expect(step(r, "ground-floor").numbers.firstStoryFt).toBe(10);
      expect(step(r, "rear-yard").numbers).toMatchObject({ rearYardFt: 25, aboveFt: 10 });
      expect(r.totals.volume).toBeCloseTo(81_250, 3);
      expect(step(r, "far").numbers.budgetSqFt).toBeCloseTo(ratio * 2500, 6);
    }
    expect(envelope("NCD-BROADWAY").steps.map((s) => s.rule.id)).not.toContain("ground-floor-bonus");
  });

  it("Japantown flags the Buchanan Street setback after the sidewalk setback", () => {
    const r = envelope("NCD-JAPANTOWN", 50);
    const ids = r.steps.map((s) => s.rule.id);
    expect(ids.indexOf("buchanan-setback")).toBe(ids.indexOf("front-setback") + 1);
    expect(step(r, "buchanan-setback").status).toBe("not_modeled");
  });

  it("Leland's rear yard follows Table 746, which §134(d) doesn't list", () => {
    expect(step(envelope("NCD-LELAND"), "rear-yard").rule.citation).toBe("§134(c)(2); Table 746");
  });

  it("Lower Haight and Judah under Housing Choice-SF: fixture Q's 139,550 cu ft", () => {
    for (const code of ["NCD-LOWER HAIGHT STREET", "NCD-JUDAH"]) {
      const on = r4Envelope(code);
      expect(step(on, "rear-yard").numbers).toMatchObject({ rearYardFt: 18, aboveFt: 14 });
      expect(on.totals.volume).toBeCloseTo(139_550, 3);
    }
  });
});

describe("named districts, batch 9", () => {
  it("Inner Balboa and Lower Polk: fixture H's shape at 40-X; FAR 2.5 and 3.6", () => {
    for (const [code, ratio] of [["NCD-INNER BALBOA STREET", 2.5], ["NCD-LOWER POLK STREET", 3.6]] as const) {
      const r = envelope(code);
      expect(step(r, "rear-yard").numbers).toMatchObject({ rearYardFt: 25, aboveFt: 10 });
      expect(r.totals.volume).toBeCloseTo(81_250, 3);
      expect(step(r, "far").numbers.budgetSqFt).toBeCloseTo(ratio * 2500, 6);
    }
  });

  it("Lakeside Village and Cole Valley: fixture X's rear yard at grade; FAR 1.8; the bonus flagged as the tables word it", () => {
    for (const code of ["NCD-LAKESIDE VILLAGE", "NCD-COLE VALLEY"]) {
      const r = envelope(code);
      expect(step(r, "rear-yard").rule.params).toMatchObject({ appliesAt: "grade_and_every_story" });
      expect(r.totals.volume).toBeCloseTo(75_000, 3);
      expect(step(r, "far").numbers.budgetSqFt).toBeCloseTo(1.8 * 2500, 6);
      expect(step(r, "ground-floor-bonus").rule.plain).toContain('"in some districts"');
    }
  });

  it("under Housing Choice-SF all four take fixture Q's 139,550 cu ft", () => {
    for (const code of ["NCD-INNER BALBOA STREET", "NCD-LOWER POLK STREET", "NCD-LAKESIDE VILLAGE", "NCD-COLE VALLEY"]) {
      const on = r4Envelope(code);
      expect(step(on, "rear-yard").numbers).toMatchObject({ rearYardFt: 18, aboveFt: 14 });
      expect(on.totals.volume).toBeCloseTo(139_550, 3);
    }
  });
});
