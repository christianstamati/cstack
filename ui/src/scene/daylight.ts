// How dark it is, for the parts that light up at night (windows, street lamps, headlights,
// clouds). The sky sets it every frame as it eases between day and night; parts subscribe
// with `useNight` and update their own materials, so nothing re-renders.
import { useLayoutEffect, useRef } from "react";

/** 0 in full day, 1 at night. */
let night = 0;
const listeners = new Set<(night: number) => void>();

/** How dark it is now. */
export function currentNight(): number {
  return night;
}

/** Set by the sky. Tiny changes are skipped, except reaching full day or night. */
export function setNight(value: number): void {
  const settled = value === 0 || value === 1;
  if (Math.abs(value - night) < 0.004 && !(settled && value !== night)) return;
  night = value;
  for (const listener of listeners) listener(value);
}

/** Calls `apply` now, whenever the night changes and whenever `deps` change, until the
 * caller unmounts. */
export function useNight(apply: (night: number) => void, deps: readonly unknown[] = []): void {
  const latest = useRef(apply);
  latest.current = apply;
  useLayoutEffect(() => latest.current(night), deps);
  useLayoutEffect(() => {
    const listener = (value: number) => latest.current(value);
    listener(night);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
}
