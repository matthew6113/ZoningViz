import type { MultiPolygon } from "geojson";
import { describe, expect, it } from "vitest";
import { findStreetSides, toPlanar } from "../src/geometry/lot";
import { getEngine, loadDistrict, loadParcel, rectangularLot } from "./helpers";

const rect = (x0: number, y0: number, x1: number, y1: number): MultiPolygon => ({
  type: "MultiPolygon",
  coordinates: [[[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]]],
});
const planar = (m: MultiPolygon) => toPlanar(m, null);
const lot = planar(rect(0, 0, 25, 100));

describe("findStreetSides", () => {
  it("finds the single street side of a mid-block lot", () => {
    const input = rectangularLot(25, 100);
    const sides = findStreetSides(planar(input.footprint), input.neighbors.map(planar));
    expect(sides).toHaveLength(1);
    expect(sides[0]!.lengthFt).toBeCloseTo(25, 6);
    expect(sides[0]!.outward[0]).toBeCloseTo(0, 6);
    expect(sides[0]!.outward[1]).toBeCloseTo(-1, 6);
  });

  it("finds two sides on a corner lot", () => {
    const sides = findStreetSides(lot, [rect(25, 0, 50, 100), rect(0, 100, 25, 200)].map(planar));
    expect(sides.map((s) => Math.round(s.lengthFt))).toEqual([100, 25]);
  });

  it("finds front and back on a through lot", () => {
    const sides = findStreetSides(lot, [rect(-25, 0, 0, 100), rect(25, 0, 50, 100)].map(planar));
    expect(sides.map((s) => Math.round(s.lengthFt))).toEqual([25, 25]);
  });

  it("offers every side when there are no neighbors", () => {
    expect(findStreetSides(lot, [])).toHaveLength(4);
  });

  it("still offers the longest side of a sliver too small for any side to count (2716042 is 5 sq ft)", () => {
    const sliver = planar(rect(0, 0, 4, 1.25));
    // Neighbors left, right and behind: only the 4 ft bottom edge faces the street, under the 5 ft minimum.
    const sides = findStreetSides(sliver, [rect(-10, 0, 0, 1.25), rect(4, 0, 14, 1.25), rect(-10, 1.25, 14, 10)].map(planar));
    expect(sides).toHaveLength(1);
    expect(sides[0]!.lengthFt).toBeCloseTo(4, 6);
  });
});

describe("front detection on real lots", async () => {
  const engine = await getEngine();
  const rh2 = loadDistrict("RH-2");

  it("picks the only street side of 667 Hampshire St", () => {
    const r = engine.computeEnvelope(loadParcel("4025007"), rh2);
    if (r.status !== "ok") throw new Error(r.status);
    expect(r.lot.widthFt).toBeCloseTo(25, 1);
    expect(r.lot.depthFt).toBeCloseTo(100, 1);
    expect(r.lot.approximate).toBe(false);
  });

  it("asks which side is the front of corner lot 2550 19th St", () => {
    const r = engine.computeEnvelope(loadParcel("4025006"), rh2);
    expect(r.status).toBe("needs_front_choice");
    if (r.status !== "needs_front_choice") return;
    expect(r.candidates.map((c) => Math.round(c.lengthFt))).toEqual([65, 40]);
  });
});
