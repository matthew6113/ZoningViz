import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createSfAdapter, normalizeBlklot } from "../adapter";
import { DATASETS } from "../datasf";
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
    expect(p.zoning).toEqual({ code: "RH-2", codes: ["RH-2"], name: "RESIDENTIAL- HOUSE, TWO FAMILY", source: "parcel" });
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
    expect(p.asOf).toEqual({ parcels: "2026-10-01", heightDistricts: "2026-10-10", specialUseDistricts: "2026-10-16" });
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

// Special use district lookups were recorded on 2026-10-16, after the rest.
describe("special use districts", () => {
  it("lists the districts a lot lies in, with their code links", async () => {
    const p = (await adapter.getParcelByBlockLot("0044030"))!;
    expect(p.specialUseDistricts).toEqual([
      {
        name: "Family and Senior Housing Opportunity SUD",
        url: "https://codelibrary.amlegal.com/codes/san_francisco/latest/sf_planning/0-0-0-68325",
      },
    ]);
    const mission = (await adapter.getParcelByBlockLot("4276045"))!;
    // One entry per name, sorted, though some districts are mapped in several pieces.
    expect(mission.specialUseDistricts!.map((d) => d.name)).toEqual([
      "Calle 24 SUD",
      "Fringe Financial Services RUD",
      "Mission Alcohol Restrict",
      "Priority Equity Geographies SUD",
      "Within 1/4 Mile of an Existing Fringe Financial Service",
    ]);
  });

  // A 50 x 100 ft lot near 37.75° N, as DataSF would serve it. With `perSide` > 1 each side
  // is cut into that many pieces with every other point nudged 0.02 ft (a detailed outline,
  // like a surveyed curve, makes a long query).
  const LON = -122.45;
  const LAT = 37.75;
  const FT_LAT = 1 / 364_000;
  const FT_LON = FT_LAT / Math.cos((LAT * Math.PI) / 180);
  const box = (x0: number, y0: number, x1: number, y1: number, perSide = 1) => {
    const corners: [number, number][] = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
    const ring: [number, number][] = [];
    corners.forEach(([ax, ay], i) => {
      const [bx, by] = corners[(i + 1) % 4]!;
      for (let k = 0; k < perSide; k++) {
        const t = k / perSide;
        const nudge = k % 2 ? 0.02 : 0;
        ring.push([LON + (ax + (bx - ax) * t + nudge) * FT_LON, LAT + (ay + (by - ay) * t + nudge) * FT_LAT]);
      }
    });
    ring.push(ring[0]!);
    return { type: "Polygon" as const, coordinates: [ring] };
  };

  function stubAdapter(perSide: number, specialUse: (url: string) => unknown) {
    const urls: string[] = [];
    const lot = createSfAdapter({
      fetchJson: async (url) => {
        urls.push(url);
        if (url.includes("/api/views/")) return { rowsUpdatedAt: 1760572800 };
        if (url.includes(DATASETS.specialUseDistricts)) return specialUse(url);
        if (url.includes(DATASETS.heightBulkDistricts)) return [{ height: "40-X", gen_hght: "40" }];
        if (url.includes("%24select=blklot")) return []; // condo units
        return [
          {
            blklot: "9999001",
            mapblklot: "9999001",
            active: true,
            zoning_code: "RH-2",
            shape: box(0, 0, 50, 100, perSide),
            centroid_longitude: String(LON + 25 * FT_LON),
            centroid_latitude: String(LAT + 50 * FT_LAT),
          },
        ];
      },
    });
    return { lot, urls };
  }

  it("asks with the lot shrunk by a foot, so districts that only meet its edge aren't listed", async () => {
    const { lot, urls } = stubAdapter(1, () => [{ name: "Some SUD", url: "https://example.org/sud" }]);
    const p = (await lot.getParcelByBlockLot("9999001"))!;
    expect(p.specialUseDistricts).toEqual([{ name: "Some SUD", url: "https://example.org/sud" }]);
    const query = new URL(urls.find((u) => u.includes(DATASETS.specialUseDistricts))!).searchParams;
    expect(query.get("$select")).toBe("name,url");
    const points = [...query.get("$where")!.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map((m) => [
      (Number(m[1]) - LON) / FT_LON,
      (Number(m[2]) - LAT) / FT_LAT,
    ]);
    for (const [x, y] of points) {
      expect(Math.min(x!, 50 - x!, y!, 100 - y!)).toBeGreaterThan(0.9);
      expect(Math.min(x!, 50 - x!, y!, 100 - y!)).toBeLessThan(1.1);
    }
  });

  it("measures the overlap itself when the lot's outline is too detailed for a query", async () => {
    const { lot, urls } = stubAdapter(100, () => [
      { name: "Half SUD", url: "https://example.org/half", the_geom: box(-50, -10, 25, 110) },
      { name: "Next Door SUD", url: "https://example.org/next", the_geom: box(50, -10, 120, 110) },
    ]);
    const p = (await lot.getParcelByBlockLot("9999001"))!;
    expect(p.specialUseDistricts).toEqual([{ name: "Half SUD", url: "https://example.org/half" }]);
    const query = new URL(urls.find((u) => u.includes(DATASETS.specialUseDistricts))!).searchParams;
    expect(query.get("$select")).toBe("name,url,the_geom");
    expect(query.get("$where")).toMatch(/^intersects\(the_geom,'POLYGON\(\(/); // the bounding box
  });

  it("still loads the lot when the layer can't be read", async () => {
    const { lot } = stubAdapter(1, () => {
      throw new Error("503 Service Unavailable");
    });
    const p = (await lot.getParcelByBlockLot("9999001"))!;
    expect(p.specialUseDistricts).toBeNull();
    expect(p.warnings).toContain("Special use districts couldn't be checked.");
    expect(p.heightDistricts.map((d) => d.label)).toEqual(["40-X"]);
  });
});

describe("normalizeBlklot", () => {
  it("accepts block/lot forms and rejects anything else", () => {
    expect(normalizeBlklot(" 0792t001a ")).toBe("0792T001A");
    expect(normalizeBlklot("5335acomh")).toBe("5335ACOMH"); // a common-area land record
    expect(() => normalizeBlklot("12")).toThrow(/not a block\/lot/);
    expect(() => normalizeBlklot("4025 007")).toThrow(/not a block\/lot/);
    expect(() => normalizeBlklot("0044030' OR 1=1")).toThrow();
  });
});

describe("searchAddresses", () => {
  it("finds an address from its first few characters", async () => {
    expect(await adapter.searchAddresses("667 hamp")).toEqual([
      { label: "667 Hampshire St", blklot: "4025007", lon: expect.closeTo(-122.40779, 5), lat: expect.closeTo(37.76102, 5) },
    ]);
  });

  it("understands spelled-out street types and unpadded numbered streets", async () => {
    const [hit] = await adapter.searchAddresses("752 4th avenue");
    expect(hit).toMatchObject({ label: "752 4th Ave", blklot: "1646023" });
    const [corner] = await adapter.searchAddresses("2550 19th street");
    expect(corner).toMatchObject({ label: "2550 19th St", blklot: "4025006" });
  });

  it("doesn't query for text without a house number", async () => {
    expect(await adapter.searchAddresses("Hampshire")).toEqual([]);
    expect(await adapter.searchAddresses("66")).toEqual([]);
  });
});

describe("getTerrain", () => {
  it("samples the ground around 667 Hampshire St from USGS 3DEP, in feet", async () => {
    const p = (await adapter.getParcelByBlockLot("4025007"))!;
    const t = (await adapter.getTerrain(p))!;
    expect(t.source).toBe("USGS 3DEP 1 m LiDAR (CA_SanFrancisco_B23)");
    expect(t.asOf).toBe("2023-04-20");
    expect(t.fine.nx * t.fine.ny).toBeLessThanOrEqual(1000);
    expect(t.context!.nx * t.context!.ny).toBeLessThanOrEqual(1000);
    expect(t.fine.elevationsFt).toHaveLength(t.fine.nx * t.fine.ny);
    // The Mission flats: tens of feet above sea level, a few feet of relief across the lot.
    const z = t.fine.elevationsFt;
    expect(Math.min(...z)).toBeGreaterThan(40);
    expect(Math.max(...z)).toBeLessThan(80);
  });

  const replay = withDiskCache(async (u) => {
    throw new Error(`Not recorded: ${u}`);
  }, FIXTURES);

  it("returns null when the elevation service keeps failing, so the lot is treated as flat", async () => {
    const failing = createSfAdapter({
      terrainRetryDelaysMs: [0, 0],
      fetchJson: async (url, body) => {
        if (url.includes("nationalmap")) throw new Error("502 Bad Gateway");
        return replay(url, body);
      },
    });
    const p = (await failing.getParcelByBlockLot("4025007"))!;
    expect(await failing.getTerrain(p)).toBeNull();
  });

  it("retries a transient failure, and keeps the fine grid when only the context grid fails", async () => {
    const seen = new Map<string, number>();
    const flaky = createSfAdapter({
      terrainRetryDelaysMs: [0, 0],
      fetchJson: async (url, body) => {
        if (url.includes("getSamples")) {
          const key = body!;
          const count = (seen.get(key) ?? 0) + 1;
          seen.set(key, count);
          // Every grid fails once; the context grid (10 ft or coarser spacing) never recovers.
          const [p0, p1] = JSON.parse(new URLSearchParams(body).get("geometry")!).points as [number, number][];
          const isContext = p1![0] - p0![0] >= 10;
          if (count === 1 || isContext) throw new Error("502 Bad Gateway");
        }
        return replay(url, body);
      },
    });
    const p = (await flaky.getParcelByBlockLot("4025007"))!;
    const t = await flaky.getTerrain(p);
    expect(t).not.toBeNull();
    expect(t!.fine.elevationsFt.length).toBeGreaterThan(0);
    expect(t!.context).toBeNull();
  });
});
