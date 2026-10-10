import type { Step } from "@zoningviz/engine";
import { useEffect } from "react";
import { SCRUBBER_STEPS, type Player } from "../anim/usePlayer";

export function PlayerControls({ player, label, steps }: { player: Player; label: string; steps: Step[] }) {
  const { schedule, playing, speed } = player;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "BUTTON"].includes(target.tagName) && e.key === " ") return;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (e.key === "ArrowRight") player.next();
      else if (e.key === "ArrowLeft") player.back();
      else if (e.key === " ") {
        e.preventDefault();
        if (playing) player.pause();
        else player.play();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [player, playing]);

  const last = schedule ? schedule.labels.length - 1 : 0;
  return (
    <div className="player">
      <nav className="step-controls" aria-label="Steps">
        <button type="button" onClick={player.back} disabled={player.position <= 0 && !playing}>
          ← Back
        </button>
        <button type="button" className="primary play" onClick={playing ? player.pause : player.play} aria-pressed={playing}>
          {playing ? "Pause" : "Play"}
        </button>
        <button type="button" onClick={player.next} disabled={player.position >= last}>
          Next →
        </button>
        <span className="step-label" aria-live="polite" data-testid="step-label">
          {label}
        </span>
        <div className="speed" role="group" aria-label="Speed">
          {([1, 2] as const).map((s) => (
            <button key={s} type="button" aria-pressed={speed === s} onClick={() => player.setSpeed(s)}>
              {s}×
            </button>
          ))}
        </div>
      </nav>
      {schedule && (
        <div className="scrubber">
          <input
            ref={player.scrubberRef}
            type="range"
            min={0}
            max={SCRUBBER_STEPS}
            defaultValue={0}
            aria-label="Timeline"
            onPointerDown={() => player.setScrubbing(true)}
            onPointerUp={() => player.setScrubbing(false)}
            onInput={(e) => player.seekProgress(Number(e.currentTarget.value) / SCRUBBER_STEPS)}
          />
          <div className="ticks">
            {schedule.labels.slice(1, -1).map((time, i) => (
              <button
                key={i}
                type="button"
                className="tick"
                style={{ left: `${(time / schedule.duration) * 100}%` }}
                title={`${i + 1}. ${steps[i]?.rule.title ?? ""}`}
                aria-label={`Go to rule ${i + 1}: ${steps[i]?.rule.title ?? ""}`}
                onClick={() => player.goTo(i + 1)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
