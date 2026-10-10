import { describe, expect, it } from "vitest";
import type { CutPlane, EnvelopeResult } from "../src";
import { getEngine, loadDistrict, loadParcel, rectangularLot } from "./helpers";

// Fixture A in world feet: the lot spans x −12.5…12.5 and y −50…50 (recentered),
// with the street to the south, so depth from the front line is d = y + 50.
const close = (a: number[], b: number[]) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i]!, 6));
const planes = (r: EnvelopeResult, id: string): CutPlane[] => {
  if (r.status !== "ok") throw new Error(r.status);
  return r.steps.find((s) => s.rule.id === id)!.cutPlanes;
};

describe("cut planes for the cutting-plane sweep", async () => {
  const engine = await getEngine();
  const rh2 = loadDistrict("RH-2");
  const a = engine.computeEnvelope(rectangularLot(25, 100), rh2, { overrides: { "front-setback": { feet: 0 } } });

  it("lays the height limit flat across the lot at 40 ft", () => {
    const [p] = planes(a, "mapped-height");
    close(p!.origin, [-12.5, -50, 40]);
    close(p!.u, [25, 0, 0]);
    close(p!.v, [0, 100, 0]);
  });

  it("stands the rear-yard plane 70 ft back from the front, full block height", () => {
    const [p] = planes(a, "rear-yard");
    close(p!.origin, [-12.5, 20, 0]);
    close(p!.u, [25, 0, 0]);
    close(p!.v, [0, 0, 80]);
  });

  it("tilts the front height plane up at 45° from 30 ft on the front line", () => {
    const [p] = planes(a, "front-plane");
    close(p!.origin, [-12.5, -50, 30]);
    close(p!.v, [0, 50, 50]);
  });

  it("gives rules without geometry no planes", () => {
    expect(planes(a, "use")).toEqual([]);
    expect(planes(a, "slope")).toEqual([]);
  });

  it("gives each height district on a split lot its own plane", () => {
    const d = engine.computeEnvelope(loadParcel("4276045"), rh2);
    const heights = planes(d, "mapped-height").map((p) => p.origin[2]).sort();
    expect(heights).toEqual([40, 55]);
  });
});
