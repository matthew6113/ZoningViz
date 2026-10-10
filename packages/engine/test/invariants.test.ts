import { describe, expect, it } from "vitest";
import type { EnvelopeOptions, EnvelopeResult, ParcelInput, Solid } from "../src";
import { crossSection, loadManifold } from "../src/geometry/manifold";
import { getEngine, loadDistrict, loadParcel, rectangularLot, toManifold } from "./helpers";

// SPEC.md invariants, checked on every fixture and recorded real lot, with the
// default front setback, no setback, and one rule switched off.
const RH2 = loadDistrict("RH-2");
const NO_SETBACK = { overrides: { "front-setback": { feet: 0 } } };

const parcels: [string, ParcelInput, EnvelopeOptions][] = [
  ["A 25x100", rectangularLot(25, 100), {}],
  ["B 25x40", rectangularLot(25, 40), {}],
  ["667 Hampshire (4025007)", loadParcel("4025007"), {}],
  ["Francisco condo (0044030)", loadParcel("0044030"), {}],
  ["corner, front 0 (4025006)", loadParcel("4025006"), { frontSide: 0 }],
  ["corner, front 1 (4025006)", loadParcel("4025006"), { frontSide: 1 }],
  ["two height districts (4276045)", loadParcel("4276045"), {}],
];
const variants: [string, EnvelopeOptions][] = [
  ["default setback", {}],
  ["no setback", NO_SETBACK],
  ["rear yard off", { disabledRuleIds: ["rear-yard"] }],
];
const cases = parcels.flatMap(([name, parcel, base]) =>
  variants.map(([variant, opts]) => [`${name}, ${variant}`, parcel, { ...base, ...opts }] as const),
);

describe.each(cases)("%s", async (_, parcel, options) => {
  const engine = await getEngine();
  const result: EnvelopeResult = engine.computeEnvelope(parcel, RH2, options);
  if (result.status !== "ok") throw new Error(`expected an envelope, got ${result.status}`);
  const { start, steps, totals, lot } = result;

  it("never increases volume from one step to the next", () => {
    let previous = start.volume;
    for (const step of steps) {
      expect(step.measurements.volume).toBeLessThanOrEqual(previous + 1e-6);
      previous = step.measurements.volume;
    }
  });

  it("accounts for every removed cubic foot (within 0.1%)", () => {
    const removed = steps.reduce((sum, s) => sum + s.measurements.removedVolume, 0);
    expect(Math.abs(start.volume - totals.volume - removed)).toBeLessThanOrEqual(0.001 * start.volume);
  });

  it("keeps every step inside the parcel prism", async () => {
    const wasm = await loadManifold();
    const section = crossSection(wasm, lot.outline);
    const prism = section.extrude(10 * start.heightFt).translate([0, 0, -1]);
    const solids = new Set<Solid>([start, ...steps.map((s) => s.after)]);
    for (const solid of solids) {
      const m = await toManifold(solid);
      const outside = m.subtract(prism);
      expect(outside.volume()).toBeLessThanOrEqual(1e-5 * solid.volume + 0.01);
      [m, outside].forEach((o) => o.delete());
    }
    [section, prism].forEach((o) => o.delete());
  });

  it("says 'already satisfied' exactly when a geometric rule removes nothing", () => {
    for (const step of steps) {
      if (step.status === "info" || step.status === "not_modeled" || step.status === "disabled") {
        expect(step.measurements.removedVolume).toBe(0);
        continue;
      }
      const satisfied = step.measurements.removedVolume === 0;
      expect(step.status).toBe(satisfied ? "already_satisfied" : "cut");
      expect(/already satisfied/i.test(step.sentence)).toBe(satisfied);
    }
  });

  it("produces no NaN or infinite numbers", () => {
    const numbers = [
      lot.areaSqFt,
      lot.widthFt,
      lot.depthFt,
      start.volume,
      ...Object.values(totals),
      ...steps.flatMap((s) => [...Object.values(s.measurements), ...Object.values(s.numbers)]),
      ...result.floors.map((f) => f.plateSqFt),
    ];
    expect(numbers.every(Number.isFinite)).toBe(true);
  });
});
