import { useCallback, useLayoutEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import type { OkResult } from "../state/steps";
import { num } from "../ui/format";
import { buildSchedule, nextPosition, positionAt, previousPosition, type MotionMode, type Schedule } from "./schedule";
import { buildTimeline, initialState, type AnimState } from "./timeline";

export interface HudRefs {
  volume: RefObject<HTMLElement | null>;
  footprint: RefObject<HTMLElement | null>;
  percent: RefObject<HTMLElement | null>;
}

export interface Player {
  /** Mutable state the scene reads every frame. */
  anim: AnimState;
  schedule: Schedule | null;
  /** Step position under the playhead: 0 = start, 1…N = rules, N + 1 = result. */
  position: number;
  /** The same, read now (it updates before React re-renders). */
  currentPosition(): number;
  /** A step is animating toward its resting point (the arrival, or after Next). */
  animating: boolean;
  mode: MotionMode;
  /** Animates the next step and stops at its resting point. Pressed mid-animation, it finishes that step first. */
  next(): void;
  /** Jumps to the previous step's resting point (or back to where an animating step began). */
  back(): void;
  /** Jumps to a step's resting point without animating. */
  goTo(position: number): void;
  /** Finishes any running animation at its resting point. */
  settle(): void;
  registerCard(index: number, element: HTMLElement | null): void;
  hud: HudRefs;
}
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(REDUCED_MOTION);
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false,
  );
}

/**
 * Owns the single GSAP timeline for a result. Nothing advances on its own:
 * a fresh visit plays the arrival and waits at the starting block, and each
 * press of Next animates one step and stops where it rests. A requested step
 * (deep link, or the step we were on before a toggle rebuilt the envelope)
 * opens at rest there.
 */
export function usePlayer(result: OkResult, requestedStep: number | null, onPosition: (position: number) => void): Player {
  const mode: MotionMode = useReducedMotion() ? "reduced" : "full";
  const anim = useRef<AnimState>(initialState(result, mode)).current;
  const timeline = useRef<gsap.core.Timeline | null>(null);
  const scheduleRef = useRef<Schedule | null>(null);
  const cards = useRef<(HTMLElement | null)[]>([]);
  const stopAt = useRef<number | null>(null);
  const positionRef = useRef(0);
  const builtOnce = useRef(false);
  const requested = useRef(requestedStep);
  requested.current = requestedStep;
  const onPositionRef = useRef(onPosition);
  onPositionRef.current = onPosition;

  const hud: HudRefs = { volume: useRef(null), footprint: useRef(null), percent: useRef(null) };
  const hudRef = useRef(hud);
  hudRef.current = hud;

  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [position, setPosition] = useState(0);
  const [animating, setAnimating] = useState(false);

  /** Pushes the playhead out to everything that isn't the 3D scene. Called on every timeline update. */
  const sync = useCallback(() => {
    const tl = timeline.current;
    const s = scheduleRef.current;
    if (!tl || !s) return;
    if (stopAt.current !== null && tl.time() >= stopAt.current - 1e-6) {
      const target = stopAt.current;
      stopAt.current = null;
      tl.pause();
      tl.seek(target);
      setAnimating(false);
    }
    const p = positionAt(s, tl.time());
    if (p !== positionRef.current) {
      positionRef.current = p;
      setPosition(p);
      onPositionRef.current(p);
    }
    const { volume, footprint, percent } = hudRef.current;
    setText(volume.current, `${num(anim.volume)} cu ft`);
    setText(footprint.current, `${num(anim.footprint)} sq ft`);
    setText(percent.current, `${num(anim.percentLeft)}%`);
  }, [anim]);

  const seek = useCallback(
    (time: number) => {
      stopAt.current = null;
      timeline.current?.pause().seek(time);
      setAnimating(false);
      sync();
    },
    [sync],
  );

  const playTo = useCallback(
    (time: number) => {
      const tl = timeline.current;
      if (!tl) return;
      if (time <= tl.time() + 1e-6) return seek(time);
      stopAt.current = time;
      tl.play();
      setAnimating(true);
    },
    [seek],
  );

  // Build (and rebuild) the timeline once the cards exist; layout effect, so nothing flashes.
  useLayoutEffect(() => {
    const s = buildSchedule(result, mode);
    Object.assign(anim, initialState(result, mode));
    const tl = buildTimeline(result, s, anim, { cards: cards.current.slice(0, result.steps.length), summary: null });
    tl.eventCallback("onUpdate", sync);
    tl.eventCallback("onComplete", () => setAnimating(false));
    timeline.current = tl;
    scheduleRef.current = s;
    setSchedule(s);

    const last = s.labels.length - 1;
    const step = requested.current;
    positionRef.current = -1; // force the first sync to publish the position
    if (!builtOnce.current && step === null) {
      tl.seek(0);
      sync();
      stopAt.current = s.labels[0]!;
      tl.play();
      setAnimating(true);
    } else {
      seek(s.labels[Math.min(Math.max(step ?? 0, 0), last)]!);
    }
    builtOnce.current = true;
    return () => {
      tl.kill();
      timeline.current = null;
    };
  }, [result, mode, anim, sync, seek]);

  const s = schedule;
  return {
    anim,
    schedule,
    position,
    animating,
    mode,
    next: () => {
      const tl = timeline.current;
      if (!tl || !s) return;
      const last = s.labels.length - 1;
      // Pressed mid-animation: land that step now, then animate the one after it.
      if (stopAt.current !== null) seek(stopAt.current);
      const p = nextPosition(s, tl.time());
      if (p > last) return;
      playTo(s.labels[p]!);
    },
    back: () => {
      const tl = timeline.current;
      if (!tl || !s) return;
      seek(s.labels[previousPosition(s, tl.time())]!);
    },
    goTo: (p: number) => s && seek(s.labels[Math.min(Math.max(p, 0), s.labels.length - 1)]!),
    settle: () => {
      const tl = timeline.current;
      if (tl) seek(stopAt.current ?? tl.time());
    },
    currentPosition: () => Math.max(positionRef.current, 0),
    registerCard: (index: number, element: HTMLElement | null) => {
      cards.current[index] = element;
    },
    hud,
  };
}

function setText(element: HTMLElement | null, text: string) {
  if (element && element.textContent !== text) element.textContent = text;
}
