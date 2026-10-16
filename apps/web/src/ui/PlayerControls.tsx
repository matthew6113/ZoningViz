import type { Step } from "@zoningviz/engine";
import { useEffect } from "react";
import type { Player } from "../anim/usePlayer";

/**
 * Step-by-step controls: nothing advances until the viewer presses Next, which
 * animates one rule and stops. Back and the step dots jump without animating.
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

  const dots: { label: string; title: string }[] = [
    { label: "Go to the start", title: "Start" },
    ...steps.map((s, i) => ({ label: `Go to rule ${i + 1}: ${s.rule.title}`, title: `${i + 1}. ${s.rule.title}` })),
    { label: "Go to the result", title: "Result" },
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
              className={p < position ? "dot done" : "dot"}
              aria-label={d.label}
              aria-current={p === position ? "true" : undefined}
              title={d.title}
              onClick={() => player.goTo(p)}
            />
          </li>
        ))}
      </ol>
    </div>
  );
}
