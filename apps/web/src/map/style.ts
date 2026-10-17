import { availableDistricts, loadDistrict, TILE_LAYERS } from "@zoningviz/jurisdictions/sf";
import type { ExpressionSpecification, FilterSpecification, LayerSpecification } from "maplibre-gl";

// Map layers over the basemap. Red is reserved for removed volume in the scene,
// so no color here may be red (checked in map.test.ts).

export const SOURCE = "sf";

/** One color per district with a rule file. */
export const DISTRICT_COLORS: Record<string, string> = {
  "RH-1(D)": "#2a9d8f",
  "RH-1": "#5fa85b",
  "RH-1(S)": "#93b84a",
  "RH-2": "#4a7fc1",
  "RH-3": "#8a6cc4",
  // RM: golds, light to dark with density.
  "RM-1": "#e5cb61",
  "RM-2": "#d3b436",
  "RM-3": "#ae9529",
  "RM-4": "#84731f",
  // NC: cyans and slate.
  "NC-1": "#63b6c9",
  "NC-2": "#2f8fa8",
  "NC-3": "#1f6a7f",
  "NC-S": "#7a9cb3",
  // Named NCD and NCT districts: deep teals and blue-greens, apart from NC's cyans.
  "NCD-EXCELSIOR": "#3d8c7a",
  "NCD-GEARY BOULEVARD": "#2c6e63",
  "NCD-NORTH BEACH": "#5aa58f",
  "NCT-MISSION": "#3f7f9c",
  "NCT-VALENCIA": "#5b93ad",
  "NCD-INNER SUNSET": "#6bb39d",
  "NCD-POLK": "#24786b",
  "NCD-TARAVAL": "#4c9a86",
  "NCD-UNION": "#1d5f56",
  "NCT-HAYES": "#2e6f8e",
  "NCD-24TH-NOE-VALLEY": "#7cbca8",
  "NCD-INNER CLEMENT": "#3a8f7c",
  "NCD-MISSION BERNAL": "#2a6a5c",
  "NCD-SAN BRUNO AVENUE": "#5f9f8c",
  "NCT-DIVISADERO": "#477fa0",
  // RTO: mauves, light to dark (neighborhood, Mission, commercial).
  "RTO-1": "#c48bbf",
  "RTO-M": "#a25d9c",
  "RTO-C": "#7d3f78",
};
export const OTHER_RESIDENTIAL = "#b9b4a3";
export const OTHER_ZONING = "#c5c8ce";
export const PARCEL_LINE = "#5b6370";
export const HOVER_LINE = "#1f2933";
export const SELECTED_LINE = "#2f5d8a";

export const LAYER = {
  tint: "zoning-tint",
  fill: "parcel-fill",
  lines: "parcel-lines",
  hover: "parcel-hover",
  selected: "parcel-selected",
} as const;

export interface LegendEntry {
  color: string;
  label: string;
}

export function legend(): LegendEntry[] {
  return [
    ...availableDistricts().map((code) => ({ color: DISTRICT_COLORS[code] ?? OTHER_ZONING, label: `${code} · ${loadDistrict(code)?.name ?? ""}` })),
    { color: OTHER_RESIDENTIAL, label: "Other residential zoning (not covered yet)" },
    { color: OTHER_ZONING, label: "Other zoning (not covered yet)" },
  ];
}

function tintColor(): ExpressionSpecification {
  const pairs = availableDistricts().flatMap((code) => [code, DISTRICT_COLORS[code] ?? OTHER_ZONING]);
  return [
    "match",
    ["get", "zoning"],
    ...pairs,
    ["match", ["get", "gen"], "Residential", OTHER_RESIDENTIAL, OTHER_ZONING],
  ] as unknown as ExpressionSpecification;
}

export function lotFilter(blklot: string | null): FilterSpecification {
  return ["==", ["get", "blklot"], blklot ?? ""];
}

export function mapLayers(tint: boolean): LayerSpecification[] {
  return [
    {
      id: LAYER.tint,
      type: "fill",
      source: SOURCE,
      "source-layer": TILE_LAYERS.zoning,
      layout: { visibility: tint ? "visible" : "none" },
      paint: { "fill-color": tintColor(), "fill-opacity": ["interpolate", ["linear"], ["zoom"], 12, 0.5, 17, 0.32] },
    },
    {
      // Invisible, but it still answers hover and click.
      id: LAYER.fill,
      type: "fill",
      source: SOURCE,
      "source-layer": TILE_LAYERS.parcels,
      paint: { "fill-color": "#000000", "fill-opacity": 0 },
    },
    {
      id: LAYER.lines,
      type: "line",
      source: SOURCE,
      "source-layer": TILE_LAYERS.parcels,
      minzoom: 14.5,
      paint: {
        "line-color": PARCEL_LINE,
        "line-opacity": ["interpolate", ["linear"], ["zoom"], 14.5, 0.25, 17, 0.6],
        "line-width": ["interpolate", ["linear"], ["zoom"], 15, 0.4, 19, 1.2],
      },
    },
    {
      id: LAYER.hover,
      type: "line",
      source: SOURCE,
      "source-layer": TILE_LAYERS.parcels,
      filter: lotFilter(null),
      paint: { "line-color": HOVER_LINE, "line-width": 2.5 },
    },
    {
      id: LAYER.selected,
      type: "line",
      source: SOURCE,
      "source-layer": TILE_LAYERS.parcels,
      filter: lotFilter(null),
      paint: { "line-color": SELECTED_LINE, "line-width": 4 },
    },
  ];
}

/** Every color the map layers use, for the no-red check. */
export function mapColors(): string[] {
  return [...Object.values(DISTRICT_COLORS), OTHER_RESIDENTIAL, OTHER_ZONING, PARCEL_LINE, HOVER_LINE, SELECTED_LINE];
}
