import { useEffect } from "react";

export function StepControls({
  position,
  last,
  label,
  onChange,
}: {
  position: number;
  last: number;
  label: string;
  onChange: (position: number) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (e.key === "ArrowRight" && position < last) onChange(position + 1);
      if (e.key === "ArrowLeft" && position > 0) onChange(position - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [position, last, onChange]);

  return (
    <nav className="step-controls" aria-label="Steps">
      <button type="button" onClick={() => onChange(position - 1)} disabled={position <= 0}>
        ← Back
      </button>
      <span className="step-label" aria-live="polite" data-testid="step-label">
        {label}
      </span>
      <button type="button" className="primary" onClick={() => onChange(position + 1)} disabled={position >= last}>
        Next →
      </button>
    </nav>
  );
}
