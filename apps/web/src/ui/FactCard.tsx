import type { LotInfo } from "@zoningviz/engine";
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
