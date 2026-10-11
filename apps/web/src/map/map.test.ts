import { availableDistricts } from "@zoningviz/jurisdictions/sf";
import { describe, expect, it } from "vitest";
import { COLORS } from "../scene/palette";
import { feetPerPixel, parseBlockLot } from "./geo";
import { DISTRICT_COLORS, legend, mapColors, mapLayers } from "./style";

function hsl(hex: string): { h: number; s: number; l: number } {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s, l };
}

describe("map colors", () => {
  it("never use red, which is reserved for removed volume", () => {
    const red = hsl(COLORS.removed).h;
    for (const color of mapColors()) {
      const { h, s } = hsl(color);
      const fromRed = Math.min(Math.abs(h - red), 360 - Math.abs(h - red));
      expect(s < 0.25 || fromRed > 35, `${color} is too close to the removed-volume red`).toBe(true);
    }
  });

  it("give every covered district its own color and a legend entry", () => {
    const covered = availableDistricts();
    expect(Object.keys(DISTRICT_COLORS).sort()).toEqual([...covered].sort());
    expect(new Set(Object.values(DISTRICT_COLORS)).size).toBe(covered.length);
    expect(legend().map((e) => e.label.split(" · ")[0])).toEqual(expect.arrayContaining(covered));
  });

  it("hide the zoning tint when it is switched off", () => {
    const tint = (on: boolean) => mapLayers(on).find((l) => l.id === "zoning-tint")!.layout;
    expect(tint(true)).toEqual({ visibility: "visible" });
    expect(tint(false)).toEqual({ visibility: "none" });
  });
});

describe("map helpers", () => {
  it.each([
    ["4025/007", "4025007"],
    ["4025 007", "4025007"],
    ["4025-007", "4025007"],
    [" 0792t001a ", "0792T001A"],
    ["667 Hampshire", null],
    ["402500", null],
  ])("reads %j as block/lot %j", (text, blklot) => {
    expect(parseBlockLot(text)).toBe(blklot);
  });

  it("works out ground feet per pixel from latitude and zoom", () => {
    // At the equator, zoom 0 spans the Earth in 512 px.
    expect(feetPerPixel(0, 0)).toBeCloseTo(40_075_016.686 / 512 / 0.3048, 3);
    // Each zoom level halves it; San Francisco's latitude shrinks it by cos(37.76°).
    expect(feetPerPixel(37.76, 19) / feetPerPixel(37.76, 18)).toBeCloseTo(0.5, 9);
    expect(feetPerPixel(37.76, 19)).toBeCloseTo(0.3872, 4);
  });
});
