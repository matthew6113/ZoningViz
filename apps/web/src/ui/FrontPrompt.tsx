import type { FrontCandidate } from "@zoningviz/engine";
import { sideName } from "../scene/Scene";
import { facing, num } from "./format";

export function FrontPrompt({ candidates, onChoose }: { candidates: FrontCandidate[]; onChoose: (index: number) => void }) {
  return (
    <section className="card front-prompt" aria-label="Choose the front">
      <h3>Which side is the front?</h3>
      <p>
        This lot borders the street on {candidates.length} sides. Yards and setbacks are measured from the front, so pick
        the side the building faces.
      </p>
      <div className="choices">
        {candidates.map((c) => (
          <button key={c.index} type="button" onClick={() => onChoose(c.index)}>
            <strong>{sideName(c.index)}</strong> · {num(c.lengthFt, 1)} ft, facing {facing(c)}
          </button>
        ))}
      </div>
    </section>
  );
}
