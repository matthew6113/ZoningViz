import type { EnvelopeTotals } from "@zoningviz/engine";
import { num } from "./format";

export function Summary({ totals, floorToFloorFt }: { totals: EnvelopeTotals; floorToFloorFt: number }) {
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
          {totals.stories} stories <span className="muted">at {floorToFloorFt} ft floor-to-floor</span>
        </dd>
        <dt>Floor area</dt>
        <dd>{num(totals.grossFloorAreaSqFt)} sq ft</dd>
      </dl>
      <p className="survived">{num(totals.percentSurvived, 1)}% of the block survived.</p>
    </section>
  );
}
