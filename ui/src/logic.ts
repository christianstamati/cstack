// Pure helpers for the page, kept free of React and three.js so they can be tested.
import { SLOTS, slotById, type SlotDef, type SlotId } from "../../src/town/catalog.ts";
import type { BuildStep, Placement, ReportView, TownState } from "../../src/town/protocol.ts";
import {
  assignBlocks,
  blockCentre,
  ENTRANCE,
  ENTRANCE_EDGE,
  GRID,
  nearStreet,
  nextBlock,
  SLAB,
  SPIRAL,
  type Point,
} from "./streets.ts";

type Placements = TownState["placements"];

/** Width of a lot's square, in world units. */
export const LOT_SIZE = GRID.lot;

/** Where the entrance sign stands: on the green by the entrance road, left of it. */
export const NAME_SPOT: Point = [ENTRANCE[0] - GRID.street / 2 - 1.7, SLAB.maxZ - 1.5];

/** The paint fountain's little square: on the green, further left of the sign. */
export const FOUNTAIN_SPOT: Point = [NAME_SPOT[0] - 4.4, SLAB.maxZ - 1.5];

/** Where `slot` stands, as [x, z]: the middle of the block it was given, or of the next
 * free block while it isn't placed yet (where a preview of it floats); the entrance sign
 * by the entrance road and the paint fountain on its square. */
