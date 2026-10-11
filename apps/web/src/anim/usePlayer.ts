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
  playing: boolean;
  speed: 1 | 2;
  mode: MotionMode;
  play(): void;
  pause(): void;
  next(): void;
  back(): void;
  goTo(position: number): void;
  /** Scrubber: 0–1 of the whole sequence. */
  seekProgress(progress: number): void;
  setSpeed(speed: 1 | 2): void;
  setScrubbing(active: boolean): void;
  registerCard(index: number, element: HTMLElement | null): void;
  scrubberRef: RefObject<HTMLInputElement | null>;
  hud: HudRefs;
}

const SCRUBBER_STEPS = 1000;
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
 * Owns the single GSAP timeline for a result. A fresh visit plays the arrival
 * and pauses at the starting block; a requested step (deep link, or the step
 * we were on before a toggle rebuilt the envelope) opens paused there.
 */
export function usePlayer(result: OkResult, requestedStep: number | null, onPosition: (position: number) => void): Player {
  const mode: MotionMode = useReducedMotion() ? "reduced" : "full";
  const anim = useRef<AnimState>(initialState(result, mode)).current;
  const timeline = useRef<gsap.core.Timeline | null>(null);
  const scheduleRef = useRef<Schedule | null>(null);
  const cards = useRef<(HTMLElement | null)[]>([]);
  const stopAt = useRef<number | null>(null);
  const scrubbing = useRef(false);
  const positionRef = useRef(0);
  const speedRef = useRef<1 | 2>(1);
  const builtOnce = useRef(false);
  const requested = useRef(requestedStep);
  requested.current = requestedStep;
  const onPositionRef = useRef(onPosition);
  onPositionRef.current = onPosition;

  const scrubberRef = useRef<HTMLInputElement | null>(null);
  const hud: HudRefs = { volume: useRef(null), footprint: useRef(null), percent: useRef(null) };
  const hudRef = useRef(hud);
  hudRef.current = hud;

  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [position, setPosition] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeedState] = useState<1 | 2>(1);

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
      setPlaying(false);
    }
    const p = positionAt(s, tl.time());
    if (p !== positionRef.current) {
      positionRef.current = p;
      setPosition(p);
      onPositionRef.current(p);
    }
    if (scrubberRef.current && !scrubbing.current) scrubberRef.current.value = String(Math.round(tl.progress() * SCRUBBER_STEPS));
    const { volume, footprint, percent } = hudRef.current;
    setText(volume.current, `${num(anim.volume)} cu ft`);
    setText(footprint.current, `${num(anim.footprint)} sq ft`);
    setText(percent.current, `${num(anim.percentLeft)}%`);
  }, [anim]);

  const seek = useCallback(
    (time: number) => {
      stopAt.current = null;
      timeline.current?.pause().seek(time);
      setPlaying(false);
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
      setPlaying(true);
    },
    [seek],
  );

  // Build (and rebuild) the timeline once the cards exist; layout effect, so nothing flashes.
  useLayoutEffect(() => {
    const s = buildSchedule(result, mode);
    Object.assign(anim, initialState(result, mode));
    const tl = buildTimeline(result, s, anim, { cards: cards.current.slice(0, result.steps.length), summary: null });
    tl.timeScale(speedRef.current);
    tl.eventCallback("onUpdate", sync);
    tl.eventCallback("onComplete", () => setPlaying(false));
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
      setPlaying(true);
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
    playing,
    speed,
    mode,
    play: () => {
      const tl = timeline.current;
      if (!tl || !s) return;
      if (tl.progress() >= 1) tl.seek(s.labels[0]!);
      stopAt.current = null;
      tl.play();
      setPlaying(true);
    },
    pause: () => seek(timeline.current?.time() ?? 0),
    next: () => {
      const tl = timeline.current;
      if (!tl || !s) return;
      const last = s.labels.length - 1;
      // While already heading to a step, Next means the one after it.
      const heading = stopAt.current === null ? -1 : s.labels.indexOf(stopAt.current);
      const target = heading >= 0 ? Math.min(heading + 1, last) : nextPosition(s, tl.time());
      playTo(s.labels[target]!);
    },
    back: () => {
      const tl = timeline.current;
      if (!tl || !s) return;
      seek(s.labels[previousPosition(s, tl.time())]!);
    },
    goTo: (p: number) => s && seek(s.labels[p]!),
    seekProgress: (progress: number) => {
      const tl = timeline.current;
      if (!tl) return;
      stopAt.current = null;
      tl.pause().progress(Math.min(Math.max(progress, 0), 1));
      setPlaying(false);
      sync();
    },
    setSpeed: (value: 1 | 2) => {
      speedRef.current = value;
      timeline.current?.timeScale(value);
      setSpeedState(value);
    },
    setScrubbing: (active: boolean) => {
      scrubbing.current = active;
    },
    registerCard: (index: number, element: HTMLElement | null) => {
      cards.current[index] = element;
    },
    scrubberRef,
    hud,
  };
}

function setText(element: HTMLElement | null, text: string) {
  if (element && element.textContent !== text) element.textContent = text;
}

export { SCRUBBER_STEPS };
