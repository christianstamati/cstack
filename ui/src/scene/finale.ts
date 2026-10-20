// The finale's clock, shared by the parts that join in: `LightsUp` starts it when the report
// arrives and ticks it every frame of the show; windows and street lamps subscribe with
// `useLightsUp` and update their own materials, so nothing re-renders. The report card waits
// for `useFinaleOver` before it says the project is ready.
import { useLayoutEffect, useRef, useSyncExternalStore, type RefObject } from "react";
import { Vector3, type Object3D } from "three";

import { FINALE_SECONDS, lightsUpLevel, LIT_LEVEL, type FinaleKind } from "../logic.ts";
import { blockCentre, SPIRAL } from "../streets.ts";

interface Show {
  kind: FinaleKind;
  /** The lights come on (it is night). */
  lit: boolean;
  /** When it started, in seconds on `performance.now`. */
  start: number;
}

let show: Show | null = null;
let elapsed = 0;
let over = false;
const lights = new Set<() => void>();
const overListeners = new Set<() => void>();

/** The middle of the town, where the lights start. */
const [CENTRE_X, CENTRE_Z] = blockCentre(SPIRAL[0]!);
const distances = new WeakMap<Object3D, number>();
const scratch = new Vector3();

/** How far `object` stands from the middle of the town, worked out once (it doesn't move). */
function distanceOf(object: Object3D | null): number {
  if (!object) return 0;
  let distance = distances.get(object);
  if (distance === undefined) {
    object.getWorldPosition(scratch);
    distance = Math.hypot(scratch.x - CENTRE_X, scratch.z - CENTRE_Z);
    distances.set(object, distance);
  }
  return distance;
}

/** How bright `object`'s light is now, as a multiple of its usual night glow. */
function levelOf(object: Object3D | null): number {
  if (!show?.lit) return 1;
  if (show.kind === "still" || elapsed >= FINALE_SECONDS) return LIT_LEVEL;
  return lightsUpLevel(distanceOf(object), elapsed);
}

/** Starts the show (once). A still finale is over at once, its lights simply on. */
export function startFinale(kind: FinaleKind, lit: boolean, at: number): void {
  if (show) return;
  show = { kind, lit, start: at };
  elapsed = 0;
  if (lit) for (const light of lights) light();
  if (kind === "still") finish();
}

/** Moves the show on to `at` (seconds on `performance.now`); returns how far it is in. */
export function tickFinale(at: number): number {
  if (!show || over) return elapsed;
  elapsed = Math.min(at - show.start, FINALE_SECONDS);
  if (show.lit) for (const light of lights) light();
  if (elapsed >= FINALE_SECONDS) finish();
  return elapsed;
}

function finish(): void {
  over = true;
  for (const listener of overListeners) listener();
}

/** The show under way, if any, and whether it is over. */
export function finaleShow(): { show: Show | null; over: boolean } {
  return { show, over };
}

/** Calls `apply` with `object`'s light level now and on every frame of the show. */
export function useLightsUp(
  object: RefObject<Object3D | null>,
  apply: (level: number) => void,
): void {
  const latest = useRef(apply);
  latest.current = apply;
  useLayoutEffect(() => {
    const light = () => latest.current(levelOf(object.current));
    light();
    lights.add(light);
    return () => {
      lights.delete(light);
    };
  }, [object]);
}

function subscribeOver(listener: () => void): () => void {
  overListeners.add(listener);
  return () => overListeners.delete(listener);
}

/** True once the finale has played (or was skipped). */
export function useFinaleOver(): boolean {
  return useSyncExternalStore(subscribeOver, () => over);
}