export function spotFor(slot: SlotId, placements: Placements): Point {
  const kind = slotById(slot).kind;
  if (kind === "sign") return NAME_SPOT;
  if (kind === "paint") return FOUNTAIN_SPOT;
  const cell = assignBlocks(placements)[slot] ?? nextBlock(placements) ?? SPIRAL.at(-1)!;
  return blockCentre(cell);
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

/** Is (x, z) on a block of the grid, or within `margin` of one? Any of them may be built on. */
function onGrid(x: number, z: number, margin: number): boolean {
  return SPIRAL.some((cell) => {
    const [cx, cz] = blockCentre(cell);
    return Math.max(Math.abs(x - cx), Math.abs(z - cz)) < GRID.block / 2 + margin;
  });
}

/** Room kept round the sign's and the fountain's spots: their surveyed plot (and the crane
 * at its back) plus a tree crown. */
const PLOT_CLEARANCE = LOT_SIZE / 2 + 0.8;

/** Trees fill the green belt round the city, and a few rocks lie in its grass. Nothing
 * grows where a block or a street could ever be, so the city can be built round them, and
 * everything keeps clear of the sign's and the fountain's plots, the props and each other. */
export function decorSpots(seed = 7): DecorSpot[] {
  const random = seededRandom(seed);
  const props = [EXTRA_SPOTS.ci!, EXTRA_SPOTS.tests!, EXTRA_SPOTS.env!];
  const spots: DecorSpot[] = [];
  const tryPlace = (kind: DecorSpot["kind"], x: number, z: number) => {
    if (onGrid(x, z, 0.35) || nearStreet(x, z, 0.35)) return false;
    for (const [px, pz] of [NAME_SPOT, FOUNTAIN_SPOT]) {
      if (Math.max(Math.abs(x - px), Math.abs(z - pz)) <= PLOT_CLEARANCE) return false;
      const mast = craneSpot([px, pz]);
      if (Math.hypot(x - mast.x, z - mast.z) <= 1.3) return false;
    }
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
  for (let tries = 0; tries < 5000 && trees < 52; tries++)
    if (tryPlace("tree", ...inBelt())) trees++;
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

/** How a building is shown: `preview` while an option is hovered, `placed` through the
 * interview and the plan, then the build stages (see `stageFor`). */
export type Stage = "preview" | "placed" | "blueprint" | "constructing" | "solid" | "failed";

/** The last build step that covers `slot`, if any. */
export function latestStep(slot: SlotId, steps: readonly BuildStep[]): BuildStep | undefined {
  return steps.findLast((step) => step.slots.includes(slot));
}

/** How `slot`'s building is shown. `placed` in the interview and the plan. In the build, a
 * blueprint until a step covering it starts, then `constructing`, `solid` once done and
 * `failed` if its latest step failed. Once done, every building is solid unless it failed. */
export function stageFor(slot: SlotId, state: TownState): Stage {
  if (state.phase === "interview" || state.phase === "plan") return "placed";
  const step = latestStep(slot, state.steps);
  if (step?.status === "failed") return "failed";
  if (state.phase === "done") return "solid";
  if (!step) return "blueprint";
  return step.status === "started" ? "constructing" : "solid";
}

/** What the hover label adds about the build: the step building it, or why it failed. */
export function buildNote(slot: SlotId, state: TownState): string | null {
  if (state.phase !== "build" && state.phase !== "done") return null;
  const step = latestStep(slot, state.steps);
  if (step?.status === "failed") return `Failed: ${step.message?.trim() || step.name}`;
  if (step?.status === "started" && state.phase === "build") return `Building: ${step.name}`;
  return null;
}

/** The slots that have something in the town (the entrance sign counts, as `name`), in
 * the catalog's order: what "Change something" can pick. */
export function pickable(placements: Placements): SlotId[] {
  return SLOTS.filter((slot) => {
    const placement = placements[slot.id];
    return placement !== undefined && modelKindFor(slot, placement) !== "notNeeded";
  }).map((slot) => slot.id);
}

/** A small sign the final report puts in the town: a to-do (a manual step) by the building
 * it belongs to, or a warning listing what wasn't verified. Its text is shown on hover. */
export interface SignSpot {
  kind: "todo" | "warning";
  lines: string[];
  at: Point;
}

/** Spots along both sides of the entrance road, nearest the slab's edge first. The first
 * one is the warning's. */
const ROADSIDE: readonly Point[] = [0.5, 1.1, 1.7, 2.3].flatMap((back): Point[] => [
  [ENTRANCE_EDGE[0] + 1.25, ENTRANCE_EDGE[1] - back],
  [ENTRANCE_EDGE[0] - 1.25, ENTRANCE_EDGE[1] - back],
]);

function roadside(index: number): Point {
  const [x, z] = ROADSIDE[index % ROADSIDE.length]!;
  // More signs than spots: another pair of rows, a little further from the road.
  const out = Math.floor(index / ROADSIDE.length) * 0.55;
  return [x + Math.sign(x - ENTRANCE_EDGE[0]) * out, z];
}

/** Where the report's signs stand: each manual step on the sidewalk beside its slot's
 * building (the fountain's square for the paint), else by the entrance road (no slot, or
 * nothing of it in the town); the warning for unverified items first by the road. */
export function signSpots(report: ReportView, placements: Placements): SignSpot[] {
  const real = new Set(pickable(placements));
  const blocks = assignBlocks(placements);
  const bySlot = new Map<SlotId, number>();
  let atEntrance = 1;
  const signs: SignSpot[] = report.manualSteps.map(({ slot, text }) => {
    const cell = slot && real.has(slot) ? blocks[slot] : undefined;
    const home = slot === "ui" && real.has("ui") ? FOUNTAIN_SPOT : cell ? blockCentre(cell) : null;
    if (!slot || !home) return { kind: "todo", lines: [text], at: roadside(atEntrance++) };
    const index = bySlot.get(slot) ?? 0;
    bySlot.set(slot, index + 1);
    // Down the block's side that faces the camera, on the sidewalk; then the other side.
    const side = index < 5 ? 1 : -1;
    const along = 1.2 - (index % 5) * 0.6;
    const out = slot === "ui" ? 1.9 : GRID.block / 2 - 0.35;
    return { kind: "todo", lines: [text], at: [home[0] + side * out, home[1] + along] };
  });
  if (report.unverified.length > 0)
    signs.push({ kind: "warning", lines: [...report.unverified], at: roadside(0) });
  return signs;
}

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

/** Where the extras that don't stand on the extras block go: the lighthouse and the
 * watchtower on the green at the front corners, the env checkpoint by the entrance road. */
export const EXTRA_SPOTS: Readonly<Record<string, Point>> = {
  ci: [SLAB.maxX - 1.6, SLAB.maxZ - 1.6],
  tests: [SLAB.minX + 1.6, SLAB.maxZ - 1.6],
  env: [ENTRANCE[0] + GRID.street / 2 + 1.7, SLAB.maxZ - 1.6],
};

/** Where the other extras stand on the extras block, from its middle: the example kiosk and
 * the docs library, then room for extras the town has no spot for. */
const PARK_SPOTS: Readonly<Record<string, readonly [dx: number, dz: number]>> = {
  example: [-0.95, -0.7],
  "agent-docs": [0.95, -0.7],
};
const PARK_FREE = [
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
export function propSpot(
  slot: SlotId,
  optionId: string,
  index: number,
  placements: Placements,
): [x: number, z: number] {
  if (slot === "extras" && Object.hasOwn(EXTRA_SPOTS, optionId)) {
    const [x, z] = EXTRA_SPOTS[optionId]!;
    return [x, z];
  }
  const [bx, bz] = spotFor(slot, placements);
  const [dx, dz] =
    slot !== "extras"
      ? CORNERS[index % CORNERS.length]!
      : Object.hasOwn(PARK_SPOTS, optionId)
        ? PARK_SPOTS[optionId]!
        : PARK_FREE[index % PARK_FREE.length]!;
  return [bx + dx, bz + dz];
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

/** Where the crane waits for the next answer: by the entrance until the name is placed;
 * then on the next free block while a building or props slot is unsettled; then on the
 * fountain's square for the paint; null once every slot is settled. A slot settled as "not
 * needed" counts as settled, so the crane never waits for a building nobody will put up. */
export function nextLot(state: TownState): Point | null {
  const { placements } = state;
  const open = (kinds: SlotDef["kind"][]) =>
    SLOTS.some((slot) => kinds.includes(slot.kind) && placements[slot.id] === undefined);
  if (open(["sign"])) return NAME_SPOT;
  if (open(["building", "props"])) {
    const cell = nextBlock(placements);
    return cell ? blockCentre(cell) : null;
  }
  return open(["paint"]) ? FOUNTAIN_SPOT : null;
}

/** Which card the billboard shows. The plan comes before any question, and a question
 * before the report (one asked after it would otherwise never be seen); the plan and
 * report cards come with the build progress. */
export type BillboardCard = "question" | "plan" | "report";

export function billboardCard(state: TownState): BillboardCard | null {
  if (!state.agentStopped) {
    if (isPlanWaiting(state)) return "plan";
    if (state.pending) return "question";
  }
  // The report stays up after the user quits the agent.
  if (state.phase === "done" && state.report) return "report";
  return null;
}

/** What the billboard says once the finale is over. */
export const READY_MESSAGE = "Your project is ready. You can close this tab.";

/** How long the finale lasts, in seconds. */
export const FINALE_SECONDS = 5;

/** The finale: fireworks over the lit town at night, confetti and balloons by day, or no
 * motion at all when the user asked for less. */
export type FinaleKind = "night" | "day" | "still";

export function finaleKind(night: number, reducedMotion: boolean): FinaleKind {
  if (reducedMotion) return "still";
  return night >= 0.5 ? "night" : "day";
}

/** How bright a light at `distance` from the town's centre is, `t` seconds into the night
 * finale, as a multiple of its usual night glow: the town dims, then the lights come on from
 * the centre outward with a brief flare, and stay a little brighter. */
export const LIT_LEVEL = 1.35;

export function lightsUpLevel(distance: number, t: number): number {
  if (t < 0) return 1;
  if (t >= FINALE_SECONDS) return LIT_LEVEL;
  const reach = 0.45 + distance * 0.1;
  if (t < reach) {
    const u = Math.min(t / 0.35, 1);
    return 1 - 0.85 * u * u * (3 - 2 * u);
  }
  // Blends into the settled level well before the end, so nothing jumps.
  return LIT_LEVEL + 1.2 * Math.exp(-(t - reach) / 0.35);
}

/** How far outside its lot's square the crane's mast stands. */
const CRANE_GAP = 0.25;
/** From the crane's mast to the middle of its lot: the trolley's reach. */
export const CRANE_REACH = LOT_SIZE / 2 + CRANE_GAP;

/** Where the thinking crane stands for the lot at `at`: its mast on the lot's back side,
 * between the lot and the street behind it, turned by `yaw` round y so its jib (local +x)
 * reaches out over the lot towards the camera, `reach` to the lot's centre. */
export function craneSpot([lx, lz]: Point): { x: number; z: number; yaw: number; reach: number } {
  return { x: lx, z: lz - CRANE_REACH, yaw: -Math.PI / 2, reach: CRANE_REACH };
}
