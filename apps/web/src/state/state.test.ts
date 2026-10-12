import { describe, expect, it } from "vitest";
import { EMPTY_URL_STATE, parseUrlState, toSearch } from "./url";

describe("URL state", () => {
  it("round-trips every field", () => {
    const state = {
      parcel: "4025006",
      step: 4,
      front: 1,
      setback: 2.5,
      off: ["rear-yard", "front-plane"],
      program: true,
      at: { lon: -122.40779, lat: 37.76102, zoom: 18.5 },
    };
    expect(parseUrlState(toSearch(state))).toEqual(state);
  });

  it("writes the map view and rule lists with plain commas", () => {
    const search = toSearch({ ...EMPTY_URL_STATE, off: ["a", "b"], at: { lon: -122.4077912, lat: 37.761017, zoom: 18 } });
    expect(search).toBe("?off=a,b&at=-122.40779,37.76102,18.00");
  });

  it("ignores malformed values", () => {
    expect(parseUrlState("?parcel=%20&step=-1&front=x&setback=-3&off=,Bad%20Id&program=yes&at=1,2")).toEqual(EMPTY_URL_STATE);
    expect(parseUrlState("?at=-122.4,95,12").at).toBeNull();
    expect(parseUrlState("?at=-122.4,37.7,zoom").at).toBeNull();
  });

  it("omits empty fields", () => {
    expect(toSearch({ ...EMPTY_URL_STATE, parcel: "fixture-a" })).toBe("?parcel=fixture-a");
  });
});
