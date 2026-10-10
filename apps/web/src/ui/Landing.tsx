import { useState, type FormEvent } from "react";

const EXAMPLES: { id: string; label: string; note: string }[] = [
  { id: "fixture-a", label: "Fixture A", note: "synthetic 25 × 100 ft RH-2 lot (SPEC.md)" },
  { id: "4025007", label: "667 Hampshire St", note: "RH-2, 40-X, mid-block" },
  { id: "4025006", label: "2550 19th St", note: "RH-2 corner lot: you pick the front" },
  { id: "4276045", label: "1391 Hampshire St", note: "RH-2 lot split between two height districts" },
  { id: "0044030", label: "766–772 Francisco St", note: "RH-2 condo lot in a Family Zoning Plan R-4 district" },
];

export function Landing({ onOpen }: { onOpen: (id: string) => void }) {
  const [value, setValue] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const id = value.trim().toUpperCase();
    if (id) onOpen(id);
  };
  return (
    <main className="landing">
      <h1>Zoning Envelope Visualizer</h1>
      <p className="lede">
        Pick a San Francisco lot and watch each zoning rule carve a block of space down to what the code allows.
      </p>
      <form onSubmit={submit} className="lookup">
        <label htmlFor="blklot">Block/lot number</label>
        <input
          id="blklot"
          value={value}
          onChange={(e) => setValue(e.currentTarget.value)}
          placeholder="e.g. 4025007"
          autoComplete="off"
        />
        <button type="submit" className="primary">
          Show the envelope
        </button>
      </form>
      <h2>Try one</h2>
      <ul className="examples">
        {EXAMPLES.map((ex) => (
          <li key={ex.id}>
            <a href={`?parcel=${ex.id}`} onClick={(e) => (e.preventDefault(), onOpen(ex.id))}>
              {ex.label}
            </a>{" "}
            <span className="muted">{ex.note}</span>
          </li>
        ))}
      </ul>
      <p className="muted">Rules are written for RH-2 so far; RH-1(D), RH-1 and RH-3 come next. A map arrives later.</p>
    </main>
  );
}
