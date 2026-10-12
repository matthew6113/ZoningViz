import { createEngine, type Engine, type EnvelopeOptions, type EnvelopeResult } from "@zoningviz/engine";
import { useEffect, useMemo, useState } from "react";
import { loadLot, type LoadedLot } from "./loadLot";

export type Loadable<T> = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; value: T };

export function useLot(id: string): Loadable<LoadedLot> {
  const [state, setState] = useState<Loadable<LoadedLot>>({ status: "loading" });
  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    loadLot(id).then(
      (value) => !cancelled && setState({ status: "ready", value }),
      (error: unknown) =>
        !cancelled && setState({ status: "error", message: error instanceof Error ? error.message : String(error) }),
    );
    return () => {
      cancelled = true;
    };
  }, [id]);
  return state;
}

let enginePromise: Promise<Engine> | null = null;

export function useEngine(): Loadable<Engine> {
  const [state, setState] = useState<Loadable<Engine>>({ status: "loading" });
  useEffect(() => {
    enginePromise ??= createEngine();
    enginePromise.then(
      (value) => setState({ status: "ready", value }),
      (error: unknown) => setState({ status: "error", message: `The geometry engine failed to load: ${String(error)}` }),
    );
  }, []);
  return state;
}

/** Runs the engine for a lot; recomputes only when the inputs or options change. Null options skip the run. */
export function useEnvelope(
  engine: Engine | null,
  lot: LoadedLot | null,
  options: EnvelopeOptions | null,
): Exclude<Loadable<EnvelopeResult>, { status: "loading" }> | null {
  const key = JSON.stringify(options);
  return useMemo(() => {
    if (!engine || !lot?.input || !lot.district || !options) return null;
    try {
      return { status: "ready", value: engine.computeEnvelope(lot.input, lot.district, options) };
    } catch (error) {
      return { status: "error", message: error instanceof Error ? error.message : String(error) };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- options are compared by value via `key`
  }, [engine, lot, key]);
}
