import { describe, expect, it } from "vitest";
import type { EnvelopeResult, Step } from "../src";
import { getEngine, loadDistrict, rectangularLot } from "./helpers";

const RH2 = loadDistrict("RH-2");
const NO_SETBACK = { overrides: { "front-setback": { feet: 0 } } };

type Ok = Extract<EnvelopeResult, { status: "ok" }>;
function ok(result: EnvelopeResult): Ok {
  if (result.status !== "ok") throw new Error(`expected an envelope, got ${result.status}`);
  return result;
}
const step = (r: Ok, id: string): Step => r.steps.find((s) => s.rule.id === id)!;

describe("fixture A: 25 x 100 ft RH-2 lot, 40-X, no front setback", async () => {
  const engine = await getEngine();
  const r = ok(engine.computeEnvelope(rectangularLot(25, 100), RH2, NO_SETBACK));

  it("measures the lot", () => {
    expect(r.lot.widthFt).toBeCloseTo(25, 6);
    expect(r.lot.depthFt).toBeCloseTo(100, 6);
    expect(r.lot.approximate).toBe(false);
    expect(r.start.heightFt).toBe(80);
    expect(r.start.volume).toBeCloseTo(200_000, 3);
  });

  it("cuts to the 40 ft mapped height; the RH-2 40 ft cap is already satisfied", () => {
    expect(step(r, "mapped-height").status).toBe("cut");
    expect(step(r, "mapped-height").measurements.volume).toBeCloseTo(100_000, 3);
    expect(step(r, "rh-dwelling-height").status).toBe("already_satisfied");
    expect(step(r, "rh-dwelling-height").sentence).toMatch(/already satisfied/i);
  });

  it("takes a 30 ft rear yard, leaving a 1,750 sq ft footprint", () => {
    const rear = step(r, "rear-yard");
    expect(rear.numbers.rearYardFt).toBeCloseTo(30, 6);
    expect(rear.sentence).toBe("Rear yard: 30% of 100 ft lot depth = 30 ft.");
    expect(rear.measurements.footprintSqFt).toBeCloseTo(1750, 3);
  });

  it("removes 1,250 cu ft with the front height plane", () => {
    expect(step(r, "front-setback").status).toBe("already_satisfied");
    expect(step(r, "front-plane").measurements.removedVolume).toBeCloseTo(1250, 3);
  });

  it("ends at 68,750 cu ft, 4 stories and about 6,875 sq ft of floor area", () => {
    expect(r.totals.volume).toBeCloseTo(68_750, 3);
    expect(r.totals.footprintSqFt).toBeCloseTo(1750, 3);
    expect(r.totals.stories).toBe(4);
    expect(r.floors.map((f) => Math.round(f.plateSqFt))).toEqual([1750, 1750, 1750, 1625]);
    expect(r.totals.grossFloorAreaSqFt).toBeCloseTo(6875, 3);
  });

  it("shows info and flag rules as cards without geometry", () => {
    expect(step(r, "use").status).toBe("info");
    expect(step(r, "slope").status).toBe("not_modeled");
    expect(step(r, "slope").removed).toBeNull();
  });
});

describe("fixture B: 25 x 40 ft shallow RH-2 lot, 40-X", async () => {
  const engine = await getEngine();
  const r = ok(engine.computeEnvelope(rectangularLot(25, 40), RH2, NO_SETBACK));

  it("uses the 15 ft minimum because 30% is only 12 ft", () => {
    const rear = step(r, "rear-yard");
    expect(rear.numbers.rearYardFt).toBe(15);
    expect(rear.sentence).toBe("Rear yard: 30% of 40 ft lot depth = 12 ft, below the 15 ft minimum, so 15 ft.");
    expect(r.totals.footprintSqFt).toBeCloseTo(625, 3);
  });
});
