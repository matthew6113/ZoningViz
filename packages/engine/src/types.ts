import type { MultiPolygon } from "geojson";
import type { XY } from "./geometry/projection";
import type { Rule } from "./rules/schema";

// ---------- Input (city-agnostic; a jurisdiction adapter builds it) ----------

export interface HeightZoneInput {
  /** The mapped district label, e.g. "40-X" or "40//50-R-4". */
  label: string;
  /** Height limit that governs here (for R-4, the base height). Null when the label can't be read. */
  heightFt: number | null;
  /** R-4 only: the higher height available through the local program. Shown, never cut to. */
  localProgramHeightFt?: number | null;
  /** The part of the lot inside this district. */
  geometry: MultiPolygon;
}

export interface ParcelInput {
  id: string;
  /** proj4 definition for a planar CRS in feet, or null when coordinates are already planar feet. */
  projection: string | null;
  footprint: MultiPolygon;
  /** Adjacent land parcels; lot edges they don't touch are treated as street frontage. */
  neighbors: MultiPolygon[];
  heightZones: HeightZoneInput[];
}

export interface EnvelopeOptions {
  /** Index into the front candidates, required when a lot has more than one street side. */
  frontSide?: number;
  /** Per-rule user values, keyed by rule id, for rules that allow an override. */
  overrides?: Record<string, { feet?: number }>;
  /** Rules to skip, so the viewer can see what a single rule costs. */
  disabledRuleIds?: string[];
  /** Floor-to-floor height for slicing the final envelope. Default 10 ft. */
  floorToFloorFeet?: number;
}

// ---------- Output ----------

export type Vec3 = [number, number, number];

/** A closed triangle mesh in world feet (x east, y north, z up, origin at the lot centroid). */
export interface Solid {
  volume: number;
  positions: Float32Array;
  indices: Uint32Array;
}

/** A dimension line for the scene: from one point to another, with its label. */
export interface Dimension {
  from: Vec3;
  to: Vec3;
  label: string;
}

export type StepStatus = "cut" | "already_satisfied" | "info" | "not_modeled" | "disabled";

export interface StepMeasurements {
  volume: number;
  removedVolume: number;
  footprintSqFt: number;
  percentOfStart: number;
}

export interface Step {
  rule: Rule;
  status: StepStatus;
  /** The resolved card sentence, e.g. "Rear yard: 30% of 100 ft lot depth = 30 ft." */
  sentence: string;
  /** The resolved numbers behind the sentence. */
  numbers: Record<string, number>;
  dimensions: Dimension[];
  before: Solid;
  removed: Solid | null;
  after: Solid;
  measurements: StepMeasurements;
}

export interface FrontCandidate {
  index: number;
  /** Chord of this street side, in world feet, in counter-clockwise ring order. */
  from: XY;
  to: XY;
  lengthFt: number;
  /** The side as drawn, including any bends; `from`/`to` are its ends. */
  path: XY[];
  /** Unit vector pointing from the lot toward the street. */
  outward: XY;
}

export interface LotInfo {
  areaSqFt: number;
  widthFt: number;
  depthFt: number;
  /** True when width × depth is only an approximation of the lot's shape. */
  approximate: boolean;
  front: FrontCandidate;
  frontCandidates: FrontCandidate[];
  /** Lot outline in world feet (polygons → rings → points). */
  outline: XY[][][];
  /** Neighbor outlines in world feet, for context in the scene. */
  neighbors: XY[][][][];
  /** The planar point (in the input CRS) that world coordinates are measured from. */
  originPlanar: XY;
}

export interface Floor {
  index: number;
  bottomFt: number;
  topFt: number;
  /** Plate area at mid-story. */
  plateSqFt: number;
  outline: XY[][];
}

export interface EnvelopeTotals {
  volume: number;
  footprintSqFt: number;
  stories: number;
  grossFloorAreaSqFt: number;
  percentSurvived: number;
}

export type EnvelopeResult =
  | {
      status: "needs_front_choice";
      candidates: FrontCandidate[];
      /** Lot and neighbor outlines in world feet, so the choice can be drawn. */
      outline: XY[][][];
      neighbors: XY[][][][];
      originPlanar: XY;
    }
  | {
      status: "ok";
      lot: LotInfo;
      start: Solid & { heightFt: number };
      steps: Step[];
      final: Solid;
      floors: Floor[];
      totals: EnvelopeTotals;
      notes: string[];
    };
