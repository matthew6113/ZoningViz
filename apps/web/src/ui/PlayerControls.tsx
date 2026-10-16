import type { Step } from "@zoningviz/engine";
import { useEffect } from "react";
import { isStop, type Schedule } from "../anim/schedule";
import type { Player } from "../anim/usePlayer";
import { num } from "./format";

/**
 * Step-by-step controls: nothing advances until the viewer presses Next, which
 * animates to the next rule that changes the shape and stops. Back and the step
 * dots jump without animating; rules that only show a card get small dots.
 */
export function PlayerControls({ player, label, steps }: { player: Player; label: string; steps: Step[] }) {
  const { schedule, animating, position } = player;
  const last = schedule ? schedule.labels.length - 1 : steps.length + 1;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      // Space and Enter on a focused button press that button.
      if (target?.tagName === "BUTTON" && (e.key === " " || e.key === "Enter")) return;
      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") {
        e.preventDefault();
        player.next();
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        player.back();
      } else if (e.key === "Home") {
        e.preventDefault();
        player.goTo(0);
      } else if (e.key === "End") {
        e.preventDefault();
        player.goTo(last);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [player, last]);

  const dots: { label: string; title: string; minor: boolean }[] = [
    { label: "Go to the start", title: "Start", minor: false },
    ...steps.map((s, i) => {
      const minor = schedule ? !isStop(schedule, i + 1) : false;
      return {
        label: `Go to rule ${i + 1}: ${s.rule.title}`,
        title: `${i + 1}. ${s.rule.title}${minor ? " (no change to the shape)" : ""}`,
        minor,
      };
    }),
    { label: "Go to the result", title: "Result", minor: false },
  ];

  return (
    <div className="player">
      <nav className="step-controls" aria-label="Steps">
        <button type="button" onClick={player.back} disabled={position <= 0 && !animating}>
          ← Back
        </button>
        <span className="step-label" aria-live="polite" data-testid="step-label">
          {label}
        </span>
        <button type="button" className="primary next" onClick={player.next} disabled={position >= last && !animating}>
          Next →
        </button>
      </nav>
      <ol className="step-dots" aria-label="Jump to a step">
        {dots.map((d, p) => (
          <li key={p}>
            <button
              type="button"
              className={["dot", d.minor ? "minor" : "", p < position ? "done" : ""].filter(Boolean).join(" ")}
              aria-label={d.label}
              aria-current={p === position ? "true" : undefined}
              title={d.title}
              onClick={() => player.goTo(p)}
            />
          </li>
        ))}
      </ol>
      <StepDetail steps={steps} position={position} schedule={schedule} />
    </div>
  );
}

/**
 * Phones only (styles.css): the cards sit below the canvas there, so the current
 * rule's sentence, what it removed and the rules passed over on the way are
 * repeated under the controls.
 */
function StepDetail({ steps, position, schedule }: { steps: Step[]; position: number; schedule: Schedule | null }) {
  const step = position >= 1 && position <= steps.length ? steps[position - 1]! : null;
  const passed: string[] = [];
  for (let p = position - 1; schedule && p >= 1 && !isStop(schedule, p); p--) passed.unshift(steps[p - 1]!.rule.title);
  return (
    <div className="step-detail" data-testid="step-detail">
      {step ? (
        <>
          <p className="sentence">{step.sentence}</p>
          {step.measurements.removedVolume > 0 && (
            <p className="removed-line">
              <span className="removed-swatch" aria-hidden /> {num(step.measurements.removedVolume)} cu ft removed
            </p>
          )}
        </>
      ) : (
        <p>{position <= 0 ? "Press Next to apply the rules one at a time." : "The result: the totals are below."}</p>
      )}
      {passed.length > 0 && <p className="muted passed">No change to the shape: {passed.join(", ")}.</p>}
    </div>
  );
}
