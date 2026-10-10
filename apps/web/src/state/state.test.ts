import { describe, expect, it } from "vitest";
import { clampPosition, lastPosition, revealedCount, viewAt, type OkResult } from "./steps";
import { parseUrlState, toSearch } from "./url";

describe("URL state", () => {
  it("round-trips every field", () => {
    const state = { parcel: "4025006", step: 4, front: 1, setback: 2.5 };
    expect(parseUrlState(toSearch(state))).toEqual(state);
  });

  it("ignores malformed values", () => {
    expect(parseUrlState("?parcel=%20&step=-1&front=x&setback=-3")).toEqual({
      parcel: null,
      step: null,
      front: null,
      setback: null,
    });
  });

  it("omits empty fields", () => {
    expect(toSearch({ parcel: "fixture-a", step: null, front: null, setback: null })).toBe("?parcel=fixture-a");
  });
});

describe("step positions", () => {
  const solid = (volume: number) => ({ volume, positions: new Float32Array(), indices: new Uint32Array() });
  const step = (n: number) => ({ after: solid(n), removed: solid(1), dimensions: [] }) as unknown as OkResult["steps"][number];
  const result = { start: solid(100), final: solid(3), steps: [step(9), step(6), step(3)] } as unknown as OkResult;

  it("runs from the starting block through each rule to the finale", () => {
    expect(lastPosition(result)).toBe(4);
    expect(viewAt(0, result).kind).toBe("start");
    expect(viewAt(2, result)).toMatchObject({ kind: "rule", envelope: { volume: 6 } });
    expect(viewAt(4, result).kind).toBe("finale");
  });

  it("clamps out-of-range steps from the URL", () => {
    expect(clampPosition(null, result)).toBe(0);
    expect(clampPosition(99, result)).toBe(4);
    expect(clampPosition(-2, result)).toBe(0);
  });

  it("reveals cards as the viewer passes them", () => {
    expect([0, 1, 3, 4].map((p) => revealedCount(p, result))).toEqual([0, 1, 3, 3]);
  });
});
