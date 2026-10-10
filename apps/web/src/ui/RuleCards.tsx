import type { Step } from "@zoningviz/engine";
import { useEffect, useRef } from "react";
import { num } from "./format";

const STATUS_LABEL: Record<Step["status"], string> = {
  cut: "Cuts",
  already_satisfied: "Already satisfied",
  info: "Info",
  not_modeled: "Not modeled",
  disabled: "Off",
};

export interface RuleCardsProps {
  steps: Step[];
  revealed: number;
  /** Index of the current step's card, or null at the start and the finale. */
  current: number | null;
  onSetback: (feet: number) => void;
}

export function RuleCards({ steps, revealed, current, onSetback }: RuleCardsProps) {
  const currentRef = useRef<HTMLLIElement>(null);
  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [current]);

  return (
    <section aria-label="Rules" className="rules">
      <ol className="rule-list">
        {steps.slice(0, revealed).map((step, i) => (
          <li
            key={step.rule.id}
            ref={i === current ? currentRef : undefined}
            className={`card rule-card status-${step.status}${i === current ? " current" : ""}`}
            aria-current={i === current ? "step" : undefined}
            data-rule={step.rule.id}
          >
            <header>
              <span className="rule-number">{i + 1}</span>
              <h3>{step.rule.title}</h3>
              <span className="chip">{STATUS_LABEL[step.status]}</span>
            </header>
            <p className="sentence">{step.sentence}</p>
            {step.measurements.removedVolume > 0 && (
              <p className="removed-line">
                <span className="removed-swatch" aria-hidden /> {num(step.measurements.removedVolume)} cu ft removed ·{" "}
                {num(step.measurements.percentOfStart)}% of the block left
              </p>
            )}
            {step.rule.kind === "front_setback" && step.rule.params.userOverride && step.status !== "disabled" && (
              <label className="setback-slider">
                Setback for this lot: <strong>{num(step.numbers.setbackFt ?? 0, 1)} ft</strong>
                <input
                  type="range"
                  min={0}
                  max={step.rule.params.maxFeet}
                  step={0.5}
                  value={step.numbers.setbackFt ?? step.rule.params.maxFeet}
                  onChange={(e) => onSetback(Number(e.currentTarget.value))}
                />
              </label>
            )}
            <footer>
              <a href={step.rule.url} target="_blank" rel="noreferrer">
                {step.rule.citation}
              </a>
              {!step.rule.verified && <span className="tag-unverified">unverified</span>}
              {step.rule.effectiveDate === null && <span className="muted">effective date not checked</span>}
            </footer>
          </li>
        ))}
      </ol>
      {revealed < steps.length && (
        <p className="muted upcoming">
          {steps.length - revealed} more rule{steps.length - revealed === 1 ? "" : "s"} to go
        </p>
      )}
    </section>
  );
}
