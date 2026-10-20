// Pure helpers for the page, kept free of React and three.js so they can be tested.
import { SLOTS, slotById, type SlotDef, type SlotId } from "../../src/town/catalog.ts";
import type { Placement, TownState } from "../../src/town/protocol.ts";
import {
  blockCentre,
  blockOf,
  ENTRANCE,
  GRID,
  nearStreet,
  SLAB,
  type Cell,
  type Point,
} from "./streets.ts";

/** Width of a lot's square, in world units. */
export const LOT_SIZE = GRID.lot;

/** Where the entrance sign stands: on the green by the entrance road, left of it. */
const NAME_SPOT: Point = [ENTRANCE[0] - GRID.street / 2 - 1.7, SLAB.maxZ - 1.5];

/** The paint fountain's town square: the free block in front of the central one. */
const FOUNTAIN_SPOT: Point = blockCentre([0, 1]);

/** Where a slot's lot sits, as [x, y, z]: the middle of its block; the entrance sign by
 * the entrance road and the paint fountain on the town square. */
export function lotPosition(slot: SlotId): [x: number, y: number, z: number] {
  const cell = blockOf(slot);
  const [x, z] = cell ? blockCentre(cell) : slot === "name" ? NAME_SPOT : FOUNTAIN_SPOT;
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

/** Small deterministic random generator (mulberry32), so the town looks the same every time. */
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

/** The cells of the grid no slot builds on: little parks among the blocks. */
export function freeCells(): Cell[] {
  const taken = new Set(SLOTS.flatMap((slot) => (slot.block ? [slot.block.join(",")] : [])));
  const free: Cell[] = [];
  for (let column = GRID.min; column <= GRID.max; column++)
    for (let row = GRID.min; row <= GRID.max; row++)
      if (!taken.has(`${column},${row}`)) free.push([column, row]);
  return free;
}

/** Is (x, z) on a slot's block, or within `margin` of one? */
function onSlotBlock(x: number, z: number, margin: number): boolean {
  return SLOTS.some((slot) => {
    if (!slot.block) return false;
    const [cx, cz] = blockCentre(slot.block);
    return Math.max(Math.abs(x - cx), Math.abs(z - cz)) < GRID.block / 2 + margin;
  });
}

/** Trees fill the green belt round the city and the little parks between its blocks; a
 * few rocks lie in the grass. Nothing grows on a slot's block or a street, so the city
 * can be built round them, and everything keeps clear of the signs, props and each other. */
export function decorSpots(seed = 7): DecorSpot[] {
  const random = seededRandom(seed);
  const props = Object.values(EXTRA_SPOTS);
  const spots: DecorSpot[] = [];
  const tryPlace = (kind: DecorSpot["kind"], x: number, z: number) => {
    if (onSlotBlock(x, z, 0.35) || nearStreet(x, z, 0.35)) return false;
    if (Math.hypot(x - NAME_SPOT[0], z - NAME_SPOT[1]) <= 2.6) return false;
    if (Math.hypot(x - FOUNTAIN_SPOT[0], z - FOUNTAIN_SPOT[1]) <= 2) return false;
    if (props.some(([px, pz]) => Math.hypot(x - px, z - pz) <= 1.9)) return false;
    if (spots.some((s) => Math.hypot(x - s.x, z - s.z) < (kind === "tree" ? 1.25 : 1.6)))
      return false;
    spots.push({
      kind,
      x,
      z,
      scale: kind === "tree" ? 0.75 + random() * 0.4 : 0.6 + random() * 0.5,
      rotation: random() * Math.PI * 2,
    });
    return true;
  };
  /** A point in the belt: along one of the four sides, between the city and the edge. */
  const inBelt = (): Point => {
    const side = Math.floor(random() * 4);
    const along = SLAB.minX + 0.7 + random() * (SLAB.maxX - SLAB.minX - 1.4);
    const depth = 0.7 + random() * (GRID.belt - 1.1);
    if (side === 0) return [along, SLAB.minZ + depth];
    if (side === 1) return [along, SLAB.maxZ - depth];
    if (side === 2) return [SLAB.minX + depth, along];
    return [SLAB.maxX - depth, along];
  };
  let trees = 0;
  for (let tries = 0; tries < 4000 && trees < 46; tries++)
    if (tryPlace("tree", ...inBelt())) trees++;
  for (const cell of freeCells()) {
    const [cx, cz] = blockCentre(cell);
    const reach = GRID.block / 2 - 0.5;
    for (let tries = 0, planted = 0; tries < 200 && planted < 4; tries++)
      if (tryPlace("tree", cx + (random() * 2 - 1) * reach, cz + (random() * 2 - 1) * reach))
        planted++;
  }
  for (let tries = 0, rocks = 0; tries < 600 && rocks < 7; tries++)
    if (tryPlace("rock", ...inBelt())) rocks++;
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

/** Where each extra stands, as [x, z]. The example and the docs library share the park
 * block; the lighthouse and the watchtower stand in little parks of their own, and the env
 * checkpoint by the entrance road. */
const PARK = blockCentre(blockOf("extras")!);
export const EXTRA_SPOTS: Readonly<Record<string, readonly [x: number, z: number]>> = {
  example: [PARK[0] - 0.95, PARK[1] - 0.7],
  "agent-docs": [PARK[0] + 0.95, PARK[1] - 0.7],
  ci: blockCentre([2, 2]),
  tests: blockCentre([2, -1]),
  env: [ENTRANCE[0] + GRID.street / 2 + 1.7, SLAB.maxZ - 1.6],
};

/** Room on the park block for extras the town has no spot for. */
const PARK_SPOTS = [
  [-0.95, 1.05],
  [0.95, 1.05],
  [0, 0.2],
  [0, -1.45],
] as const;

/** The four corners of a lot, for small props that share it. */
const CORNERS = [
  [-0.85, -0.85],
  [0.85, -0.85],
  [-0.85, 0.85],
  [0.85, 0.85],
] as const;

/** Where a prop stands, as [x, z]. `index` is its position in the answer: sign-in
 * methods fill their block's corners in order, unknown extras the free spots in the park. */
export function propSpot(slot: SlotId, optionId: string, index: number): [x: number, z: number] {
  if (slot === "extras") {
    if (Object.hasOwn(EXTRA_SPOTS, optionId)) {
      const [x, z] = EXTRA_SPOTS[optionId]!;
      return [x, z];
    }
    const [dx, dz] = PARK_SPOTS[index % PARK_SPOTS.length]!;
    return [PARK[0] + dx, PARK[1] + dz];
  }
  const [lx, , lz] = lotPosition(slot);
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

/** How long the agent can be silent, with nothing for the user to answer, before the
 * page says it is probably waiting in the terminal (e.g. on a permission prompt). */
export const TERMINAL_SIGN_AFTER_MS = 30_000;

/** The plan is on the billboard, waiting for Build it or Change something. */
export function isPlanWaiting(state: TownState): boolean {
  return state.phase === "plan" && state.plan !== null;
}

/** True when the agent has gone quiet with nothing to answer on the page. */
export function showTerminalSign(state: TownState, now: number): boolean {
  return (
    state.pending === null &&
    !isPlanWaiting(state) &&
    state.phase !== "done" &&
    !state.agentStopped &&
    now - state.lastAgentActivity > TERMINAL_SIGN_AFTER_MS
  );
}

/** The agent is working out the next interview question: the crane swings. */
export function isThinking(state: TownState): boolean {
  return state.pending === null && state.phase === "interview" && !state.agentStopped;
}

/** The first slot nobody has settled yet, where the crane waits. A slot settled as
 * "not needed" counts as settled, so the crane never waits on a lot nobody will fill. */
export function nextLot(state: TownState): SlotId | null {
  return SLOTS.find((slot) => state.placements[slot.id] === undefined)?.id ?? null;
}

/** Which card the billboard shows. The plan comes before any question; the plan and
 * report cards come with the build progress. */
export type BillboardCard = "question" | "plan" | "report";

export function billboardCard(state: TownState): BillboardCard | null {
  // The report stays up after the user quits the agent.
  if (state.phase === "done" && state.report) return "report";
  if (state.agentStopped) return null;
  if (isPlanWaiting(state)) return "plan";
  if (state.pending) return "question";
  return null;
}

/** How far outside its lot's square the crane's mast stands. */
const CRANE_GAP = 0.25;
/** From the crane's mast to the middle of its lot: the trolley's reach. */
export const CRANE_REACH = LOT_SIZE / 2 + CRANE_GAP;

/** Where the thinking crane stands for `slot`'s lot: its mast on the block's back
 * sidewalk, between the lot and the street behind it, turned by `yaw` round y so its jib
 * (local +x) reaches out over the lot towards the camera, `reach` to the lot's centre. */
export function craneSpot(slot: SlotId): { x: number; z: number; yaw: number; reach: number } {
  const [lx, , lz] = lotPosition(slot);
  return { x: lx, z: lz - CRANE_REACH, yaw: -Math.PI / 2, reach: CRANE_REACH };
}
