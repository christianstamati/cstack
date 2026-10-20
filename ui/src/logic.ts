// Pure helpers for the page, kept free of React and three.js so they can be tested.
import { SLOTS, slotById, type SlotDef, type SlotId } from "../../src/town/catalog.ts";
import type { Placement } from "../../src/town/protocol.ts";

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

/** Trees ring the shore, so they never stand between the lots or in front of a building;
 * a few low rocks dot the grass in between. Everything keeps clear of every lot, every
 * prop and each other. */
export function decorSpots(seed = 7): DecorSpot[] {
  const random = seededRandom(seed);
  const lots = SLOTS.map((slot) => slot.lot);
  const props = Object.values(EXTRA_SPOTS);
  const spots: DecorSpot[] = [];
  const tryPlace = (kind: DecorSpot["kind"], radius: number, lotGap: number) => {
    const angle = random() * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    if (lots.some(([lx, lz]) => Math.hypot(x - lx, z - lz) <= lotGap)) return;
    if (props.some(([px, pz]) => Math.hypot(x - px, z - pz) <= 2.3)) return;
    if (spots.some((s) => Math.hypot(x - s.x, z - s.z) < (kind === "tree" ? 1.5 : 1.8))) return;
    spots.push({
      kind,
      x,
      z,
      scale: kind === "tree" ? 0.75 + random() * 0.4 : 0.6 + random() * 0.5,
      rotation: random() * Math.PI * 2,
    });
  };
  for (let tries = 0; tries < 3000 && spots.length < 30; tries++)
    tryPlace("tree", 11.8 + random() * 1.4, 3.3);
  for (let tries = 0, rocks = 0; tries < 500 && rocks < 8; tries++) {
    const before = spots.length;
    tryPlace("rock", 3 + random() * 6.5, LOT_SIZE + 0.4);
    if (spots.length > before) rocks++;
  }
  return spots;
}

/** Which model a placement shows. Empty option ids mean the slot doesn't apply ("not
 * needed"), never the generic building; an option the catalog doesn't list gets the
 * generic building. The name is free text, so it is always the sign. */
export type ModelKind = "building" | "generic" | "notNeeded" | "sign" | "paint" | "props";

export function modelKindFor(slot: SlotDef, placement: Placement): ModelKind {
  if (slot.kind === "sign") return "sign";
  const [first] = placement.optionIds;
  if (first === undefined) return "notNeeded";
  if (slot.kind !== "building") return slot.kind;
  return slot.options.some((option) => option.id === first) ? "building" : "generic";
}

/** How a building is shown. Only `preview` and `placed` are drawn so far; the build
 * stages come with the build progress. */
export type Stage = "preview" | "placed" | "blueprint" | "constructing" | "solid" | "failed";

/** The town's paint, from the `ui` styling answer. */
export interface Theme {
  /** Wall colour, from the base colour. */
  base: string;
  /** Doors, awnings and trims, from the theme colour. */
  accent: string;
  /** 0 (sharp boxes) to 1 (soft, rounded), from the radius. */
  roundness: number;
}

/** shadcn base colours (the neutral grey families), as light wall paints. */
export const BASE_COLORS: Readonly<Record<string, string>> = {
  neutral: "#d4d4d4",
  zinc: "#d4d4d8",
  stone: "#d6d3d1",
  slate: "#cbd5e1",
  gray: "#d1d5db",
  mauve: "#dcd0de",
  olive: "#d6d9c4",
  mist: "#cfdde0",
  taupe: "#ddd2c8",
};

/** shadcn theme colours, as accent paints. */
export const THEME_COLORS: Readonly<Record<string, string>> = {
  neutral: "#737373",
  stone: "#78716c",
  zinc: "#71717a",
  gray: "#6b7280",
  slate: "#64748b",
  mauve: "#8f7a92",
  olive: "#7c8461",
  mist: "#6f8a90",
  taupe: "#8a7a6c",
  red: "#ef4444",
  orange: "#f97316",
  amber: "#f59e0b",
  yellow: "#eab308",
  lime: "#84cc16",
  green: "#22c55e",
  emerald: "#10b981",
  teal: "#14b8a6",
  cyan: "#06b6d4",
  sky: "#0ea5e9",
  blue: "#3b82f6",
  indigo: "#6366f1",
  violet: "#8b5cf6",
  purple: "#a855f7",
  fuchsia: "#d946ef",
  pink: "#ec4899",
  rose: "#f43f5e",
};

/** The town before any styling answer: cream walls, warm orange trims, softly rounded. */
export const DEFAULT_THEME: Theme = { base: "#e3d9c6", accent: "#e8833a", roundness: 0.5 };

/** The keys of the `ui` answer's `key:value` option ids (see .github/TOWN.md). */
export const UI_KEYS = ["style", "baseColor", "theme", "iconLibrary", "font", "radius"] as const;
export type UiKey = (typeof UI_KEYS)[number];

const UI_KEY_BY_LOOSE_NAME = new Map<string, UiKey>(UI_KEYS.map((key) => [key.toLowerCase(), key]));

/** Reads the `ui` answer's `key:value` option ids. Keys are matched loosely
 * ("Base-Color" is `baseColor`), values are lower-cased; anything else is ignored. */
