import type { SfAddressMatch } from "@zoningviz/jurisdictions/sf";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { sfAdapter } from "../data/loadLot";
import { parseBlockLot } from "./geo";

export type SearchHit =
  | { kind: "blklot"; blklot: string; label: string }
  | { kind: "address"; match: SfAddressMatch; label: string };

const DEBOUNCE_MS = 250;
const MIN_CHARS = 3;

/** One box for addresses and block/lot numbers, with a list of matches under it. */
export function SearchBox({ onPick }: { onPick: (hit: SearchHit) => void }) {
  const [text, setText] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [active, setActive] = useState(0);
  const [status, setStatus] = useState<"idle" | "searching" | "none" | "error" | "need-number">("idle");
  const [open, setOpen] = useState(false);
  const request = useRef(0);
  const listId = useId();

  useEffect(() => {
    const query = text.trim();
    const id = ++request.current;
    const blklot = parseBlockLot(query);
    if (blklot) {
      setHits([{ kind: "blklot", blklot, label: `Block/lot ${blklot}` }]);
      setStatus("idle");
      return;
    }
    if (query.length < MIN_CHARS) {
      setHits([]);
      setStatus("idle");
      return;
    }
    if (!/^\d/.test(query)) {
      setHits([]);
      setStatus("need-number");
      return;
    }
    setStatus("searching");
    const timer = setTimeout(() => {
      sfAdapter()
        .searchAddresses(query)
        .then(
          (matches) => {
            if (id !== request.current) return;
            setHits(matches.map((match) => ({ kind: "address", match, label: match.label })));
            setActive(0);
            setStatus(matches.length ? "idle" : "none");
          },
          () => id === request.current && setStatus("error"),
        );
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text]);

  const pick = (hit: SearchHit | undefined) => {
    if (!hit) return;
    setOpen(false);
    setText(hit.label);
    onPick(hit);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, hits.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      pick(hits[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const showList = open && (hits.length > 0 || status !== "idle");
  return (
    <div className="search">
      <label htmlFor={`${listId}-input`} className="visually-hidden">
        Address or block/lot
      </label>
      <input
        id={`${listId}-input`}
        type="search"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && hits[active] ? `${listId}-${active}` : undefined}
        placeholder="Address or block/lot, e.g. 667 Hampshire St"
        autoComplete="off"
        value={text}
        onChange={(e) => {
          setText(e.currentTarget.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKeyDown}
      />
      {showList && (
        <ul className="search-results" id={listId} role="listbox">
          {hits.map((hit, i) => (
            <li
              key={hit.kind === "blklot" ? hit.blklot : `${hit.match.label}|${hit.match.blklot}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(hit)}
            >
              {hit.label}
              {hit.kind === "address" && hit.match.blklot && <span className="muted"> · {hit.match.blklot}</span>}
            </li>
          ))}
          {status === "searching" && hits.length === 0 && <li className="muted">Searching…</li>}
          {status === "none" && <li className="muted">No San Francisco address starts with that.</li>}
          {status === "need-number" && <li className="muted">Start with the house number, e.g. 667 Hampshire.</li>}
          {status === "error" && <li className="muted">Address search isn't reachable right now.</li>}
        </ul>
      )}
    </div>
  );
}
