import type { Step } from "@zoningviz/engine";
import { useEffect, useRef } from "react";
import { num } from "./format";

/** Matches the phone breakpoint in styles.css. */
const STACKED_LAYOUT_MAX_PX = 860;

const STATUS_LABEL: Record<Step["status"], string> = {
  cut: "Cuts",
  already_satisfied: "Already satisfied",
  info: "Info",
  not_applicable: "Doesn't apply",
  not_modeled: "Not modeled",
  disabled: "Off",
};

/** Rules that cut the volume; only these can be switched off to see what they cost. */
const TOGGLEABLE: ReadonlySet<Step["rule"]["kind"]> = new Set([
  "height_cap",
  "height_by_slope",
  "rear_yard",
  "front_setback",
  "side_yard",
  "sky_plane",
  "bulk",
  "lot_coverage",
]);

export interface RuleCardsProps {
  steps: Step[];
  /** The final envelope's floor area, for the floor-area-ratio gauge. */
  floorAreaSqFt: number;
  /** Index of the current step's card, or null at the start and the finale. */
  current: number | null;
  onSetback: (feet: number) => void;
  /** Rule ids switched off. */
  off: string[];
  onToggle: (ruleId: string) => void;
  /** Whether the district's local program is switched on. */
  program: boolean;
  onProgram: (on: boolean) => void;
  /** The timeline reveals each card as it plays; every card stays mounted. */
  registerCard: (index: number, element: HTMLElement | null) => void;
}

export function RuleCards({ steps, floorAreaSqFt, current, onSetback, off, onToggle, program, onProgram, registerCard }: RuleCardsProps) {
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
              {TOGGLEABLE.has(step.rule.kind) && step.status !== "not_applicable" && (
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
            {step.rule.kind === "local_program" && step.status !== "not_applicable" && step.status !== "disabled" && (
              <button type="button" role="switch" aria-checked={program} className="program-switch" onClick={() => onProgram(!program)}>
                <span className="switch-track" aria-hidden>
                  <span className="switch-knob" />
                </span>
                {step.rule.title}: {program ? "on" : "off"}
              </button>
            )}
            {step.rule.kind !== "info" && step.rule.kind !== "flag" && <p className="plain">{step.rule.plain}</p>}
            {step.measurements.removedVolume > 0 && (
              <p className="removed-line">
                <span className="removed-swatch" aria-hidden /> {num(step.measurements.removedVolume)} cu ft removed ·{" "}
                {num(step.measurements.percentOfStart)}% of the block left
              </p>
            )}
            {step.rule.kind === "far" && step.status !== "disabled" && (
              <FarGauge
                budgetSqFt={step.numbers.budgetSqFt ?? 0}
                floorAreaSqFt={floorAreaSqFt}
                homesCount={step.rule.params.appliesTo === "all_uses"}
              />
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
              {step.rule.effectiveDate === null ? (
                <span className="muted">effective date not checked</span>
              ) : (
                <span className="muted">in effect since {step.rule.effectiveDate}</span>
              )}
            </footer>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** The floor-area budget (non-residential, or all uses where homes count) against the envelope's whole floor area. */
function FarGauge({ budgetSqFt, floorAreaSqFt, homesCount }: { budgetSqFt: number; floorAreaSqFt: number; homesCount: boolean }) {
  const span = Math.max(budgetSqFt, floorAreaSqFt, 1);
  const usable = Math.min(budgetSqFt, floorAreaSqFt);
  const share = `${num((budgetSqFt / floorAreaSqFt) * 100)}%`;
  const text = homesCount
    ? budgetSqFt >= floorAreaSqFt
      ? `This envelope holds ${num(floorAreaSqFt)} sq ft of floor area, within the ${num(budgetSqFt)} sq ft limit.`
      : `This envelope holds ${num(floorAreaSqFt)} sq ft of floor area, more than the ${num(budgetSqFt)} sq ft limit: a building may fill only ${share} of it.`
    : budgetSqFt >= floorAreaSqFt
      ? `This envelope holds ${num(floorAreaSqFt)} sq ft of floor area, all within the ${num(budgetSqFt)} sq ft non-residential budget.`
      : `This envelope holds ${num(floorAreaSqFt)} sq ft of floor area; up to ${num(budgetSqFt)} sq ft (${share}) ` +
        "could be non-residential, and homes may use any of it.";
  return (
    <div className="far-gauge" data-testid="far-gauge">
      <div className="far-bar" aria-hidden>
        <span className="far-fill" style={{ width: `${(usable / span) * 100}%` }} />
        {floorAreaSqFt < span && <span className="far-room" style={{ left: `${(floorAreaSqFt / span) * 100}%` }} />}
      </div>
      <p className="far-text">{text}</p>
    </div>
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
