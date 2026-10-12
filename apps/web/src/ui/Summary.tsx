import type { EnvelopeTotals } from "@zoningviz/engine";
import { num } from "./format";

export interface FarBudget {
  ratio: number;
  budgetSqFt: number;
}

export interface ProgramComparison {
  /** The local program's name, e.g. "Housing Choice-SF". */
  title: string;
  /** The same lot without it. */
  without: EnvelopeTotals;
}

export interface SummaryProps {
  totals: EnvelopeTotals;
  floorToFloorFt: number;
  /** A taller first story set by the district (a commercial ground floor), or null. */
  firstStoryFt: number | null;
  far: FarBudget | null;
  /** Shown while a local program is switched on. */
  program?: ProgramComparison | null;
}

export function Summary({ totals, floorToFloorFt, firstStoryFt, far, program = null }: SummaryProps) {
  return (
    <section className="card summary" aria-label="Result" data-testid="summary">
      <h3>What the rules leave</h3>
      <dl>
        <dt>Envelope</dt>
        <dd>{num(totals.volume)} cu ft</dd>
        <dt>Footprint</dt>
        <dd>{num(totals.footprintSqFt)} sq ft</dd>
        <dt>Stories</dt>
        <dd>
          {totals.stories} stories{" "}
          <span className="muted">
            at {floorToFloorFt} ft floor-to-floor
            {firstStoryFt !== null && firstStoryFt !== floorToFloorFt && `, ${firstStoryFt} ft ground floor`}
          </span>
        </dd>
        <dt>Floor area</dt>
        <dd>{num(totals.grossFloorAreaSqFt)} sq ft</dd>
        {far && (
          <>
            <dt>Non-residential cap</dt>
            <dd data-testid="far-cap">
              {num(far.budgetSqFt)} sq ft <span className="muted">(FAR {far.ratio}; homes aren't limited)</span>
            </dd>
          </>
        )}
        {program && (
          <>
            <dt>Without {program.title}</dt>
            <dd data-testid="program-compare">
              {num(program.without.grossFloorAreaSqFt)} sq ft in {program.without.stories} stories{" "}
              <span className="muted">({gain(totals, program.without)})</span>
            </dd>
          </>
        )}
      </dl>
      <p className="survived">{num(totals.percentSurvived, 1)}% of the block survived.</p>
    </section>
  );
}

/** What the program adds over the envelope without it, in floor area and stories. */
function gain(withProgram: EnvelopeTotals, without: EnvelopeTotals): string {
  const area = withProgram.grossFloorAreaSqFt - without.grossFloorAreaSqFt;
  const stories = withProgram.stories - without.stories;
  if (Math.abs(area) < 0.5 && stories === 0) return "the program adds nothing here";
  const signed = (n: number, text: string) => `${n >= 0 ? "+" : "−"}${text}`;
  const parts = [signed(area, `${num(Math.abs(area))} sq ft`)];
  if (stories !== 0) parts.push(signed(stories, `${Math.abs(stories)} ${Math.abs(stories) === 1 ? "story" : "stories"}`));
  return `${parts.join(", ")} with the program`;
}
