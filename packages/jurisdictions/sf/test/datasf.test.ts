import { describe, expect, it } from "vitest";
import { bboxWkt, multiPolygonWkt, soqlString, soqlUrl } from "../datasf";

describe("SoQL helpers", () => {
  it("escapes single quotes in string literals", () => {
    expect(soqlString("O'FARRELL")).toBe("'O''FARRELL'");
  });

  it("builds resource URLs with $-prefixed clauses", () => {
    const url = new URL(soqlUrl("acdm-wktn", { where: "blklot='0044030'", limit: 5 }));
    expect(url.origin + url.pathname).toBe("https://data.sf.gov/resource/acdm-wktn.json");
    expect(url.searchParams.get("$where")).toBe("blklot='0044030'");
    expect(url.searchParams.get("$limit")).toBe("5");
  });

  it("writes WKT for polygons and their bounding box", () => {
    const square = { type: "Polygon" as const, coordinates: [[[0, 0], [2, 0], [2, 1], [0, 1], [0, 0]]] };
    expect(multiPolygonWkt(square)).toBe("MULTIPOLYGON(((0 0,2 0,2 1,0 1,0 0)))");
    expect(bboxWkt(square)).toBe("POLYGON((0 0,2 0,2 1,0 1,0 0))");
  });
});
