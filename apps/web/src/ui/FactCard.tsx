import type { LotInfo, LotTerrain } from "@zoningviz/engine";
import type { SpecialUseFact } from "@zoningviz/jurisdictions/sf";
import type { LotFacts } from "../data/loadLot";
import { num } from "./format";

export function FactCard({ facts, lot, notes }: { facts: LotFacts; lot: LotInfo | null; notes: string[] }) {
  const allNotes = [...facts.warnings, ...notes];
  return (
    <section className="card fact-card" aria-label="Lot facts">
      <h2>{facts.title}</h2>
      <dl>
        <dt>Block/lot</dt>
        <dd>{facts.blklot ?? "synthetic test lot"}</dd>
        <dt>Zoning</dt>
        <dd>
          <strong>{facts.zoningCode ?? "unknown"}</strong>
          {facts.zoningName && <span className="muted"> · {facts.zoningName.toLowerCase()}</span>}
        </dd>
        <dt>Height and bulk</dt>
        <dd>
          {facts.heightDistricts.length === 0 && "none found"}
          {facts.heightDistricts.map((d) => (
            <div key={d.label}>
              <strong>{d.label}</strong> <span className="muted">{d.detail}</span>
              {facts.heightDistricts.length > 1 && d.share !== null && (
                <span className="muted"> · {num(d.share * 100, 1)}% of lot</span>
              )}
            </div>
          ))}
        </dd>
        <dt>Lot</dt>
        <dd>
          {num(facts.lotAreaSqFt)} sq ft
          {lot && (
            <span className="muted">
              {" "}
              · {num(lot.widthFt, 1)} ft wide × {num(lot.depthFt, 1)} ft deep
            </span>
          )}
          {lot?.approximate && <span className="badge">approximate geometry</span>}
        </dd>
        {lot?.terrain && (
          <>
            <dt>Ground</dt>
            <dd data-testid="ground">
              {groundSummary(lot.terrain)}
              <span className="muted">
                {" "}
                · curb est. {num(lot.terrain.curbElevationFt, 1)} ft · cross-slope {num(lot.terrain.crossSlopePct, 1)}%
              </span>
            </dd>
          </>
        )}
        {!facts.synthetic && (
          <>
            <dt>Special use</dt>
            <dd data-testid="special-use">
              {facts.specialUse === null && "couldn't be checked"}
              {facts.specialUse?.length === 0 && "none"}
              {facts.specialUse?.map((f) => <SpecialUse key={f.name} fact={f} />)}
            </dd>
          </>
        )}
        {facts.unitCount > 0 && (
          <>
            <dt>Condo units</dt>
            <dd>{facts.unitCount} unit records share this lot</dd>
          </>
        )}
        {facts.asOf.length > 0 && (
          <>
            <dt>Data as of</dt>
            <dd className="muted">
              {facts.asOf.map((a) => (
                <div key={a.label}>
                  {a.label}: {a.date ?? "unknown"}
                </div>
              ))}
            </dd>
          </>
        )}
      </dl>
      {allNotes.length > 0 && (
        <details className="notes">
          <summary>Notes ({allNotes.length})</summary>
          <ul>
            {allNotes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

/**
 * A special use district the lot lies in. None is modeled; a district with a note
 * (specialUse.json) says what it allows and whether this lot's zoning can use it.
 */
function SpecialUse({ fact }: { fact: SpecialUseFact }) {
  const { note, applies } = fact;
  return (
    <div className="special-use">
      {fact.url ? (
        <a href={fact.url} target="_blank" rel="noreferrer">
          {fact.title}
        </a>
      ) : (
        fact.title
      )}{" "}
      <span className="chip">not modeled</span>
      {note && !note.verified && <span className="tag-unverified">unverified</span>}
      {applies && <p className={`applies applies-${applies.status}`}>{applies.sentence}</p>}
      {note && (
        <details>
          <summary>What it allows</summary>
          <p>{note.plain}</p>
          <p className="muted">
            {note.citation} · {note.effectiveDate === null ? "effective date not checked" : `in effect since ${note.effectiveDate}`}
          </p>
        </details>
      )}
    </div>
  );
}

/** "Rear 35.5 ft lower than front · slopes down from the street" */
function groundSummary(t: LotTerrain): string {
  const rise = t.rearMinusFrontFt;
  const amount = Math.abs(rise) < 0.05 ? "Rear level with front" : `Rear ${num(Math.abs(rise), 1)} ft ${rise > 0 ? "higher" : "lower"} than front`;
  return `${amount} · ${t.upslope ? "slopes up from the street" : "level with or below the street"}`;
}
