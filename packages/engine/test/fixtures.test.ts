import { describe, expect, it } from "vitest";
import type { EnvelopeResult, Step } from "../src";
import { getEngine, loadDistrict, loadParcel, rectangularLot, toManifold } from "./helpers";

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

describe("fixture C: real RH-2 corner lot (2550 19th St, 4025006)", async () => {
  const engine = await getEngine();
  const parcel = loadParcel("4025006");

  it("asks which side is the front", () => {
    const r = engine.computeEnvelope(parcel, RH2);
    expect(r.status).toBe("needs_front_choice");
    if (r.status === "needs_front_choice") expect(r.candidates).toHaveLength(2);
  });

  it.each([0, 1])("computes an envelope with front side %i and no NaN values", (frontSide) => {
    const r = ok(engine.computeEnvelope(parcel, RH2, { frontSide }));
    const numbers = [
      r.lot.widthFt,
      r.lot.depthFt,
      r.totals.volume,
      r.totals.grossFloorAreaSqFt,
      ...r.steps.flatMap((s) => [...Object.values(s.measurements), ...Object.values(s.numbers)]),
    ];
    expect(numbers.every(Number.isFinite)).toBe(true);
    expect(r.totals.volume).toBeGreaterThan(0);
  });

  it("measures width and depth from the chosen front", () => {
    const a = ok(engine.computeEnvelope(parcel, RH2, { frontSide: 0 }));
    const b = ok(engine.computeEnvelope(parcel, RH2, { frontSide: 1 }));
    expect([a.lot.widthFt, a.lot.depthFt].map(Math.round)).toEqual([65, 40]);
    expect([b.lot.widthFt, b.lot.depthFt].map(Math.round)).toEqual([40, 65]);
  });
});

describe("fixture D: real lot across two height districts (1391 Hampshire St, 4276045)", async () => {
  const engine = await getEngine();
  const r = ok(engine.computeEnvelope(loadParcel("4276045"), RH2));
  const height = step(r, "mapped-height");
  const piece55 = 0.329369 * r.lot.areaSqFt; // 55-X share measured independently (DATA-NOTES.md)

  it("starts at 2x the taller district (110 ft)", () => {
    expect(r.start.heightFt).toBe(110);
  });

  it("cuts each part of the lot to its own height: 40 ft and 55 ft", async () => {
    expect(height.status).toBe("cut");
    expect(height.dimensions.map((d) => d.label).sort()).toEqual(["40 ft", "55 ft"]);
    const after = await toManifold(height.after);
    expect(after.boundingBox().max[2]).toBeCloseTo(55, 4);
    expect(after.slice(47).area()).toBeCloseTo(piece55, -1); // only the 55-X piece rises above 40 ft
    expect(after.slice(39).area()).toBeCloseTo(r.lot.areaSqFt, 0);
    after.delete();
  });

  it("then trims the 55 ft part with the RH-2 40 ft dwelling cap", () => {
    const cap = step(r, "rh-dwelling-height");
    expect(cap.status).toBe("cut");
    expect(cap.measurements.removedVolume).toBeCloseTo(15 * piece55, -1);
  });
});
