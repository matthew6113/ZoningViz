import { describe, expect, it } from "vitest";
import { addressOf, displayAddress, normalizeAddressQuery } from "../address";
import { parcelPageUrl, parseBoxes, toParcelFeature, toZoningFeature, zoningPageUrl } from "../tiles";

const square = { type: "MultiPolygon" as const, coordinates: [[[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]] };

describe("addresses", () => {
  it("labels parcel records", () => {
    expect(addressOf({ from_address_num: "766", to_address_num: "772", street_name: "FRANCISCO", street_type: "ST" }).label).toBe(
      "766–772 Francisco St",
    );
    expect(addressOf({ from_address_num: "752", to_address_num: "752", street_name: "04TH", street_type: "AVE" }).label).toBe("752 4th Ave");
    expect(addressOf({ street_name: "UNKNOWN" }).label).toBeNull();
  });

  it("labels address-list entries", () => {
    expect(displayAddress("667 HAMPSHIRE ST")).toBe("667 Hampshire St");
    expect(displayAddress("2550 19TH ST")).toBe("2550 19th St");
    expect(displayAddress("100 O'FARRELL ST")).toBe("100 O'Farrell St");
  });

  it.each([
    ["667 hampshire street", "667 HAMPSHIRE ST"],
    ["752 4th Ave.", "752 04TH AVE"],
    ["  2550   19th  St ", "2550 19TH ST"],
    ["1 Dr Carlton B Goodlett Pl", "1 DR CARLTON B GOODLETT PL"],
    ["100 van ness avenue", "100 VAN NESS AVE"],
  ])("normalizes %j → %j", (typed, normalized) => {
    expect(normalizeAddressQuery(typed)).toBe(normalized);
  });
});

describe("tile features", () => {
  it("keeps block/lot, the collapsed zoning code and the address on each parcel", () => {
    const feature = toParcelFeature({
      mapblklot: "4025007",
      zoning_code: "RH-2|RH-2",
      from_address_num: "667",
      to_address_num: "667",
      street_name: "HAMPSHIRE",
      street_type: "ST",
      shape: square,
    });
    expect(feature).toEqual({ type: "Feature", properties: { blklot: "4025007", zoning: "RH-2", address: "667 Hampshire St" }, geometry: square });
  });

  it("keeps split codes, and leaves out blank fields", () => {
    expect(toParcelFeature({ mapblklot: "1", zoning_code: "RH-1|RH-2", shape: square })!.properties).toEqual({ blklot: "1", zoning: "RH-1|RH-2" });
    expect(toParcelFeature({ mapblklot: "2", zoning_code: "", shape: square })!.properties).toEqual({ blklot: "2" });
    expect(toParcelFeature({ mapblklot: "3" })).toBeNull();
  });

  it("keeps the code and category on each zoning district", () => {
    expect(toZoningFeature({ zoning: "RH-2", gen: "Residential", the_geom: square })!.properties).toEqual({ zoning: "RH-2", gen: "Residential" });
    expect(toZoningFeature({ zoning: "RH-2" })).toBeNull();
  });
});

describe("tile queries", () => {
  it("pages through active land parcels, optionally inside boxes", () => {
    const all = new URL(parcelPageUrl(50_000, 50_000));
    expect(all.pathname).toBe("/resource/acdm-wktn.json");
    expect(all.searchParams.get("$where")).toBe("active=true AND blklot=mapblklot");
    expect(all.searchParams.get("$offset")).toBe("50000");
    const boxed = new URL(parcelPageUrl(0, 10, parseBoxes("-122.41,37.75,-122.40,37.76;-122.5,37.7,-122.49,37.71")));
    expect(boxed.searchParams.get("$where")).toBe(
      "active=true AND blklot=mapblklot AND (intersects(shape,'POLYGON((-122.41 37.75,-122.4 37.75,-122.4 37.76,-122.41 37.76,-122.41 37.75))') OR intersects(shape,'POLYGON((-122.5 37.7,-122.49 37.7,-122.49 37.71,-122.5 37.71,-122.5 37.7))'))",
    );
  });

  it("pages through zoning districts by their geometry column", () => {
    const url = new URL(zoningPageUrl(0, 10, parseBoxes("-122.41,37.75,-122.40,37.76")));
    expect(url.pathname).toBe("/resource/3i4a-hu95.json");
    expect(url.searchParams.get("$where")).toMatch(/^intersects\(the_geom,/);
    expect(new URL(zoningPageUrl(0, 10)).searchParams.has("$where")).toBe(false);
  });

  it("rejects malformed boxes", () => {
    expect(() => parseBoxes("1,2,3")).toThrow(/minLon,minLat,maxLon,maxLat/);
    expect(() => parseBoxes("-122.40,37.75,-122.41,37.76")).toThrow(/Bad box/);
  });
});
