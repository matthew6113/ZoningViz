import type { Dimension, EnvelopeResult, Solid, Step } from "@zoningviz/engine";

// Step positions: 0 is the starting block, 1…N show rule N applied, and N + 1
// is the finale (the final envelope with its floors).

export type OkResult = Extract<EnvelopeResult, { status: "ok" }>;

export type StepView =
  | { kind: "start"; position: 0; envelope: Solid }
  | { kind: "rule"; position: number; step: Step; envelope: Solid; removed: Solid | null; dimensions: Dimension[] }
  | { kind: "finale"; position: number; envelope: Solid };

export function lastPosition(result: OkResult): number {
  return result.steps.length + 1;
}

export function clampPosition(position: number | null, result: OkResult): number {
  if (position === null || !Number.isFinite(position)) return 0;
  return Math.min(Math.max(Math.trunc(position), 0), lastPosition(result));
}

export function viewAt(position: number, result: OkResult): StepView {
  const p = clampPosition(position, result);
  if (p === 0) return { kind: "start", position: 0, envelope: result.start };
  if (p === lastPosition(result)) return { kind: "finale", position: p, envelope: result.final };
  const step = result.steps[p - 1]!;
  return { kind: "rule", position: p, step, envelope: step.after, removed: step.removed, dimensions: step.dimensions };
}

/** How many rule cards are filled in at this position (all of them at the finale). */
export function revealedCount(position: number, result: OkResult): number {
  return Math.min(clampPosition(position, result), result.steps.length);
}
