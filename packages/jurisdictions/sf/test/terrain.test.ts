import { describe, expect, it } from "vitest";
import { gridOver, gridPoints, samplesBody, toElevations } from "../terrain";

describe("terrain grids", () => {
  it("covers the lot plus padding, as fine as the 1,000-point limit allows", () => {
    const g = gridOver([1000, 2000, 1025, 2100], 10, 3);
    expect([g.x0, g.y0]).toEqual([990, 1990]);
    expect(g.nx * g.ny).toBeLessThanOrEqual(1000);
    expect(g.x0 + (g.nx - 1) * g.spacingFt).toBeGreaterThanOrEqual(1035);
    expect(g.y0 + (g.ny - 1) * g.spacingFt).toBeGreaterThanOrEqual(2110);
    expect(g.spacingFt).toBeGreaterThanOrEqual(3);
    // A big lot gets a coarser grid rather than more points.
    const big = gridOver([0, 0, 400, 400], 150, 10);
    expect(big.nx * big.ny).toBeLessThanOrEqual(1000);
    expect(big.spacingFt).toBeGreaterThan(10);
  });

  it("lists points row by row and asks for them in EPSG:2227", () => {
    const g = { x0: 0, y0: 0, spacingFt: 5, nx: 2, ny: 2 };
    expect(gridPoints(g)).toEqual([
      [0, 0],
      [5, 0],
      [0, 5],
      [5, 5],
    ]);
    const body = new URLSearchParams(samplesBody(gridPoints(g)));
    expect(JSON.parse(body.get("geometry")!)).toEqual({ points: gridPoints(g), spatialReference: { wkid: 2227 } });
    expect(body.get("geometryType")).toBe("esriGeometryMultipoint");
  });

  it("converts meters to US survey feet and fills NoData from the neighbors", () => {
    const g = { x0: 0, y0: 0, spacingFt: 5, nx: 3, ny: 1 };
    const { elevationsFt, rasterIds } = toElevations(
      {
        samples: [
          { locationId: 0, value: "10", rasterId: 7 },
          { locationId: 1, value: "NoData", rasterId: 7 },
          { locationId: 2, value: "12", rasterId: 7 },
        ],
      },
      g,
    );
    expect(elevationsFt[0]).toBeCloseTo(10 * (3937 / 1200), 9);
    expect(elevationsFt[1]).toBeCloseTo(11 * (3937 / 1200), 6);
    expect(elevationsFt[2]).toBeCloseTo(12 * (3937 / 1200), 9);
    expect(rasterIds).toEqual([7, 7, 7]);
    expect(() => toElevations({ error: { message: "Unable to complete operation." } }, g)).toThrow(/Unable to complete/);
  });
});
