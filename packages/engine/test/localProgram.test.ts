import type { MultiPolygon } from "geojson";
import { describe, expect, it } from "vitest";
import { parseDistrictFile, syntheticLot, type EnvelopeOptions, type EnvelopeResult, type ParcelInput, type Step } from "../src";
import { getEngine, loadDistrict, rectangularLot, slopedLot, withHeightDistrict } from "./helpers";

// A local program (SF: Housing Choice-SF on R-4 lots) switched on: the zone's
// local-program height governs, at least the program's minimum on corner and
// large lots, and the district's waived and replaced rules change. Fixtures
// O–T are hand-checked.
const NO_SETBACK = { overrides: { "front-setback": { feet: 0 } } };
const ON = { ...NO_SETBACK, localProgram: true };

type Ok = Extract<EnvelopeResult, { status: "ok" }>;
function ok(result: EnvelopeResult): Ok {
  if (result.status !== "ok") throw new Error(`expected an envelope, got ${result.status}`);
  return result;
}
const step = (r: Ok, id: string): Step => r.steps.find((s) => s.rule.id === id)!;
const plates = (r: Ok) => r.floors.map((f) => Math.round(f.plateSqFt));

/** An R-4 lot: `base` ft without the program, `local` ft with it. */
const r4Lot = (width: number, depth: number, base: number, local: number, streets?: "front_and_left" | "front_and_rear") =>
  syntheticLot(width, depth, { label: `${base}//${local}-R-4`, heightFt: base, localProgramHeightFt: local, bulk: "R-4" }, { streets });

const engine = await getEngine();
const envelope = (input: ParcelInput, district: string, options: EnvelopeOptions = ON) =>
  ok(engine.computeEnvelope(input, loadDistrict(district), options));

describe("fixture O: 25 x 100 ft RH-2 lot, 40//40-R-4", () => {
  const on = envelope(r4Lot(25, 100, 40, 40), "RH-2");
  const off = envelope(r4Lot(25, 100, 40, 40), "RH-2", NO_SETBACK);

  it("keeps 40 ft and waives the RH-2 dwelling cap and the front height plane", () => {
    expect(step(on, "mapped-height").sentence).toBe("Height limit: 40 ft under Housing Choice-SF (40//40-R-4; the same without it).");
    for (const id of ["rh-dwelling-height", "front-plane"]) {
      expect(step(on, id).status).toBe("not_applicable");
      expect(step(on, id).removed).toBeNull();
    }
    expect(step(on, "front-plane").sentence).toBe(
      "Front height plane: doesn't apply under Housing Choice-SF. Section 261 doesn't apply to Housing Choice-SF projects (§206.10(d)(1)(C)).",
    );
  });

  it("says what changed on the program's card", () => {
    const card = step(on, "local-program");
    expect(card.status).toBe("info");
    expect(card.numbers).toEqual({ programHeightFt: 40, baseHeightFt: 40 });
    expect(card.sentence).toMatch(
      /^Housing Choice-SF: on\. Under it, the height limit stays 40 ft; the RH-2 dwelling cap and the front height plane don't apply \(§206\.10\(d\)\(1\)\(C\)\)\. This assumes a project that adds homes .*\. Not drawn: the optional height bonuses/,
    );
  });

  it("ends at 70,000 cu ft and 7,000 sq ft (68,750 and 6,875 without the program)", () => {
    expect(on.totals.volume).toBeCloseTo(25 * 70 * 40, 3);
    expect(plates(on)).toEqual([1750, 1750, 1750, 1750]);
    expect(off.totals.volume).toBeCloseTo(68_750, 3);
    expect(off.totals.grossFloorAreaSqFt).toBeCloseTo(6875, 3);
  });

  it("says what the program would change when it's off", () => {
    const card = step(off, "local-program");
    expect(card.status).toBe("info");
    expect(card.sentence).toBe(
      "Housing Choice-SF: off. Under it, the height limit would stay 40 ft; the RH-2 dwelling cap and the front height plane wouldn't apply (§206.10(d)(1)(C)). Turn it on to see that envelope.",
    );
    expect(step(off, "front-plane").status).toBe("cut");
  });
});

