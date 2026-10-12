import type { EnvelopeTotals } from "@zoningviz/engine";
import { num } from "./format";

export interface FarBudget {
  ratio: number;
  budgetSqFt: number;
}

export interface SummaryProps {
  totals: EnvelopeTotals;
  floorToFloorFt: number;
  /** A taller first story set by the district (a commercial ground floor), or null. */
  firstStoryFt: number | null;
  far: FarBudget | null;
}

export function Summary({ totals, floorToFloorFt, firstStoryFt, far }: SummaryProps) {
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
      </dl>
      <p className="survived">{num(totals.percentSurvived, 1)}% of the block survived.</p>
    </section>
  );
}
