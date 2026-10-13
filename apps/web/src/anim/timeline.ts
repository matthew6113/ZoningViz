import gsap from "gsap";
import type { OkResult } from "../state/steps";
import type { Schedule } from "./schedule";

// One GSAP timeline drives a plain state object. The 3D scene reads it every
// frame and the counters read it on update, so nothing in React re-renders
// while it plays. Seeking anywhere, forward or back, restores every value.

export interface AnimState {
  /** 0 = straight overhead, 1 = the three-quarter street view. */
  camera: number;
  /** Starting block height as a fraction of its full height. */
  rise: number;
  startOpacity: number;
  /** Index of the rule on stage (into result.steps); −1 = the starting block. */
  rule: number;
  /** The removed piece's colour: 0 = envelope colour, 1 = red. */
  tint: number;
  /** How far the cutting plane has swept along the boundary, 0–1. */
  sweep: number;
  planeOpacity: number;
  /** How much of the dimension line is drawn, 0–1. */
  measure: number;
  labelOpacity: number;
  /** The removed piece's lift, in feet. */
  lift: number;
  removedOpacity: number;
  /** Running totals shown by the counters. */
  volume: number;
  footprint: number;
  percentLeft: number;
  /** 0 → 1 as the final envelope turns solid. */
  finale: number;
  /** Floor slices shown, counting up from the ground (fractional while one fades in). */
  floors: number;
}

export const ENVELOPE_OPACITY = 0.6;
export const START_OPACITY = 0.35;
/** How far the removed piece rises before it fades: "lifts a few feet". */
export const LIFT_FT = 6;
/** Seconds after a step begins that the scene switches to its rule (see buildTimeline). */
const SWITCH_AFTER_REST = 1e-3;

/** The state before anything plays. Reduced motion starts with the camera and block already in place. */
export function initialState(result: OkResult, mode: Schedule["mode"] = "full"): AnimState {
  const settled = mode === "reduced" ? 1 : 0;
  return {
    camera: settled,
    rise: settled,
    startOpacity: START_OPACITY,
    rule: -1,
    tint: 0,
    sweep: 0,
    planeOpacity: 0,
    measure: 0,
    labelOpacity: 0,
    lift: 0,
    removedOpacity: ENVELOPE_OPACITY,
    volume: result.start.volume,
    footprint: result.lot.areaSqFt,
    percentLeft: 100,
    finale: 0,
    floors: 0,
  };
}

export interface TimelineTargets {
  /** One element per rule card, by step index. */
  cards: (HTMLElement | null)[];
  summary: HTMLElement | null;
}

export function stepLabel(position: number): string {
  return `step-${position}`;
}

export function buildTimeline(
  result: OkResult,
  schedule: Schedule,
  state: AnimState,
  targets: TimelineTargets | null = null,
): gsap.core.Timeline {
  const tl = gsap.timeline({ paused: true });
  const d = schedule.durations;
  const full = schedule.mode === "full";

  // Opening: arrival, then the starting block.
  if (full) {
    tl.fromTo(state, { camera: 0 }, { camera: 1, duration: d.arrival, ease: "power2.inOut" }, schedule.arrival.start);
    tl.fromTo(state, { rise: 0 }, { rise: 1, duration: d.rise, ease: "power2.out" }, schedule.rise.start);
  } else {
    tl.fromTo(state, { startOpacity: 0 }, { startOpacity: START_OPACITY, duration: d.rise }, schedule.rise.start);
  }

  for (const seg of schedule.rules) {
    const step = result.steps[seg.index]!;
    // A step can begin exactly where the one before rests (the opening, card-only rules); switching
    // just after that instant keeps the resting step on screen when the playhead is parked there.
    tl.set(
      state,
      { rule: seg.index, tint: 0, sweep: 0, planeOpacity: 0, measure: 0, labelOpacity: 0, lift: 0, removedOpacity: ENVELOPE_OPACITY },
      seg.start + SWITCH_AFTER_REST,
    );

    const card = targets?.cards[seg.index];
    if (card) {
      tl.fromTo(
        card,
        { autoAlpha: 0, x: full ? 24 : 0 },
        { autoAlpha: 1, x: 0, duration: d.announce, ease: "power2.out" },
        seg.start,
      );
    }
    if (seg.kind === "card") continue;

    // Measure: the dimension line draws itself, then its label appears.
    tl.to(state, { measure: 1, duration: d.measure * 0.75, ease: "power1.inOut" }, seg.measure);
    tl.to(state, { labelOpacity: 1, duration: d.measure * 0.25 }, seg.measure + d.measure * 0.75);
    if (seg.kind === "satisfied") continue;

    // Cut: the plane sweeps along the boundary while the volume beyond it turns red.
    if (full) {
      tl.to(state, { planeOpacity: 1, duration: 0.15 }, seg.cut);
      tl.to(state, { sweep: 1, duration: d.cut * 0.7, ease: "power1.inOut" }, seg.cut);
      tl.to(state, { tint: 1, duration: d.cut * 0.6 }, seg.cut + d.cut * 0.4);
      tl.to(state, { planeOpacity: 0, duration: 0.2 }, seg.cut + d.cut - 0.2);
    } else {
      tl.to(state, { tint: 1, duration: d.cut }, seg.cut);
    }

    // Remove: the red piece lifts and fades; the counters tick down.
    tl.to(state, { ...(full ? { lift: LIFT_FT } : {}), removedOpacity: 0, duration: d.remove, ease: "power1.in" }, seg.remove);
    tl.to(
      state,
      {
        volume: step.measurements.volume,
        footprint: step.measurements.footprintSqFt,
        percentLeft: step.measurements.percentOfStart,
        duration: d.remove,
        ease: "power1.out",
      },
      seg.remove,
    );
  }

  // Finale: the envelope turns solid, floors appear from the ground up, then the summary.
  const f = schedule.finale;
  tl.to(state, { finale: 1, duration: d.finaleSolid, ease: "power1.inOut" }, f.start);
  if (f.floorCount > 0) {
    tl.to(state, { floors: f.floorCount, duration: f.floorsEnd - f.solidEnd, ease: "none" }, f.solidEnd);
  }
  if (targets?.summary) {
    tl.fromTo(targets.summary, { autoAlpha: 0, y: full ? 12 : 0 }, { autoAlpha: 1, y: 0, duration: d.summary }, f.summary);
  }

  schedule.labels.forEach((time, position) => tl.addLabel(stepLabel(position), time));
  tl.set({}, {}, schedule.duration); // pin the end, so the timeline lasts exactly as scheduled
  return tl;
}