describe("fixture P: 25 x 100 ft RH-1 lot, 40//40-R-4", () => {
  it("drops the 35 ft dwelling cap: 60,937.5 → 70,000 cu ft, 3 → 4 stories", () => {
    const off = envelope(r4Lot(25, 100, 40, 40), "RH-1", NO_SETBACK);
    const on = envelope(r4Lot(25, 100, 40, 40), "RH-1");
    expect(off.totals.volume).toBeCloseTo(25 * 70 * 35 - 25 * 12.5, 3);
    expect(off.totals.grossFloorAreaSqFt).toBeCloseTo(5250, 3);
    expect(step(on, "rh-dwelling-height").status).toBe("not_applicable");
    expect(on.totals.volume).toBeCloseTo(70_000, 3);
    expect(on.totals.grossFloorAreaSqFt).toBeCloseTo(7000, 3);
  });
});

describe("fixture Q: 25 x 100 ft NC-2 lot, 40//65-R-4", () => {
  const on = envelope(r4Lot(25, 100, 40, 65), "NC-2");

  it("builds to 65 ft from a 130 ft starting block", () => {
    expect(on.start.heightFt).toBe(130);
    expect(step(on, "mapped-height").sentence).toBe("Height limit: 65 ft under Housing Choice-SF (40//65-R-4; 40 ft without it).");
    expect(step(on, "mapped-height").numbers).toEqual({ heightFt: 65, localProgramHeightFt: 65, baseHeightFt: 40 });
  });

  it("uses the 14 ft first story outside 40 and 50 ft districts", () => {
    expect(step(on, "ground-floor").numbers.firstStoryFt).toBe(14);
  });

  it("takes the program's 18% rear yard above the first story, citing both sections", () => {
    const rear = step(on, "rear-yard");
    expect(rear.numbers).toMatchObject({ pctOfLotDepth: 0.18, minFeet: 15, rearYardFt: 18, aboveFt: 14 });
    expect(rear.rule.citation).toMatch(/; §206\.10\(d\)\(1\)\(E\)\(i\)–\(ii\)$/);
    expect(rear.measurements.removedVolume).toBeCloseTo(25 * 18 * (65 - 14), 3);
  });

  it("leaves bulk to the 85 ft podium", () => {
    expect(step(on, "bulk").status).toBe("not_applicable");
  });

  it("ends at 139,550 cu ft and 12,750 sq ft (fixture H without the program)", () => {
    expect(on.totals.volume).toBeCloseTo(35_000 + 25 * 82 * 51, 3);
    expect(plates(on)).toEqual([2500, 2050, 2050, 2050, 2050, 2050]);
    expect(on.totals.grossFloorAreaSqFt).toBeCloseTo(12_750, 3);
    expect(envelope(r4Lot(25, 100, 40, 65), "NC-2", NO_SETBACK).totals.volume).toBeCloseTo(81_250, 3);
  });
});

describe("fixture R: 100 x 100 ft RH-2 lot, 40//40-R-4 (larger than 8,000 sq ft)", () => {
  const on = envelope(r4Lot(100, 100, 40, 40), "RH-2");

  it("raises the lot to the program's 65 ft minimum", () => {
    const card = step(on, "local-program");
    expect(card.numbers).toEqual({ programHeightFt: 65, baseHeightFt: 40, minHeightFt: 65 });
    expect(card.sentence).toMatch(/the height limit is 65 ft instead of 40 ft \(at least 65 ft, because this lot is larger than 8,000 sq ft\)/);
  });

  it("ends at 455,000 cu ft and 42,000 sq ft (275,000 and 27,500 without the program)", () => {
    expect(on.totals.volume).toBeCloseTo(100 * 70 * 65, 2);
    expect(plates(on)).toEqual([7000, 7000, 7000, 7000, 7000, 7000]);
    const off = envelope(r4Lot(100, 100, 40, 40), "RH-2", NO_SETBACK);
    expect(off.totals.volume).toBeCloseTo(100 * 70 * 40 - 100 * 50, 2);
    expect(off.totals.grossFloorAreaSqFt).toBeCloseTo(27_500, 2);
  });
});

