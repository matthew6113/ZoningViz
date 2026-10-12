import { useCallback, useEffect, useState } from "react";
import { parseUrlState, toSearch, type UrlState } from "./url";

/** URL-backed state. Updates replace the history entry; back/forward still work across lots. */
export function useUrlState(): [UrlState, (patch: Partial<UrlState>, mode?: "replace" | "push") => void] {
  const [state, setState] = useState(() => parseUrlState(window.location.search));

  useEffect(() => {
    const onPop = () => setState(parseUrlState(window.location.search));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const update = useCallback((patch: Partial<UrlState>, mode: "replace" | "push" = "replace") => {
    setState((current) => {
      const next = { ...current, ...patch };
      const url = `${window.location.pathname}${toSearch(next)}`;
      try {
        if (mode === "push") window.history.pushState(null, "", url);
        else window.history.replaceState(null, "", url);
      } catch {
        // Some embedding frames refuse history changes; the view still updates, without a link.
      }
      return next;
    });
  }, []);

  return [state, update];
}
