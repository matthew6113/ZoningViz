import { describe, expect, it } from "vitest";
import type { EnvelopeResult, Step } from "../src";
import { getEngine, loadDistrict, slopedLot } from "./helpers";

// Sloping ground (SPEC.md Phase 6: terrain and slope). Values come from the
// RH-1 draft: §260 height reference, §261(b)(1) slope caps, §261(c) front plane.
const RH1 = loadDistrict("RH-1");
const RH2 = loadDistrict("RH-2");
const NO_SETBACK = { overrides: { "front-setback": { feet: 0 } } };

type Ok = Extract<EnvelopeResult, { status: "ok" }>;
function ok(result: EnvelopeResult): Ok {
  if (result.status !== "ok") throw new Error(`expected an envelope, got ${result.status}`);
  return result;
}
const step = (r: Ok, id: string): Step => r.steps.find((s) => s.rule.id === id)!;

describe("fixture F: 25 x 100 ft RH-1 lot falling 25 ft to the rear, 40-X, no front setback", async () => {
  const engine = await getEngine();
  const r = ok(engine.computeEnvelope(slopedLot(25, 100, -25), RH1, NO_SETBACK));

  it("measures the ground: curb at the front, rear 25 ft lower, sloping down", () => {
    expect(r.lot.terrain).toMatchObject({ upslope: false, crossSlopePct: 0 });
    expect(r.lot.terrain!.curbElevationFt).toBeCloseTo(0, 6);
    expect(r.lot.terrain!.frontAverageFt).toBeCloseTo(0, 6);
    expect(r.lot.terrain!.rearAverageFt).toBeCloseTo(-25, 6);
    expect(r.lot.terrain!.rearMinusFrontFt).toBeCloseTo(-25, 6);
  });

  it("measures height from the curb", () => {
    expect(step(r, "height-reference").status).toBe("info");
    expect(step(r, "height-reference").sentence).toMatch(/slopes down from the street, so heights are measured from the curb/);
  });

  it("caps the home at 30 ft, because the rear is 20 ft or more lower", () => {
    const cap = step(r, "rh-dwelling-height");
    expect(cap.status).toBe("cut");
    expect(cap.numbers.heightFt).toBe(30);
    expect(cap.sentence).toBe(
      "RH-1 dwelling cap: the rear lot line averages 25 ft lower than the front (-25 ft vs 0 ft), 20 ft or more, so 30 ft instead of 35 ft.",
    );
  });

  it("leaves the front plane already satisfied under the 30 ft cap", () => {
    expect(step(r, "front-plane").status).toBe("already_satisfied");
  });

  it("ends at 67,812.5 cu ft standing on the slope, with 5 levels and 6,750 sq ft", () => {
    expect(r.totals.volume).toBeCloseTo(67_812.5, 2);
    expect(r.totals.footprintSqFt).toBeCloseTo(1750, 3);
    expect(r.floors.map((f) => [f.bottomFt, Math.round(f.plateSqFt)])).toEqual([
      [-20, 250],
      [-10, 1250],
      [0, 1750],
      [10, 1750],
      [20, 1750],
    ]);
    expect(r.totals.grossFloorAreaSqFt).toBeCloseTo(6750, 2);
  });
});

describe("fixture G: 25 x 100 ft RH-1 lot rising 30 ft to the rear, 40-X, no front setback", async () => {
  const engine = await getEngine();
  const r = ok(engine.computeEnvelope(slopedLot(25, 100, 30), RH1, NO_SETBACK));

  it("measures the ground as sloping up", () => {
    expect(r.lot.terrain!.upslope).toBe(true);
    expect(r.lot.terrain!.rearMinusFrontFt).toBeCloseTo(30, 6);
  });

  it("measures height from the curb for 10 ft, then from the ground at the sides", () => {
    expect(step(r, "height-reference").sentence).toMatch(
      /slopes up from the street, so heights are measured from the curb .* within 10 ft of the front lot line and, farther back, from the average ground at the two side lot lines/,
    );
  });

  it("raises the cap to 40 ft and drops the front plane", () => {
    expect(step(r, "rh-dwelling-height").numbers.heightFt).toBe(40);
    expect(step(r, "rh-dwelling-height").status).toBe("already_satisfied"); // the 40 ft mapped height already did it
    const plane = step(r, "front-plane");
    expect(plane.status).toBe("not_applicable");
    expect(plane.sentence).toBe("Front height plane: doesn't apply, because the rear lot line averages 30 ft higher than the front (20 ft or more).");
    expect(plane.removed).toBeNull();
  });

  it("ends at 69,625 cu ft: 40 ft above the curb near the street, 40 ft above the ground behind", () => {
    expect(r.totals.volume).toBeCloseTo(69_625, 1);
    expect(r.totals.footprintSqFt).toBeCloseTo(1750, 3);
  });
});

describe("RH-2 on slopes", async () => {
  const engine = await getEngine();

  it("drops to 35 ft where the rear is 20 ft or more lower", () => {
    const r = ok(engine.computeEnvelope(slopedLot(25, 100, -22), RH2, NO_SETBACK));
    expect(step(r, "rh-dwelling-height").numbers.heightFt).toBe(35);
  });

  it("stays at 40 ft uphill (no increase in RH-2), and the front plane is dropped", () => {
    const r = ok(engine.computeEnvelope(slopedLot(25, 100, 25), RH2, NO_SETBACK));
    expect(step(r, "rh-dwelling-height").numbers.heightFt).toBe(40);
    expect(step(r, "rh-dwelling-height").sentence).toMatch(/averages 25 ft higher than the front \(25 ft vs 0 ft\), so 40 ft\./);
    expect(step(r, "front-plane").status).toBe("not_applicable");
  });

  it("keeps the 40 ft cap and the plane on a gentle 5 ft rise", () => {
    const r = ok(engine.computeEnvelope(slopedLot(25, 100, 5), RH2, NO_SETBACK));
    expect(step(r, "rh-dwelling-height").numbers.heightFt).toBe(40);
    expect(step(r, "front-plane").status).not.toBe("not_applicable");
  });
});

describe("without ground data", async () => {
  const engine = await getEngine();
  it("treats the lot as flat and says so", () => {
    const lot = slopedLot(25, 100, 0);
    const r = ok(engine.computeEnvelope({ ...lot, terrain: null }, RH1, NO_SETBACK));
    expect(r.lot.terrain).toBeNull();
    expect(step(r, "rh-dwelling-height").sentence).toBe("RH-1 dwelling cap: no ground elevations for this lot, so this assumes a flat lot: 35 ft.");
    expect(step(r, "height-reference").sentence).toMatch(/no ground elevations/);
    expect(r.notes.some((n) => n.startsWith("No ground elevations"))).toBe(true);
  });
});
