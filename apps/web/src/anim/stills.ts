import type { OkResult } from "../state/steps";
import { buildSchedule, type MotionMode } from "./schedule";
import { buildTimeline, initialState, stepLabel, type AnimState } from "./timeline";

/**
 * Puts the scene's state object at each step position's resting point in turn
 * (a cut step rests with its red piece showing) and calls `still` there, then
 * restores the state exactly. A separate timeline with no targets drives it,
 * so the rule cards, counters, scrubber and URL never move. Pause the player first.
 */
export function withStills<T>(
  result: OkResult,
  mode: MotionMode,
  anim: AnimState,
  positions: number[],
  still: (position: number) => T,
): T[] {
  const saved = { ...anim };
  const schedule = buildSchedule(result, mode);
  Object.assign(anim, initialState(result, mode));
  const timeline = buildTimeline(result, schedule, anim);
  try {
    timeline.seek(0);
    return positions.map((position) => {
      timeline.seek(stepLabel(position));
      return still(position);
    });
  } finally {
    timeline.kill();
    Object.assign(anim, saved);
  }
}
