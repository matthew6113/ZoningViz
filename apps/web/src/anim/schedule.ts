import type { OkResult } from "../state/steps";

// When everything happens, in seconds, before any animation library is
// involved. SPEC.md "Animation choreography": an arrival, the starting block,
// then four beats per rule, then the finale.

export type MotionMode = "full" | "reduced";

interface Durations {
  arrival: number;
  rise: number;
  announce: number;
  measure: number;
  cut: number;
  remove: number;
  /** info, flag and switched-off rules: their card only. */
  cardOnly: number;
  /** "Already satisfied": a short hold after the measure beat. */
  satisfiedHold: number;
  finaleSolid: number;
  perFloor: number;
  summary: number;
}

export const DURATIONS: Record<MotionMode, Durations> = {
  full: { arrival: 1.5, rise: 1.2, announce: 0.6, measure: 0.8, cut: 1.2, remove: 0.9, cardOnly: 1.5, satisfiedHold: 0.4, finaleSolid: 0.8, perFloor: 0.35, summary: 0.6 },
  // No flight, rise, sweep or lift: states crossfade, and beats are shorter.
  reduced: { arrival: 0, rise: 0.6, announce: 0.3, measure: 0.4, cut: 0.5, remove: 0.5, cardOnly: 0.8, satisfiedHold: 0.2, finaleSolid: 0.5, perFloor: 0.2, summary: 0.3 },
};

export type RuleSegmentKind = "cut" | "satisfied" | "card";

export interface RuleSegment {
  /** Index into result.steps. */
  index: number;
  kind: RuleSegmentKind;
  /** Absolute start of each beat (announce is the segment start). Absent beats have zero length. */
  start: number;
  measure: number;
  cut: number;
  remove: number;
  /** Where the step rests: the cut complete, red piece still showing. */
  label: number;
  end: number;
}

export interface Schedule {
  mode: MotionMode;
  durations: Durations;
  arrival: { start: number; end: number };
  rise: { start: number; end: number };
  rules: RuleSegment[];
  finale: { start: number; solidEnd: number; floorsEnd: number; summary: number; end: number; floorCount: number };
  /** Resting time of each step position: 0 = starting block, 1…N = rules, N + 1 = result. */
  labels: number[];
  /** When each position begins (its card or opening starts), for working out the position at any time. */
  starts: number[];
  duration: number;
}

export function buildSchedule(result: OkResult, mode: MotionMode): Schedule {
  const d = DURATIONS[mode];
  const arrival = { start: 0, end: d.arrival };
  const rise = { start: arrival.end, end: arrival.end + d.rise };
  let t = rise.end;

  const rules: RuleSegment[] = result.steps.map((step, index) => {
    const kind: RuleSegmentKind =
      step.status === "cut" ? "cut" : step.status === "already_satisfied" ? "satisfied" : "card";
    const start = t;
    if (kind === "card") {
      t = start + d.cardOnly;
      return { index, kind, start, measure: t, cut: t, remove: t, label: t, end: t };
    }
    const measure = start + d.announce;
    const cut = measure + d.measure;
    if (kind === "satisfied") {
      t = cut + d.satisfiedHold;
      return { index, kind, start, measure, cut, remove: t, label: t, end: t };
    }
    const remove = cut + d.cut;
    t = remove + d.remove;
    return { index, kind, start, measure, cut, remove, label: remove, end: t };
  });

  const floorCount = result.floors.length;
  const finaleStart = t;
  const solidEnd = finaleStart + d.finaleSolid;
  const floorsEnd = solidEnd + d.perFloor * floorCount;
  const end = floorsEnd + d.summary;
  const finale = { start: finaleStart, solidEnd, floorsEnd, summary: floorsEnd, end, floorCount };

  return {
    mode,
    durations: d,
    arrival,
    rise,
    rules,
    finale,
    labels: [rise.end, ...rules.map((r) => r.label), end],
    starts: [0, ...rules.map((r) => r.start), finaleStart],
    duration: end,
  };
}

const EPS = 1e-6;

/** The step position showing at time t: the last position whose segment has begun. */
export function positionAt(schedule: Schedule, time: number): number {
  let position = 0;
  schedule.starts.forEach((start, p) => {
    if (start <= time + EPS) position = p;
  });
  return position;
}

/** Where Next goes: finish the current step if it hasn't come to rest, else the next one. */
export function nextPosition(schedule: Schedule, time: number): number {
  const p = positionAt(schedule, time);
  const last = schedule.labels.length - 1;
  return time < schedule.labels[p]! - EPS ? p : Math.min(p + 1, last);
}

/** Where Back goes: the current step's resting point if we're past it, else the previous step. */
export function previousPosition(schedule: Schedule, time: number): number {
  const p = positionAt(schedule, time);
  return time > schedule.labels[p]! + EPS ? p : Math.max(p - 1, 0);
}
