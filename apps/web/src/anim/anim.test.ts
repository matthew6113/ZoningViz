import { createEngine, syntheticLot } from "@zoningviz/engine";
import { loadDistrict } from "@zoningviz/jurisdictions/sf";
import { describe, expect, it } from "vitest";
import type { OkResult } from "../state/steps";
import { buildSchedule, nextPosition, positionAt, previousPosition } from "./schedule";
import { buildTimeline, ENVELOPE_OPACITY, initialState, LIFT_FT, stepLabel } from "./timeline";

// Fixture A from SPEC.md, computed by the real engine.
const engine = await createEngine();
const result = engine.computeEnvelope(syntheticLot(25, 100, { label: "40-X", heightFt: 40, bulk: "X" }), loadDistrict("RH-2")!, {
  overrides: { "front-setback": { feet: 0 } },
}) as OkResult;

describe("schedule", () => {
  const s = buildSchedule(result, "full");

  it("gives each kind of rule its beats", () => {
    // use, height reference, Housing Choice-SF (not R-4), height, RH-2 cap, rear yard, setback (0 ft), front plane, bulk (X: none), narrow streets, cross-slope
    expect(s.rules.map((r) => r.kind)).toEqual(["card", "card", "card", "cut", "satisfied", "cut", "satisfied", "cut", "card", "card", "card"]);
    const lengths = s.rules.map((r) => Number((r.end - r.start).toFixed(3)));
    expect(lengths).toEqual([1.5, 1.5, 1.5, 3.5, 1.8, 3.5, 1.8, 3.5, 1.5, 1.5, 1.5]);
  });

  it("rests each cutting step after its cut, before the red piece lifts", () => {
    const rear = s.rules[5]!;
    expect(rear.label - rear.start).toBeCloseTo(0.6 + 0.8 + 1.2, 6);
  });

  it("totals the opening, every rule and the finale with its 4 floors", () => {
    expect(s.duration).toBeCloseTo(2.7 + 23.1 + 0.8 + 4 * 0.35 + 0.6, 6);
    expect(s.labels).toHaveLength(13);
    expect([...s.labels].sort((a, b) => a - b)).toEqual(s.labels);
  });

  it("works out positions and Next/Back targets from any time", () => {
    expect(positionAt(s, 0)).toBe(0);
    // Resting points that coincide with the next step's start still belong to their own step.
    s.labels.forEach((time, p) => expect(positionAt(s, time)).toBe(p));
    expect(positionAt(s, s.rules[5]!.start + 0.1)).toBe(6);
    expect(positionAt(s, s.duration)).toBe(12);
    expect(nextPosition(s, s.labels[0]!)).toBe(1);
    expect(nextPosition(s, s.rules[5]!.start + 0.1)).toBe(6); // finish the step in progress
    expect(previousPosition(s, s.labels[6]!)).toBe(5);
    expect(previousPosition(s, s.rules[5]!.remove + 0.1)).toBe(6); // past the rest point: back to it
  });
});

describe("timeline", () => {
  const s = buildSchedule(result, "full");
  const state = initialState(result);
  const tl = buildTimeline(result, s, state);

  it("rests on the rear-yard step with the red piece in place", () => {
    tl.seek(stepLabel(6));
    expect(state).toMatchObject({ rule: 5, tint: 1, lift: 0, removedOpacity: ENVELOPE_OPACITY, measure: 1, camera: 1, rise: 1 });
    expect(state.volume).toBeCloseTo(70_000, 3); // the counters ticked down with the cut, so the step shows its own totals
    tl.seek(s.rules[5]!.cut);
    expect(state.volume).toBeCloseTo(100_000, 3); // and not before it
  });

  it("lifts and fades the piece during the remove beat", () => {
    const rear = s.rules[5]!;
    tl.seek(rear.remove + 0.45);
    expect(state.lift).toBeGreaterThan(0);
    expect(state.lift).toBeLessThan(LIFT_FT);
    expect(state.removedOpacity).toBeGreaterThan(0);
    expect(state.removedOpacity).toBeLessThan(ENVELOPE_OPACITY);
    tl.seek(rear.end);
    expect(state.volume).toBeCloseTo(70_000, 3);
  });

  it("scrubs back to earlier steps and restores them exactly", () => {
    tl.seek(stepLabel(4));
    expect(state).toMatchObject({ rule: 3, tint: 1, lift: 0 });
    expect(state.volume).toBeCloseTo(100_000, 3); // the 40 ft height cut has landed
    tl.seek(0);
    expect(state).toMatchObject({ rule: -1, camera: 0, rise: 0, tint: 0, finale: 0, floors: 0 });
  });

  it("ends solid with all four floors", () => {
    tl.seek(s.duration);
    expect(state.finale).toBe(1);
    expect(state.floors).toBe(4);
    expect(state.volume).toBeCloseTo(68_750, 3);
    expect(tl.duration()).toBeCloseTo(s.duration, 6);
  });
});

describe("reduced motion", () => {
  const s = buildSchedule(result, "reduced");
  const state = initialState(result, "reduced");
  const tl = buildTimeline(result, s, state);

  it("skips the flight, the sweep and the lift, and still crossfades the cut away", () => {
    tl.seek(0);
    expect(state.camera).toBe(1);
    expect(state.rise).toBe(1);
    const rear = s.rules[5]!;
    tl.seek(rear.remove + s.durations.remove / 2);
    expect(state.lift).toBe(0);
    expect(state.sweep).toBe(0);
    expect(state.removedOpacity).toBeLessThan(ENVELOPE_OPACITY);
    expect(s.duration).toBeLessThan(buildSchedule(result, "full").duration);
  });
});
