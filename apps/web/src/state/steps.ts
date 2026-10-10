import type { EnvelopeResult } from "@zoningviz/engine";

// Step positions: 0 is the starting block, 1…N show rule N applied, and N + 1
// is the result (the final envelope with its floors). The animation timeline
// (anim/) decides which position is on screen.

export type OkResult = Extract<EnvelopeResult, { status: "ok" }>;

export function lastPosition(result: OkResult): number {
  return result.steps.length + 1;
}
