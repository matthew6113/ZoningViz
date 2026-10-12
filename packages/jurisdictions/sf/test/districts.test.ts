import { describe, expect, it } from "vitest";
import { availableDistricts, loadDistrict } from "../districts";
import { toParcelInput } from "../engineInput";
import type { SfParcel } from "../types";

// Rules shared across district files are copied into each one; these checks keep the copies identical.
describe("district files", () => {
  const shared = (id: string) => availableDistricts().map((code) => ({ code, rule: loadDistrict(code)!.rules.find((r) => r.id === id) }));

  it("all carry the same bulk table (Table 270)", () => {
    const copies = shared("bulk");
    for (const { code, rule } of copies) expect(rule, `${code} has no bulk rule`).toBeDefined();
    const [first, ...rest] = copies;
    for (const { code, rule } of rest) expect(rule, `${code}'s bulk rule differs from ${first!.code}'s`).toEqual(first!.rule);
  });

  it.each(["height-reference", "mapped-height", "narrow-street", "cross-slope"])("all carry the same %s rule", (id) => {
    const [first, ...rest] = shared(id);
    for (const { code, rule } of rest) expect(rule, `${code}'s ${id} differs`).toEqual(first!.rule);
  });

  it("put bulk after every yard, setback and plane, so its box is measured on what they leave", () => {
    for (const code of availableDistricts()) {
      const kinds = loadDistrict(code)!.rules.map((r) => r.kind);
      const bulk = kinds.indexOf("bulk");
      for (const kind of ["rear_yard", "front_setback", "side_yard", "sky_plane", "height_cap", "height_by_slope"] as const) {
        if (kinds.includes(kind)) expect(kinds.lastIndexOf(kind), `${code}: ${kind} after bulk`).toBeLessThan(bulk);
      }
    }
  });
});

describe("engine input", () => {
  const zone = (label: string, parsed: SfParcel["heightDistricts"][number]["parsed"]) => ({
    label,
    parsed,
    genHeightFt: null,
    shareOfLot: 1,
    geometry: { type: "MultiPolygon" as const, coordinates: [] },
  });
  const parcel = (districts: ReturnType<typeof zone>[]) =>
    ({ blklot: "1", geometry: { type: "MultiPolygon", coordinates: [] }, heightDistricts: districts }) as unknown as SfParcel;

  it("passes each zone's bulk letter: the mapped letter, R-4, or null when unreadable", () => {
    const input = toParcelInput(
      parcel([
        zone("65-A", { kind: "standard", heightFt: 65, bulk: "A" }),
        zone("40//65-R-4", { kind: "r4", baseHeightFt: 40, localProgramHeightFt: 65 }),
        zone("20/160-IB", { kind: "unparsed", reason: "label lists more than one height" }),
      ]),
      [],
    );
    expect(input.heightZones.map((z) => z.bulk)).toEqual(["A", "R-4", null]);
  });
});