describe("fixture S: 80 x 100 ft RH-2 lot, 40//40-R-4 (exactly 8,000 sq ft)", () => {
  it("isn't larger than 8,000 sq ft, so it stays at 40 ft", () => {
    const on = envelope(r4Lot(80, 100, 40, 40), "RH-2");
    expect(step(on, "local-program").numbers.minHeightFt).toBeUndefined();
    expect(on.totals.volume).toBeCloseTo(80 * 70 * 40, 2);
  });
});

describe("fixture T: corner and through lots, 25 x 100 ft RH-2, 40//40-R-4", () => {
  const frontOn = (input: ParcelInput, lengthFt: number) => {
    const prompt = engine.computeEnvelope(input, loadDistrict("RH-2"), ON);
    if (prompt.status !== "needs_front_choice") throw new Error("expected a front prompt");
    return prompt.candidates.findIndex((c) => Math.abs(c.lengthFt - lengthFt) < 1e-6);
  };

  it("raises a corner lot to 65 ft: 113,750 cu ft", () => {
    const lot = r4Lot(25, 100, 40, 40, "front_and_left");
    const on = envelope(lot, "RH-2", { ...ON, frontSide: frontOn(lot, 25) });
    expect(step(on, "local-program").sentence).toMatch(/\(at least 65 ft, because this lot is a corner lot \(two of its street sides meet at an angle on the parcel map\)\)/);
    expect(on.totals.volume).toBeCloseTo(25 * 70 * 65, 3);
  });

  it("keeps a through lot (streets in front and behind) at 40 ft", () => {
    const lot = r4Lot(25, 100, 40, 40, "front_and_rear");
    const on = envelope(lot, "RH-2", { ...ON, frontSide: frontOn(lot, 25) });
    expect(step(on, "local-program").numbers.minHeightFt).toBeUndefined();
    expect(on.totals.volume).toBeCloseTo(70_000, 3);
  });
});

describe("other lots", () => {
  it("doesn't apply on a lot with no local-program height, and changes nothing", () => {
    const on = envelope(rectangularLot(25, 100), "RH-2");
    const card = step(on, "local-program");
    expect(card.status).toBe("not_applicable");
    expect(card.sentence).toBe("Housing Choice-SF: doesn't apply, because no part of this lot has a local-program height.");
    expect(step(on, "front-plane").status).toBe("cut");
    expect(on.totals.volume).toBeCloseTo(envelope(rectangularLot(25, 100), "RH-2", NO_SETBACK).totals.volume, 6);
  });

  it("drops a downslope lot's slope cap: 40 ft from the curb (fixture F as 40//40-R-4)", () => {
    const lot = withHeightDistrict(slopedLot(25, 100, -25), "40//40-R-4", 40, "R-4");
    lot.heightZones[0]!.localProgramHeightFt = 40;
    expect(envelope(lot, "RH-1", NO_SETBACK).totals.volume).toBeCloseTo(67_812.5, 1);
    const on = envelope(lot, "RH-1");
    expect(step(on, "rh-dwelling-height").status).toBe("not_applicable");
    // 25 ft wide × (40 ft + the ground's fall, 0.25 ft per ft) over the 70 ft in front of the rear yard.
    expect(on.totals.volume).toBeCloseTo(25 * (40 * 70 + 0.125 * 70 ** 2), 1);
  });

  it("raises only the zone with a local-program height on a split lot", () => {
    const rect = (y0: number, y1: number): MultiPolygon => ({ type: "MultiPolygon", coordinates: [[[[0, y0], [25, y0], [25, y1], [0, y1], [0, y0]]]] });
    const base = rectangularLot(25, 100);
    const lot: ParcelInput = {
      ...base,
      heightZones: [
        { label: "40//65-R-4", heightFt: 40, localProgramHeightFt: 65, bulk: "R-4", geometry: rect(0, 50) },
        { label: "40-X", heightFt: 40, bulk: "X", geometry: rect(50, 100) },
      ],
    };
    const on = envelope(lot, "RM-1");
    expect(step(on, "mapped-height").sentence).toBe(
      "Height limit: the lot spans 2 height districts: 65 ft under Housing Choice-SF (40//65-R-4; 40 ft without it) on 50% of the lot; 40 ft (40-X) on 50% of the lot.",
    );
    // Zones overlap by a drawing tolerance at their shared line, so compare within 0.05%.
    expect(on.totals.volume / (25 * 50 * 65 + 25 * 20 * 40)).toBeCloseTo(1, 3);
  });

  it("stays off when its card is switched off", () => {
    const on = envelope(r4Lot(25, 100, 40, 65), "NC-2", { ...ON, disabledRuleIds: ["local-program"] });
    expect(step(on, "local-program").status).toBe("disabled");
    expect(on.totals.volume).toBeCloseTo(81_250, 3);
  });

  it("names the program in the height card while it's off", () => {
    const off = envelope(r4Lot(25, 100, 40, 65), "NC-2", NO_SETBACK);
    expect(step(off, "mapped-height").sentence).toBe(
      "Height limit: 40 ft (40//65-R-4; up to 65 ft under Housing Choice-SF, which isn't switched on).",
    );
  });
});