export function uiSettings(ui: Placement | undefined): Partial<Record<UiKey, string>> {
  const settings: Partial<Record<UiKey, string>> = {};
  for (const id of ui?.optionIds ?? []) {
    const colon = id.indexOf(":");
    if (colon === -1) continue;
    const key = UI_KEY_BY_LOOSE_NAME.get(
      id
        .slice(0, colon)
        .toLowerCase()
        .replace(/[^a-z]/g, ""),
    );
    const value = id
      .slice(colon + 1)
      .trim()
      .toLowerCase();
    if (key && value) settings[key] = value;
  }
  return settings;
}

const RADIUS_NAMES: Readonly<Record<string, number>> = {
  none: 0,
  small: 0.3,
  sm: 0.3,
  medium: 0.5,
  md: 0.5,
  large: 1,
  lg: 1,
  full: 1,
};

/** A shadcn radius ("0.625", "0.5rem", "8px", "large") as a roundness from 0 to 1. */
function roundnessFrom(radius: string | undefined): number | undefined {
  if (radius === undefined) return undefined;
  if (Object.hasOwn(RADIUS_NAMES, radius)) return RADIUS_NAMES[radius];
  const match = /^(\d*\.?\d+)(rem|px)?$/.exec(radius);
  if (!match) return undefined;
  const rem = Number(match[1]) / (match[2] === "px" ? 16 : 1);
  return Math.min(rem, 1);
}

function lookup(table: Readonly<Record<string, string>>, key: string | undefined) {
  return key !== undefined && Object.hasOwn(table, key) ? table[key] : undefined;
}

/** The town's paint for a `ui` answer; every missing or unknown value keeps its default. */
export function themeFor(ui: Placement | undefined): Theme {
  const settings = uiSettings(ui);
  const hex = settings.theme && /^#[0-9a-f]{6}$/.test(settings.theme) ? settings.theme : undefined;
  return {
    base: lookup(BASE_COLORS, settings.baseColor) ?? DEFAULT_THEME.base,
    accent: lookup(THEME_COLORS, settings.theme) ?? hex ?? DEFAULT_THEME.accent,
    roundness: roundnessFrom(settings.radius) ?? DEFAULT_THEME.roundness,
  };
}

/** Fraction of the drop spent falling; the rest is the one bounce. */
const DROP_IMPACT = 0.55;
/** Height of the bounce, as a fraction of the drop height. */
const DROP_BOUNCE = 0.14;

export interface DropPose {
  /** Height above the lot, as a fraction of the drop height. */
  y: number;
  squashY: number;
  squashXZ: number;
}

/** Where a dropping building is at `t` (0 = start, 1 = settled): it falls, squashes as
 * it lands, bounces once and settles. */
export function dropPose(t: number): DropPose {
  const p = Math.min(Math.max(t, 0), 1);
  if (p >= 1) return { y: 0, squashY: 1, squashXZ: 1 };
  let y: number;
  if (p < DROP_IMPACT) {
    const u = p / DROP_IMPACT;
    y = 1 - u * u;
  } else {
    const u = (p - DROP_IMPACT) / (1 - DROP_IMPACT);
    y = DROP_BOUNCE * 4 * u * (1 - u);
  }
  const sinceImpact = p - DROP_IMPACT;
  const squash = sinceImpact >= 0 ? Math.max(0, 1 - sinceImpact / 0.18) : 0;
  return { y, squashY: 1 - 0.28 * squash, squashXZ: 1 + 0.16 * squash };
}

/** Where each extra stands, as [x, z]. The example sits on the extras lot; the rest are
 * spread around the town (the lighthouse on the shore). */
export const EXTRA_SPOTS: Readonly<Record<string, readonly [x: number, z: number]>> = {
  example: slotById("extras").lot,
  ci: [-6, -11],
  tests: [-10.5, 6.5],
  env: [-3, 11.8],
  "agent-docs": [1.5, -4.5],
};

/** The four corners of a lot, for small props that share it. */
const CORNERS = [
  [-0.85, -0.85],
  [0.85, -0.85],
  [-0.85, 0.85],
  [0.85, 0.85],
] as const;

/** Where a prop stands, as [x, z]. `index` is its position in the answer: sign-in
 * methods fill their lot's corners in order, unknown extras the extras lot's corners. */
export function propSpot(slot: SlotId, optionId: string, index: number): [x: number, z: number] {
  const known = slot === "extras" && Object.hasOwn(EXTRA_SPOTS, optionId);
  if (known) {
    const [x, z] = EXTRA_SPOTS[optionId]!;
    return [x, z];
  }
  const [lx, lz] = slotById(slot).lot;
  const [dx, dz] = CORNERS[index % CORNERS.length]!;
  return [lx + dx, lz + dz];
}

/** The project name for the entrance sign: the typed name if there is one. */
export function projectNameFrom(name: Placement | undefined, fallback: string): string {
  const typed = name?.labels.findLast((label) => label.trim() !== "");
  return typed?.trim() ?? fallback;
}

/** The hover label of a placed building or prop. */
export function hoverText(placement: Placement): { title: string; detail: string | null } {
  const chosen = placement.labels.length > 0 ? placement.labels : placement.optionIds;
  return {
    title: `${slotById(placement.slot).label}: ${chosen.join(", ")}`,
    detail: placement.reason ?? (placement.auto ? "Picked automatically" : null),
  };
}
