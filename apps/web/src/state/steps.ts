import type { EnvelopeResult, EnvelopeTotals, Step } from "@zoningviz/engine";

// Step positions: 0 is the starting block, 1…N show rule N applied, and N + 1
// is the result (the final envelope with its floors). The animation timeline
// (anim/) decides which position is on screen.

export type OkResult = Extract<EnvelopeResult, { status: "ok" }>;

export function lastPosition(result: OkResult): number {
  return result.steps.length + 1;
}

/** What the player shows for a position: "Start: …", "Rule 6 of 11: Rear yard" or "Result". */
export function positionLabel(result: OkResult, position: number): string {
  if (position <= 0) return `Start: everything up to ${result.start.heightFt} ft`;
  if (position >= lastPosition(result)) return "Result";
  return `Rule ${position} of ${result.steps.length}: ${result.steps[position - 1]!.rule.title}`;
}

/** The envelope without a local program, shown while the program is switched on. */
export interface ProgramComparison {
  /** The local program's name, e.g. "Housing Choice-SF". */
  title: string;
  /** The same lot without it. */
  without: EnvelopeTotals;
}

export interface FarBudget {
  ratio: number;
  budgetSqFt: number;
}

/** The floor-area-ratio rule's budget, unless it's switched off or the district has none. */
export function farBudget(steps: Step[]): FarBudget | null {
  const far = steps.find((s) => s.rule.kind === "far" && s.status !== "disabled");
  return far ? { ratio: far.numbers.ratio!, budgetSqFt: far.numbers.budgetSqFt! } : null;
}