describe("local program schema", () => {
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
  const program = (params: Record<string, unknown> = {}, id = "program") =>
    rule({
      id,
      kind: "local_program",
      params: { minHeight: { feet: 65, onCornerLot: true, lotAreaOverSqFt: 8000 }, waives: [], replaces: [], assumes: "A", notDrawn: "N", ...params },
    });
  const waive = (ruleId: string) => ({ waives: [{ ruleId, because: "B", citation: "§2" }] });
  const height = rule({ id: "cap", kind: "height_cap", params: { feet: 35 } });
  const rear = rule({ id: "rear", kind: "rear_yard", params: { pctOfLotDepth: 0.3, minFeet: 15, appliesAt: "grade_and_every_story" } });
  const file = (rules: unknown[]) => ({ jurisdiction: "sf", district: "T", name: "Test", rules });

  it("accepts a program that waives and replaces later cutting rules", () => {
    const replaces = [{ ruleId: "rear", params: { pctOfLotDepth: 0.18, minFeet: 15, appliesAt: "grade_and_every_story" }, citation: "§3" }];
    expect(() => parseDistrictFile(file([program({ ...waive("cap"), replaces }), height, rear]))).not.toThrow();
  });

  it.each([
    ["a waiver of an unknown rule", [program(waive("nope")), height], /"nope" must name a later rule that cuts volume/],
    ["a waiver of an earlier rule", [height, program(waive("cap"))], /"cap" must name a later rule/],
    ["a waiver of a card-only rule", [program(waive("x")), rule({})], /"x" must name a later rule that cuts volume/],
    [
      "replacement params that don't fit the rule",
      [program({ replaces: [{ ruleId: "rear", params: { feet: 40 }, citation: "§3" }] }), rear],
      /don't fit a rear_yard rule/,
    ],
    [
      "a replaced rear yard above the first story with no ground_story rule",
      [program({ replaces: [{ ruleId: "rear", params: { pctOfLotDepth: 0.18, minFeet: 15, appliesAt: "above_first_story" }, citation: "§3" }] }), rear],
      /ground_story rule before it/,
    ],
    ["two programs", [program(), program({}, "other")], /only one local_program rule/],
  ])("refuses %s", (_, rules, message) => {
    expect(() => parseDistrictFile(file(rules))).toThrow(message);
  });
});
