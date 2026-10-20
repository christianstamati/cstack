// Pure helpers for the page, kept free of React and three.js so they can be tested.
import { SLOTS, slotById, type SlotId } from "../../src/town/catalog.ts";

/** Radius of the island's flat top, in world units. Every lot fits inside it. */
export const ISLAND_RADIUS = 14;

/** Width of a lot's square, in world units. */
export const LOT_SIZE = 3;

/** Where a slot's lot sits on the island top, as [x, y, z]. */
export function lotPosition(slot: SlotId): [x: number, y: number, z: number] {
  const [x, z] = slotById(slot).lot;
  return [x, 0, z];
}

export function tokenFrom(search: string): string | null {
  return new URLSearchParams(search).get("token");
}

/** Milliseconds to wait before reconnect attempt `attempt` (0-based). */
export function reconnectDelay(attempt: number): number {
  return Math.min(500 * 2 ** attempt, 5000);
}

export type AnswerOutcome = "ok" | "stale" | "invalid";

export function answerOutcome(status: number): AnswerOutcome {
  if (status === 204) return "ok";
  if (status === 409) return "stale";
  return "invalid";
}

export const MUTE_KEY = "cstack-town-muted";

type MuteStorage = Pick<Storage, "getItem" | "setItem">;

/** Whether the music is muted. Storage can be missing or throw (private mode, blocked). */
export function readMuted(storage: MuteStorage | undefined): boolean {
  try {
    return storage?.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeMuted(storage: MuteStorage | undefined, muted: boolean): void {
  try {
    storage?.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    // Not remembered this time; the button still works.
  }
}

/** `localStorage`, or undefined where reading it throws. */
export function browserStorage(): MuteStorage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

/** Small deterministic random generator (mulberry32), so the island looks the same every time. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface DecorSpot {
  kind: "tree" | "rock";
  x: number;
  z: number;
  scale: number;
  rotation: number;
}

/** Places trees and rocks on the island, away from every lot and from each other. */
export function decorSpots(count = 22, seed = 7): DecorSpot[] {
  const random = seededRandom(seed);
  const lots = SLOTS.map((slot) => slot.lot);
  const spots: DecorSpot[] = [];
  for (let tries = 0; tries < 2000 && spots.length < count; tries++) {
    const angle = random() * Math.PI * 2;
    const radius = 3 + Math.sqrt(random()) * (ISLAND_RADIUS - 5.5);
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    if (lots.some(([lx, lz]) => Math.hypot(x - lx, z - lz) <= LOT_SIZE + 0.3)) continue;
    if (spots.some((s) => Math.hypot(x - s.x, z - s.z) < 1.8)) continue;
    spots.push({
      kind: random() < 0.7 ? "tree" : "rock",
      x,
      z,
      scale: 0.7 + random() * 0.6,
      rotation: random() * Math.PI * 2,
    });
  }
  return spots;
}
