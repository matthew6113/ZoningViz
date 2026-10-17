import { describe, expect, it } from "vitest";
import { syntheticLot, type EnvelopeOptions, type EnvelopeResult, type ParcelInput, type Solid } from "../src";
import { crossSection, loadManifold } from "../src/geometry/manifold";
import { getEngine, loadDistrict, loadParcel, rectangularLot, slopedLot, toManifold, withHeightDistrict } from "./helpers";

// SPEC.md invariants, checked on every fixture and recorded real lot, with the
// default front setback, no setback, and one rule switched off; lots with a
// local-program height (R-4) again with the program on.
const NO_SETBACK = { overrides: { "front-setback": { feet: 0 } } };
const r4 = (base: number, local: number) => ({ label: `${base}//${local}-R-4`, heightFt: base, localProgramHeightFt: local, bulk: "R-4" });

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
  ["H 25x100", rectangularLot(25, 100), "NC-2", {}],
  ["NC-2 rising 20 ft", slopedLot(25, 100, 20), "NC-2", {}],
  ["RM-1 falling 25 ft", slopedLot(25, 100, -25), "RM-1", {}],
  ["969 Lombard St (0072050)", loadParcel("0072050"), "RM-1", {}],
  ["619 Chestnut St (0065024)", loadParcel("0065024"), "RM-2", {}],
  ["963 Jackson St (0191023)", loadParcel("0191023"), "RM-3", {}],
  ["937 Clay St, front 0 (0224032)", loadParcel("0224032"), "RM-4", { frontSide: 0 }],
  ["1345 Clement St (1446048)", loadParcel("1446048"), "NC-1", {}],
  ["3625 Wawona St, rising (2516021)", loadParcel("2516021"), "NC-2", {}],
  ["2385 Folsom St (3593008)", loadParcel("3593008"), "NC-2", {}],
  ["1618 Lombard St (0496004)", loadParcel("0496004"), "NC-3", {}],
  ["3580 California St, front 1 (1018019)", loadParcel("1018019"), "NC-S", { frontSide: 1 }],
  ["800 Powell St, front 0, bulk cut (0243017)", loadParcel("0243017"), "RM-4", { frontSide: 0 }],
  ["K 50x150 65-A", withHeightDistrict(rectangularLot(50, 150), "65-A", 65, "A"), "RM-4", {}],
  ["L 105x100 65-A", withHeightDistrict(rectangularLot(105, 100), "65-A", 65, "A"), "RM-4", {}],
  ["N 25x100 65-N", withHeightDistrict(rectangularLot(25, 100), "65-N", 65, "N"), "RM-4", {}],
  ["50x150 65-A rising 25 ft", withHeightDistrict(slopedLot(50, 150, 25), "65-A", 65, "A"), "RM-4", {}],
  ["50x150 65-A falling 25 ft, NC-3", withHeightDistrict(slopedLot(50, 150, -25), "65-A", 65, "A"), "NC-3", {}],
  ["R 100x100 40//40-R-4", syntheticLot(100, 100, r4(40, 40)), "RH-2", {}],
  ["T corner 25x100 40//40-R-4", syntheticLot(25, 100, r4(40, 40), { streets: "front_and_left" }), "RH-2", { frontSide: 1 }],
  ["NC-2 25x100 40//65-R-4 rising 20 ft", { ...slopedLot(25, 100, 20), heightZones: syntheticLot(25, 100, r4(40, 65)).heightZones }, "NC-2", {}],
  ["U 25x100, RTO-C", rectangularLot(25, 100), "RTO-C", {}],
  ["V 25x100 40//65-R-4, RTO-C", syntheticLot(25, 100, r4(40, 65)), "RTO-C", {}],
  ["RTO-1 25x100 falling 25 ft", slopedLot(25, 100, -25), "RTO-1", {}],
  ["3250 Webster St, corner, front 1 (0493016)", loadParcel("0493016"), "RTO-C", { frontSide: 1 }],
  ["65 Hermann St (0872013)", loadParcel("0872013"), "RTO-1", {}],
  ["3646 20th St (3597019)", loadParcel("3597019"), "RTO-M", {}],
  ["W 25x100, Mission Street NCT", rectangularLot(25, 100), "NCT-MISSION", {}],
  ["4479 Mission St, Excelsior (6013018)", loadParcel("6013018"), "NCD-EXCELSIOR", {}],
  ["2700 Geary Blvd, front 0 (1070003)", loadParcel("1070003"), "NCD-GEARY BOULEVARD", { frontSide: 0 }],
  ["1415 Grant Ave, North Beach, front 0 (0116010)", loadParcel("0116010"), "NCD-NORTH BEACH", { frontSide: 0 }],
  ["2044 Mission St, 80-B (3569008)", loadParcel("3569008"), "NCT-MISSION", {}],
  ["518 Valencia St (3568002)", loadParcel("3568002"), "NCT-VALENCIA", {}],
];
const variants: [string, EnvelopeOptions][] = [
  ["default setback", {}],
  ["no setback", NO_SETBACK],
  ["rear yard off", { disabledRuleIds: ["rear-yard"] }],
];
const programVariants: [string, EnvelopeOptions][] = [
  ["Housing Choice-SF", { localProgram: true }],
  ["Housing Choice-SF, no setback", { ...NO_SETBACK, localProgram: true }],
];
const cases = parcels.flatMap(([name, parcel, district, base]) =>
  [...variants, ...(parcel.heightZones.some((z) => z.localProgramHeightFt) ? programVariants : [])].map(
    ([variant, opts]) => [`${name} ${district}, ${variant}`, parcel, district, { ...base, ...opts }] as const,
  ),
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
