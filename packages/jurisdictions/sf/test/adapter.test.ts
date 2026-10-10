import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createSfAdapter, normalizeBlklot } from "../adapter";
import { withDiskCache } from "../node/cache";

// Replays DataSF responses recorded on 2026-10-10 (see sf/DATA-NOTES.md). Any
// request that was not recorded fails, so these tests never touch the network.
// Expected areas and shares were computed independently with pyproj + shapely.
const FIXTURES = join(import.meta.dirname, "fixtures", "datasf");
const adapter = createSfAdapter({
  fetchJson: withDiskCache(async (url) => {
    throw new Error(`Not recorded: ${url}`);
  }, FIXTURES),
});

describe("getParcelByBlockLot", () => {
  it("describes an ordinary RH-2 lot in a 40-X district", async () => {
    const p = (await adapter.getParcelByBlockLot("4025007"))!;
    expect(p.address.label).toBe("667 Hampshire St");
    expect(p.zoning).toEqual({ code: "RH-2", name: "RESIDENTIAL- HOUSE, TWO FAMILY", source: "parcel" });
    expect(p.lotAreaSqFt).toBeCloseTo(2500.02, 1);
    expect(p.unitBlklots).toEqual([]);
    expect(p.heightDistricts).toHaveLength(1);
    expect(p.heightDistricts[0]).toMatchObject({
      label: "40-X",
      parsed: { kind: "standard", heightFt: 40, bulk: "X" },
    });
    expect(p.heightDistricts[0]!.shareOfLot).toBeCloseTo(1, 5);
    // A neighbouring district only shares the lot's edge.
    expect(p.warnings.some((w) => w.startsWith("Ignored height district 58-X"))).toBe(true);
  });

  it("groups a condo stack under its land parcel and reads both R-4 heights", async () => {
    const p = (await adapter.getParcelByBlockLot("0044030"))!;
    expect(p.blklot).toBe("0044030");
    expect(p.address.label).toBe("766–772 Francisco St");
    expect(p.unitBlklots).toEqual(["0044031", "0044032", "0044033", "0044034"]);
    expect(p.lotAreaSqFt).toBeCloseTo(4218.75, 1);
    expect(p.heightDistricts).toEqual([
      {
        label: "40//50-R-4",
        genHeightFt: 50,
        parsed: { kind: "r4", baseHeightFt: 40, localProgramHeightFt: 50 },
        shareOfLot: 1,
        geometry: p.geometry,
      },
    ]);
    expect(p.asOf).toEqual({ parcels: "2026-10-01", heightDistricts: "2026-10-10" });
  });

  it("resolves a condo unit's block/lot to the land parcel", async () => {
    const p = (await adapter.getParcelByBlockLot("0044032"))!;
    expect(p.blklot).toBe("0044030");
    expect(p.requestedBlklot).toBe("0044032");
    expect(p.warnings[0]).toMatch(/unit record; showing its land parcel 0044030/);
  });

  it("splits a lot that straddles two height districts", async () => {
    const p = (await adapter.getParcelByBlockLot("4276045"))!;
    expect(p.address.label).toBe("1391–1393 Hampshire St");
    expect(p.lotAreaSqFt).toBeCloseTo(2960.56, 1);
    expect(p.heightDistricts.map((d) => d.label)).toEqual(["40-X", "55-X"]);
    expect(p.heightDistricts[0]!.shareOfLot).toBeCloseTo(0.67063, 4);
    expect(p.heightDistricts[1]!.shareOfLot).toBeCloseTo(0.329369, 4);
    expect(p.warnings).toContain("Ignored height district OS: it only touches the lot boundary.");
    expect(p.warnings.some((w) => w.startsWith("Lot spans 2 height districts"))).toBe(true);
    // Each district carries its own piece of the lot for the engine to cut separately.
    for (const d of p.heightDistricts) {
      expect(d.geometry!.type).toBe("MultiPolygon");
      expect(d.geometry).not.toEqual(p.geometry);
    }
  });
});

describe("getParcelAt", () => {
  it("finds the parcel under a point", async () => {
    const p = (await adapter.getParcelAt(-122.49168705, 37.73184366))!;
    expect(p.blklot).toBe("7261001");
    expect(p.address.label).toBe("4501 Ocean Ave");
    expect(p.zoning.code).toBe("RH-1(D)");
    expect(p.lotAreaSqFt).toBeCloseTo(3122.19, 1);
    expect(p.heightDistricts.map((d) => d.parsed)).toEqual([
      { kind: "r4", baseHeightFt: 40, localProgramHeightFt: 40 },
    ]);
  });
});

describe("normalizeBlklot", () => {
  it("accepts block/lot forms and rejects anything else", () => {
    expect(normalizeBlklot(" 0792t001a ")).toBe("0792T001A");
    expect(() => normalizeBlklot("12")).toThrow(/not a block\/lot/);
    expect(() => normalizeBlklot("0044030' OR 1=1")).toThrow();
  });
});
