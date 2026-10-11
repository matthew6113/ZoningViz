import type { Step } from "@zoningviz/engine";
import { useEffect, useRef } from "react";
import { num } from "./format";

/** Matches the phone breakpoint in styles.css. */
const STACKED_LAYOUT_MAX_PX = 860;

const STATUS_LABEL: Record<Step["status"], string> = {
  cut: "Cuts",
  already_satisfied: "Already satisfied",
  info: "Info",
  not_modeled: "Not modeled",
  disabled: "Off",
};

export interface RuleCardsProps {
  steps: Step[];
  /** Index of the current step's card, or null at the start and the finale. */
  current: number | null;
  onSetback: (feet: number) => void;
  /** Rule ids switched off. */
  off: string[];
  onToggle: (ruleId: string) => void;
  /** The timeline reveals each card as it plays; every card stays mounted. */
  registerCard: (index: number, element: HTMLElement | null) => void;
}

export function RuleCards({ steps, current, onSetback, off, onToggle, registerCard }: RuleCardsProps) {
  const currentRef = useRef<HTMLLIElement>(null);
  useEffect(() => {
    // Only where the card column scrolls on its own (desktop). On phones it
    // would scroll the whole page away from the canvas and the controls.
    if (window.matchMedia(`(min-width: ${STACKED_LAYOUT_MAX_PX + 1}px)`).matches) {
      currentRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [current]);

  return (
    <section aria-label="Rules" className="rules">
      <ol className="rule-list">
        {steps.map((step, i) => (
          <li
            key={step.rule.id}
            ref={(element) => {
              registerCard(i, element);
              if (i === current) currentRef.current = element;
            }}
            className={`card rule-card status-${step.status}${i === current ? " current" : ""}`}
            aria-current={i === current ? "step" : undefined}
            data-rule={step.rule.id}
          >
            <header>
              <span className="rule-number">{i + 1}</span>
              <h3>{step.rule.title}</h3>
              <span className="chip">{STATUS_LABEL[step.status]}</span>
              {step.rule.kind !== "info" && step.rule.kind !== "flag" && (
                <button
                  type="button"
                  className="eye"
                  aria-pressed={!off.includes(step.rule.id)}
                  aria-label={`${off.includes(step.rule.id) ? "Turn on" : "Turn off"} ${step.rule.title}`}
                  title={off.includes(step.rule.id) ? "Turn this rule back on" : "Turn this rule off to see what it costs"}
                  onClick={() => onToggle(step.rule.id)}
                >
                  <EyeIcon open={!off.includes(step.rule.id)} />
                </button>
              )}
            </header>
            <p className="sentence">{step.sentence}</p>
            {step.rule.kind !== "info" && step.rule.kind !== "flag" && <p className="plain">{step.rule.plain}</p>}
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
    </section>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
      <circle cx="12" cy="12" r="3" />
      {!open && <line x1="3" y1="3" x2="21" y2="21" />}
    </svg>
  );
}
