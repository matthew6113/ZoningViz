import { describe, expect, it } from "vitest";
import { engineToThree } from "./coords";
import { ringsToShape, ringToPoints, solidToGeometry } from "./geometry";

describe("scene geometry", () => {
  it("maps engine z-up coordinates to three's y-up", () => {
    expect(engineToThree([1, 2, 3])).toEqual([1, 3, -2]);
  });

  it("turns an engine solid into an indexed geometry", () => {
    const solid = {
      volume: 1 / 6,
      positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1]),
      indices: new Uint32Array([0, 2, 1, 0, 1, 3, 0, 3, 2, 1, 2, 3]),
    };
    const g = solidToGeometry(solid);
    expect(g.getAttribute("position").count).toBe(4);
    expect(g.getIndex()!.count / 3).toBe(4);
    expect(g.getAttribute("normal")).toBeDefined();
  });

  it("keeps holes and closes outline loops", () => {
    const square = [[0, 0], [10, 0], [10, 10], [0, 10]] as [number, number][];
    expect(ringsToShape([square, [[2, 2], [4, 2], [4, 4]]]).holes).toHaveLength(1);
    expect(ringToPoints(square, 1).at(-1)).toEqual([0, 0, 1]);
  });
});
