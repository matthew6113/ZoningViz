import { describe, expect, it } from "vitest";
import {
  createProjector,
  multiPolygonArea,
  polygonArea,
  projectMultiPolygon,
  signedRingArea,
} from "../src/geometry/projection";

// EPSG:2227 as PROJ's EPSG database expands it. The expected coordinates below
// were produced independently with pyproj (Transformer EPSG:4269 -> EPSG:2227).
const EPSG_2227 =
  "+proj=lcc +lat_0=36.5 +lon_0=-120.5 +lat_1=38.4333333333333 +lat_2=37.0666666666667 " +
  "+x_0=2000000.0001016 +y_0=500000.0001016 +datum=NAD83 +units=us-ft +no_defs";

describe("createProjector", () => {
  it.each([
    [[-122.4194, 37.7749], [6006957.098431595, 2110309.1814640397]],
    [[-122.49168705, 37.73184366], [5985735.49751696, 2095071.5993679378]],
    [[-122.3893, 37.808], [6015898.152653919, 2122182.160121486]],
  ])("projects %j to the EPSG:2227 reference", (lonLat, [x, y]) => {
    const [px, py] = createProjector(EPSG_2227)(lonLat);
    expect(px).toBeCloseTo(x!, 2);
    expect(py).toBeCloseTo(y!, 2);
  });
});

describe("areas", () => {
  const square = [[0, 0], [100, 0], [100, 25], [0, 25], [0, 0]] as [number, number][];

  it("computes shoelace area with sign from winding", () => {
    expect(signedRingArea(square)).toBe(2500);
    expect(signedRingArea([...square].reverse())).toBe(-2500);
  });

  it("subtracts holes regardless of winding", () => {
    const hole = [[10, 5], [20, 5], [20, 15], [10, 15], [10, 5]] as [number, number][];
    expect(polygonArea([square, hole])).toBe(2400);
    expect(polygonArea([square, [...hole].reverse()])).toBe(2400);
  });

  it("sums multipolygon parts", () => {
    expect(multiPolygonArea([[square], [square]])).toBe(5000);
  });

  it("projects a small lon/lat rectangle to a consistent planar area", () => {
    // A ~0.0001° box near Ocean Ave; area must be positive and stable under ring reversal.
    const ring = [
      [-122.4918, 37.7318],
      [-122.4917, 37.7318],
      [-122.4917, 37.7319],
      [-122.4918, 37.7319],
      [-122.4918, 37.7318],
    ];
    const a = multiPolygonArea(projectMultiPolygon({ type: "Polygon", coordinates: [ring] }, EPSG_2227));
    const b = multiPolygonArea(projectMultiPolygon({ type: "Polygon", coordinates: [[...ring].reverse()] }, EPSG_2227));
    expect(a).toBeGreaterThan(0);
    expect(a).toBeCloseTo(b, 6);
  });
});
