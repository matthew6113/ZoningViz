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
    expect(step(r, "cross-slope").status).toBe("not_modeled");
    expect(step(r, "cross-slope").removed).toBeNull();
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
  // Flat here (terrain dropped), so the zone heights can be checked as plain numbers; terrain.test.ts covers slopes.
  const r = ok(engine.computeEnvelope({ ...loadParcel("4276045"), terrain: null }, RH2));
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

describe("fixture E: 35 x 100 ft RH-1(D) lot, 40-X, no front setback", async () => {
  const engine = await getEngine();
  const RH1D = loadDistrict("RH-1(D)");
  const r = ok(engine.computeEnvelope(rectangularLot(35, 100), RH1D, NO_SETBACK));

  it("cuts the 40 ft mapped height, then the 35 ft RH-1(D) cap", () => {
    expect(step(r, "mapped-height").measurements.volume).toBeCloseTo(35 * 100 * 40, 3);
    expect(step(r, "rh-dwelling-height").status).toBe("cut");
    expect(step(r, "rh-dwelling-height").measurements.volume).toBeCloseTo(35 * 100 * 35, 3);
  });

  it("takes 3 ft side yards on a 35 ft lot, leaving a 29 x 70 ft = 2,030 sq ft footprint", () => {
    const sides = step(r, "side-yards");
    expect(sides.status).toBe("cut");
    expect(sides.sentence).toBe("Side yards: this lot is 35 ft wide (31 ft to under 40 ft), so 3 ft on each side.");
    expect(sides.numbers).toMatchObject({ lotWidthFt: 35, leftFt: 3, rightFt: 3 });
    expect(sides.measurements.removedVolume).toBeCloseTo(2 * 3 * 70 * 35, 3);
    expect(sides.measurements.footprintSqFt).toBeCloseTo(2030, 3);
    expect(sides.dimensions.map((d) => d.label)).toEqual(["3 ft", "3 ft"]);
  });

  it("removes 362.5 cu ft with the front plane (30 ft, then 45° up to the 35 ft cap)", () => {
    expect(step(r, "front-plane").measurements.removedVolume).toBeCloseTo(0.5 * 5 * 5 * 29, 3);
  });

  it("ends at 70,687.5 cu ft, 3 stories and 6,090 sq ft of floor area", () => {
    expect(r.totals.volume).toBeCloseTo(70_687.5, 3);
    expect(r.totals.footprintSqFt).toBeCloseTo(2030, 3);
    expect(r.totals.stories).toBe(3);
    expect(r.totals.grossFloorAreaSqFt).toBeCloseTo(6090, 3);
  });

  it("flags narrow streets and cross-slope without cutting", () => {
    expect(step(r, "narrow-street").status).toBe("not_modeled");
    expect(step(r, "cross-slope").status).toBe("not_modeled");
  });
});

describe("RH-1(D) side yards by lot width", async () => {
  const engine = await getEngine();
  const RH1D = loadDistrict("RH-1(D)");
  const sideYards = (width: number) =>
    step(ok(engine.computeEnvelope(rectangularLot(width, 100), RH1D, NO_SETBACK)), "side-yards");

  it("needs none on a lot under 28 ft wide", () => {
    const s = sideYards(25);
    expect(s.status).toBe("info");
    expect(s.sentence).toBe("Side yards: none required, because this lot is 25 ft wide (under 28 ft).");
    expect(s.measurements.removedVolume).toBe(0);
  });

  it("takes one yard of width − 25 ft on a lot 28 to under 31 ft wide", () => {
    const s = sideYards(30);
    expect(s.numbers).toMatchObject({ leftFt: 5, rightFt: 0 });
    expect(s.sentence).toMatch(/^Side yards: this lot is 30 ft wide \(28 ft to under 31 ft\), so one yard of 30 ft − 25 ft = 5 ft\./);
    expect(s.measurements.footprintSqFt).toBeCloseTo(25 * 70, 3);
  });

  it.each([
    [40, 4],
    [50, 5],
    [80, 5],
  ])("takes the table's yards on a %i ft lot (%i ft each)", (width, each) => {
    const s = sideYards(width);
    expect(s.numbers).toMatchObject({ leftFt: each, rightFt: each });
    expect(s.measurements.footprintSqFt).toBeCloseTo((width - 2 * each) * 70, 3);
  });
});

describe("side yards on an irregular real lot (124 Clarendon Ave, 2687029, RH-1(D))", async () => {
  const engine = await getEngine();
  const r = ok(engine.computeEnvelope(loadParcel("2687029"), loadDistrict("RH-1(D)")));
  const sides = step(r, "side-yards");

  it("is flagged as approximate geometry and takes 5 ft yards on a 50.6 ft wide lot", () => {
    expect(r.lot.approximate).toBe(true);
    expect(r.lot.widthFt).toBeCloseTo(50.6, 1);
    expect(sides.numbers).toMatchObject({ leftFt: 5, rightFt: 5 });
  });

  it("keeps every corner of the result at least 5 ft from the side lot lines it follows", () => {
    // Rebuild the side lines the way the engine classifies them: edges running more front-to-back than across.
    const { from, to } = r.lot.front;
    const len = Math.hypot(to[0] - from[0], to[1] - from[1]);
    const [ux, uy] = [(to[0] - from[0]) / len, (to[1] - from[1]) / len];
    const ring = r.lot.outline[0]![0]!;
    const segments = ring
      .map((a, i) => [a, ring[(i + 1) % ring.length]!] as const)
      .filter(([a, b]) => {
        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        return Math.hypot(dx, dy) > 1e-6 && Math.abs(dx * -uy + dy * ux) > Math.abs(dx * ux + dy * uy);
      });
    expect(segments.length).toBeGreaterThanOrEqual(2);
    const distance = (p: number[], [a, b]: readonly [number[], number[]]) => {
      const [dx, dy] = [b[0]! - a[0]!, b[1]! - a[1]!];
      const t = Math.max(0, Math.min(1, ((p[0]! - a[0]!) * dx + (p[1]! - a[1]!) * dy) / (dx * dx + dy * dy)));
      return Math.hypot(p[0]! - (a[0]! + t * dx), p[1]! - (a[1]! + t * dy));
    };
    const positions = sides.after.positions;
    let nearest = Infinity;
    for (let i = 0; i < positions.length; i += 3) {
      const p = [positions[i]!, positions[i + 1]!];
      for (const segment of segments) nearest = Math.min(nearest, distance(p, segment));
    }
    expect(nearest).toBeGreaterThan(5 - 0.01);
    expect(sides.measurements.removedVolume).toBeGreaterThan(10_000);
  });
});
