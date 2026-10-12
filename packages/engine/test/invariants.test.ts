import { describe, expect, it } from "vitest";
import type { EnvelopeOptions, EnvelopeResult, ParcelInput, Solid } from "../src";
import { crossSection, loadManifold } from "../src/geometry/manifold";
import { getEngine, loadDistrict, loadParcel, rectangularLot, slopedLot, toManifold } from "./helpers";

// SPEC.md invariants, checked on every fixture and recorded real lot, with the
// default front setback, no setback, and one rule switched off.
const NO_SETBACK = { overrides: { "front-setback": { feet: 0 } } };

const parcels: [string, ParcelInput, string, EnvelopeOptions][] = [
  ["A 25x100", rectangularLot(25, 100), "RH-2", {}],
  ["B 25x40", rectangularLot(25, 40), "RH-2", {}],
  ["E 35x100", rectangularLot(35, 100), "RH-1(D)", {}],
  ["30x100 one side yard", rectangularLot(30, 100), "RH-1(D)", {}],
  ["F falling 25 ft", slopedLot(25, 100, -25), "RH-1", {}],
  ["G rising 30 ft", slopedLot(25, 100, 30), "RH-1", {}],
  ["35x120 falling 45 ft", slopedLot(35, 120, -45), "RH-1(D)", {}],
  ["25x100 rising 12 ft", slopedLot(25, 100, 12), "RH-2", {}],
  ["667 Hampshire (4025007)", loadParcel("4025007"), "RH-2", {}],
  ["Francisco condo (0044030)", loadParcel("0044030"), "RH-2", {}],
  ["corner, front 0 (4025006)", loadParcel("4025006"), "RH-2", { frontSide: 0 }],
  ["corner, front 1 (4025006)", loadParcel("4025006"), "RH-2", { frontSide: 1 }],
  ["two height districts (4276045)", loadParcel("4276045"), "RH-2", {}],
  ["124 Clarendon Ave (2687029)", loadParcel("2687029"), "RH-1(D)", {}],
  ["752 4th Ave (1646023)", loadParcel("1646023"), "RH-1", {}],
  ["752 4th Ave as RH-1(S) (1646023)", loadParcel("1646023"), "RH-1(S)", {}],
  ["2120 Lyon St (0982019)", loadParcel("0982019"), "RH-3", {}],
];
const variants: [string, EnvelopeOptions][] = [
  ["default setback", {}],
  ["no setback", NO_SETBACK],
  ["rear yard off", { disabledRuleIds: ["rear-yard"] }],
];
const cases = parcels.flatMap(([name, parcel, district, base]) =>
  variants.map(([variant, opts]) => [`${name} ${district}, ${variant}`, parcel, district, { ...base, ...opts }] as const),
);

describe.each(cases)("%s", async (_, parcel, district, options) => {
  const engine = await getEngine();
  const result: EnvelopeResult = engine.computeEnvelope(parcel, loadDistrict(district), options);
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
    // Tall enough for any envelope, and reaching below the curb datum for sloping lots.
    const prism = section.extrude(20 * start.heightFt).translate([0, 0, -10 * start.heightFt]);
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
      if (step.status === "info" || step.status === "not_applicable" || step.status === "not_modeled" || step.status === "disabled") {
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
