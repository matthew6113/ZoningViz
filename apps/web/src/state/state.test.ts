import { describe, expect, it } from "vitest";
import { parseUrlState, toSearch } from "./url";

describe("URL state", () => {
  it("round-trips every field", () => {
    const state = { parcel: "4025006", step: 4, front: 1, setback: 2.5, off: ["rear-yard", "front-plane"] };
    expect(parseUrlState(toSearch(state))).toEqual(state);
  });

  it("ignores malformed values", () => {
    expect(parseUrlState("?parcel=%20&step=-1&front=x&setback=-3&off=,Bad%20Id")).toEqual({
      parcel: null,
      step: null,
      front: null,
      setback: null,
      off: [],
    });
  });

  it("omits empty fields", () => {
    expect(toSearch({ parcel: "fixture-a", step: null, front: null, setback: null, off: [] })).toBe("?parcel=fixture-a");
  });
});
