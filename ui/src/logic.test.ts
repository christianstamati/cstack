import { expect, test } from "vite-plus/test";

import { SLOTS, type SlotId } from "../../src/town/catalog.ts";
import type { Placement, Question, TownState } from "../../src/town/protocol.ts";
import {
  answerOutcome,
  BASE_COLORS,
  billboardCard,
  craneSpot,
  decorSpots,
  DEFAULT_THEME,
  dropPose,
  EXTRA_SPOTS,
  hoverText,
  isPlanWaiting,
  isThinking,
  LOT_SIZE,
  FOUNTAIN_SPOT,
  NAME_SPOT,
  spotFor,
  modelKindFor,
  nextLot,
  projectNameFrom,
  propSpot,
  readMuted,
  reconnectDelay,
  showTerminalSign,
  TERMINAL_SIGN_AFTER_MS,
  THEME_COLORS,
  themeFor,
  tokenFrom,
  uiSettings,
  writeMuted,
} from "./logic.ts";
import {
  assignBlocks,
  blockCentre,
  ENTRANCE,
  GRID,
  nearStreet,
  SLAB,
  SPIRAL,
  type Point,
} from "./streets.ts";

function uiPlacement(settings: Record<string, string>): Placement {
  return {
    slot: "ui",
    optionIds: Object.entries(settings).map(([key, value]) => `${key}:${value}`),
    labels: Object.values(settings),
    auto: true,
    seq: 0,
  };
}

function placement(
  slot: SlotId,
  optionIds: string[],
  labels: string[],
  auto = false,
  seq = 0,
): Placement {
  return { slot, optionIds, labels, auto, seq };
}

/** Every slot placed with its first option, in the interview's order. */
function everything(): TownState["placements"] {
  const placements: TownState["placements"] = {};
  SLOTS.forEach((slot, seq) => {
    const option = slot.options[0];
    placements[slot.id] = placement(slot.id, option ? [option.id] : [], ["x"], false, seq);
  });
  return placements;
}

test("a slot stands on its block, the next free one before it's placed", () => {
  const placements = everything();
  for (const [slot, cell] of Object.entries(assignBlocks(placements)))
    expect(spotFor(slot as SlotId, placements)).toEqual(blockCentre(cell));
  // Before it's placed, a building would go on the next free block.
  const early = { structure: placement("structure", ["single"], ["Single"], false, 0) };
  expect(spotFor("structure", early)).toEqual(blockCentre(SPIRAL[0]!));
  expect(spotFor("frontend", early)).toEqual(blockCentre(SPIRAL[1]!));
  expect(spotFor("frontend", {})).toEqual(blockCentre(SPIRAL[0]!));
});

test("the name sign stands by the entrance; the paint fountain beside it, off the grid", () => {
  expect(spotFor("name", {})).toEqual(NAME_SPOT);
  expect(spotFor("ui", everything())).toEqual(FOUNTAIN_SPOT);
  expect(Math.hypot(NAME_SPOT[0] - ENTRANCE[0], NAME_SPOT[1] - ENTRANCE[1])).toBeLessThan(5);
  for (const [x, z] of [NAME_SPOT, FOUNTAIN_SPOT]) {
    expect(nearStreet(x, z, 0.9)).toBe(false);
    expect(inGrid(x, z, 0.5)).toBe(false);
    expect(z).toBeLessThan(SLAB.maxZ - 1.3);
  }
  expect(
    Math.hypot(NAME_SPOT[0] - FOUNTAIN_SPOT[0], NAME_SPOT[1] - FOUNTAIN_SPOT[1]),
  ).toBeGreaterThan(3.5);
});

test("the token comes from the query string", () => {
  expect(tokenFrom("?token=abc")).toBe("abc");
  expect(tokenFrom("?x=1&token=abc")).toBe("abc");
  expect(tokenFrom("")).toBeNull();
});

test("reconnect delay backs off and is capped", () => {
  expect(reconnectDelay(0)).toBe(500);
  expect(reconnectDelay(1)).toBe(1000);
  expect(reconnectDelay(2)).toBe(2000);
  expect(reconnectDelay(10)).toBe(5000);
});

test("answer responses map to outcomes", () => {
  expect(answerOutcome(204)).toBe("ok");
  expect(answerOutcome(409)).toBe("stale");
  expect(answerOutcome(400)).toBe("invalid");
  expect(answerOutcome(401)).toBe("invalid");
});

test("mute state round-trips through storage and survives a broken one", () => {
  const data = new Map<string, string>();
  const storage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
  expect(readMuted(storage)).toBe(false);
  writeMuted(storage, true);
  expect(readMuted(storage)).toBe(true);
  writeMuted(storage, false);
  expect(readMuted(storage)).toBe(false);

  const broken = {
    getItem: (): string | null => {
      throw new Error("denied");
    },
    setItem: () => {
      throw new Error("denied");
    },
  };
  expect(readMuted(broken)).toBe(false);
  expect(() => writeMuted(broken, true)).not.toThrow();
  expect(readMuted(undefined)).toBe(false);
});

/** Is (x, z) on any block of the grid (with `margin` round it), where buildings may go? */
function inGrid(x: number, z: number, margin = 0): boolean {
  return SPIRAL.some((cell) => {
    const [cx, cz] = blockCentre(cell);
    return Math.max(Math.abs(x - cx), Math.abs(z - cz)) < GRID.block / 2 + margin;
  });
}

/** How far a tree's crown reaches, at its largest. */
const CROWN = 0.75;

test("trees and rocks stay in the green belt, clear of the sign, fountain, plots and props", () => {
  const spots = decorSpots();
  expect(spots.length).toBeGreaterThan(20);
  const belt = [EXTRA_SPOTS.ci!, EXTRA_SPOTS.tests!, EXTRA_SPOTS.env!];
  for (const spot of spots) {
    expect(spot.x).toBeGreaterThan(SLAB.minX + 0.5);
    expect(spot.x).toBeLessThan(SLAB.maxX - 0.5);
    expect(spot.z).toBeGreaterThan(SLAB.minZ + 0.5);
    expect(spot.z).toBeLessThan(SLAB.maxZ - 0.5);
    // Never where a block (and its crane and plot) could go, nor on a street.
    expect(inGrid(spot.x, spot.z, 0.3)).toBe(false);
    expect(nearStreet(spot.x, spot.z, 0.3)).toBe(false);
    // Off the sign's and the fountain's plots (where the crane works too).
    for (const [x, z] of [NAME_SPOT, FOUNTAIN_SPOT]) {
      const off = Math.max(Math.abs(spot.x - x), Math.abs(spot.z - z));
      expect(off).toBeGreaterThan(LOT_SIZE / 2 + CROWN);
      const mast = craneSpot([x, z]);
      expect(Math.hypot(spot.x - mast.x, spot.z - mast.z)).toBeGreaterThan(CROWN + 0.4);
    }
    for (const [x, z] of belt) expect(Math.hypot(spot.x - x, spot.z - z)).toBeGreaterThan(1.8);
  }
  expect(decorSpots()).toEqual(spots);
});

test("a green belt of trees grows round the edge of the slab", () => {
  const trees = decorSpots().filter((spot) => spot.kind === "tree");
  expect(trees.length).toBeGreaterThanOrEqual(30);
  expect(trees.some((t) => t.x < SLAB.minX + GRID.belt)).toBe(true);
  expect(trees.some((t) => t.x > SLAB.maxX - GRID.belt)).toBe(true);
  expect(trees.some((t) => t.z < SLAB.minZ + GRID.belt)).toBe(true);
  expect(trees.some((t) => t.z > SLAB.maxZ - GRID.belt)).toBe(true);
});

test("each placement maps to the right kind of model", () => {
  const slot = (id: SlotId) => SLOTS.find((s) => s.id === id)!;
  expect(modelKindFor(slot("deploy"), placement("deploy", ["vercel"], ["Vercel"]))).toBe(
    "building",
  );
  expect(modelKindFor(slot("deploy"), placement("deploy", ["fly"], ["Fly.io"]))).toBe("generic");
  expect(modelKindFor(slot("api"), placement("api", [], ["Not needed"], true))).toBe("notNeeded");
  expect(modelKindFor(slot("extras"), placement("extras", [], ["Not needed"], true))).toBe(
    "notNeeded",
  );
  expect(modelKindFor(slot("extras"), placement("extras", ["ci"], ["CI"]))).toBe("props");
  expect(modelKindFor(slot("ui"), placement("ui", ["theme:blue"], ["Blue"], true))).toBe("paint");
  expect(modelKindFor(slot("ui"), placement("ui", [], ["Not needed"], true))).toBe("notNeeded");
  // The name is free text: no option ids, but never "not needed".
  expect(modelKindFor(slot("name"), placement("name", [], ["shop"]))).toBe("sign");
});

test("theme defaults and follows the styling answer", () => {
  expect(themeFor(undefined)).toEqual(DEFAULT_THEME);
  const zinc = themeFor(uiPlacement({ baseColor: "zinc", theme: "blue", radius: "0" }));
  expect(zinc).toEqual({ base: BASE_COLORS.zinc, accent: THEME_COLORS.blue, roundness: 0 });
});

test("radius becomes roundness, in rem or by name, capped at 1", () => {
  const roundness = (radius: string) => themeFor(uiPlacement({ radius })).roundness;
  expect(roundness("0.5")).toBe(0.5);
  expect(roundness("0.75rem")).toBe(0.75);
  expect(roundness("1.5")).toBe(1);
  expect(roundness("none")).toBe(0);
  expect(roundness("large")).toBe(1);
  expect(roundness("Small")).toBe(0.3);
});

test("unknown styling values fall back to the defaults, never break", () => {
  expect(
    themeFor(uiPlacement({ baseColor: "plaid", theme: "nope", radius: "-2", style: "x" })),
  ).toEqual(DEFAULT_THEME);
  expect(themeFor(uiPlacement({ radius: "wide" }))).toEqual(DEFAULT_THEME);
  expect(themeFor(placement("ui", [], ["Not needed"], true))).toEqual(DEFAULT_THEME);
  expect(themeFor(placement("ui", ["zinc", ":", "theme:", ""], []))).toEqual(DEFAULT_THEME);
  // Only the base colour given: the rest stays default.
  expect(themeFor(uiPlacement({ baseColor: "stone" }))).toEqual({
    ...DEFAULT_THEME,
    base: BASE_COLORS.stone,
  });
});

test("styling keys and values are read loosely", () => {
  expect(uiSettings(placement("ui", ["Base-Color:Zinc", "THEME:Rose", "font:inter"], []))).toEqual({
    baseColor: "zinc",
    theme: "rose",
    font: "inter",
  });
  expect(themeFor(uiPlacement({ theme: "#FF8800" })).accent).toBe("#ff8800");
});

test("a drop falls, bounces once and settles", () => {
  expect(dropPose(0).y).toBe(1);
  expect(dropPose(1)).toEqual({ y: 0, squashY: 1, squashXZ: 1 });
  expect(dropPose(2)).toEqual(dropPose(1));
  const ys = Array.from({ length: 201 }, (_, i) => dropPose(i / 200).y);
  for (const y of ys) expect(y).toBeGreaterThanOrEqual(0);
  let turns = 0;
  for (let i = 2; i < ys.length; i++) {
    const before = Math.sign(ys[i - 1]! - ys[i - 2]!);
    const after = Math.sign(ys[i]! - ys[i - 1]!);
    if (before > 0 && after < 0) turns++;
  }
  expect(turns).toBe(1);
  // It squashes when it lands.
  expect(
    Math.min(...Array.from({ length: 201 }, (_, i) => dropPose(i / 200).squashY)),
  ).toBeLessThan(0.9);
});

test("props stand on their own block or in the belt, off the streets and clear of each other", () => {
  const placements = everything();
  placements.extras = placement(
    "extras",
    ["example", "ci", "env", "tests", "agent-docs", "storybook", "playwright"],
    [],
    false,
    13,
  );
  placements.authMethods = placement(
    "authMethods",
    ["google", "github", "password", "magic-link"],
    [],
    false,
    11,
  );
  const blocks = assignBlocks(placements);
  const spots: Point[] = [];
  for (const slot of ["extras", "authMethods"] as const) {
    const [cx, cz] = blockCentre(blocks[slot]!);
    placements[slot]!.optionIds.forEach((id, index) => {
      const [x, z] = propSpot(slot, id, index, placements);
      spots.push([x, z]);
      expect(x).toBeGreaterThan(SLAB.minX + 1);
      expect(x).toBeLessThan(SLAB.maxX - 1);
      expect(z).toBeGreaterThan(SLAB.minZ + 1);
      expect(z).toBeLessThan(SLAB.maxZ - 1);
      expect(nearStreet(x, z, 0.6), `${slot}:${id}`).toBe(false);
      const onOwn = Math.max(Math.abs(x - cx), Math.abs(z - cz)) < GRID.block / 2 - 0.3;
      expect(onOwn || !inGrid(x, z, 0.3), `${slot}:${id}`).toBe(true);
    });
  }
  for (let i = 0; i < spots.length; i++)
    for (let j = i + 1; j < spots.length; j++)
      expect(Math.hypot(spots[i]![0] - spots[j]![0], spots[i]![1] - spots[j]![1])).toBeGreaterThan(
        0.9,
      );
});

test("the entrance sign shows the typed name, else the folder's", () => {
  expect(projectNameFrom(undefined, "my-app")).toBe("my-app");
  expect(projectNameFrom(placement("name", [], ["shop"]), "my-app")).toBe("shop");
  expect(projectNameFrom(placement("name", ["keep"], ["my-app", "renamed"]), "x")).toBe("renamed");
  expect(projectNameFrom(placement("name", [], ["  "]), "my-app")).toBe("my-app");
});

test("hover text names the slot, the choice and why it was automatic", () => {
  expect(hoverText(placement("deploy", ["vercel"], ["Vercel"]))).toEqual({
    title: "Deployment: Vercel",
    detail: null,
  });
  expect(
    hoverText({ ...placement("api", [], ["Not needed"], true), reason: "Convex has its own" }),
  ).toEqual({ title: "API layer: Not needed", detail: "Convex has its own" });
  expect(hoverText({ ...placement("data", ["convex"], ["Convex"], true) })).toEqual({
    title: "Backend / data: Convex",
    detail: "Picked automatically",
  });
});

function stateAt(overrides: Partial<TownState> = {}): TownState {
  return {
    projectName: "my-app",
    phase: "interview",
    placements: {},
    pending: null,
    plan: null,
    steps: [],
    report: null,
    status: null,
    lastAgentActivity: 0,
    agentStopped: false,
    ...overrides,
  };
}

function question(overrides: Partial<Question> = {}): Question {
  return {
    id: "q1",
    slot: "frontend",
    question: "Which frontend?",
    options: [{ id: "nextjs", label: "Next.js" }],
    multiSelect: false,
    freeText: false,
    ...overrides,
  };
}

const PLAN = { rows: [], tree: "", generators: [], manualSteps: [] };

test("terminal sign after 30 s of agent silence", () => {
  expect(TERMINAL_SIGN_AFTER_MS).toBe(30_000);
  expect(showTerminalSign(stateAt({ lastAgentActivity: 0 }), 30_001)).toBe(true);
  expect(showTerminalSign(stateAt({ lastAgentActivity: 0 }), 29_000)).toBe(false);
  expect(showTerminalSign(stateAt({ lastAgentActivity: 0 }), 30_000)).toBe(false);
  expect(showTerminalSign(stateAt({ lastAgentActivity: 0, pending: question() }), 99_999)).toBe(
    false,
  );
});

test("no terminal sign while the plan waits, after the end, or once the agent stopped", () => {
  expect(showTerminalSign(stateAt({ phase: "plan", plan: PLAN }), 99_999)).toBe(false);
  expect(showTerminalSign(stateAt({ phase: "done" }), 99_999)).toBe(false);
  expect(showTerminalSign(stateAt({ agentStopped: true }), 99_999)).toBe(false);
  // A long build step with no news: the agent may be waiting on a permission prompt.
  expect(showTerminalSign(stateAt({ phase: "build", plan: PLAN }), 99_999)).toBe(true);
  expect(showTerminalSign(stateAt({ lastAgentActivity: 50_000 }), 60_000)).toBe(false);
});

test("the plan waits only in the plan phase with a plan set", () => {
  expect(isPlanWaiting(stateAt({ phase: "plan", plan: PLAN }))).toBe(true);
  expect(isPlanWaiting(stateAt({ phase: "plan" }))).toBe(false);
  expect(isPlanWaiting(stateAt({ phase: "build", plan: PLAN }))).toBe(false);
});

test("thinking only between questions in the interview", () => {
  expect(isThinking(stateAt())).toBe(true);
  expect(isThinking(stateAt({ pending: question() }))).toBe(false);
  expect(isThinking(stateAt({ phase: "plan", plan: PLAN }))).toBe(false);
  expect(isThinking(stateAt({ phase: "build" }))).toBe(false);
  expect(isThinking(stateAt({ phase: "done" }))).toBe(false);
  expect(isThinking(stateAt({ agentStopped: true }))).toBe(false);
});

test("the crane waits by the entrance for the name, then on the next free block", () => {
  expect(nextLot(stateAt())).toEqual(NAME_SPOT);
  const placements: TownState["placements"] = { name: placement("name", [], ["shop"], false, 0) };
  expect(nextLot(stateAt({ placements }))).toEqual(blockCentre(SPIRAL[0]!));
  placements.structure = placement("structure", ["single"], ["Single"], false, 1);
  // Not needed: no block taken, the crane stays put.
  placements.api = placement("api", [], ["Not needed"], true, 2);
  expect(nextLot(stateAt({ placements }))).toEqual(blockCentre(SPIRAL[1]!));
});

test("with every building settled the crane goes to the fountain, then away", () => {
  const placements: TownState["placements"] = {};
  SLOTS.forEach((slot, seq) => {
    if (slot.id !== "ui") placements[slot.id] = placement(slot.id, [], ["Not needed"], true, seq);
  });
  placements.name = placement("name", [], ["shop"], false, 0);
  expect(nextLot(stateAt({ placements }))).toEqual(FOUNTAIN_SPOT);
  placements.ui = placement("ui", ["theme:blue"], ["Blue"], true, 99);
  expect(nextLot(stateAt({ placements }))).toBeNull();
});

test("the billboard shows the plan over a question, the question otherwise", () => {
  expect(billboardCard(stateAt())).toBeNull();
  expect(billboardCard(stateAt({ pending: question() }))).toBe("question");
  expect(billboardCard(stateAt({ pending: question({ slot: null }) }))).toBe("question");
  expect(billboardCard(stateAt({ phase: "plan", plan: PLAN, pending: question() }))).toBe("plan");
  expect(billboardCard(stateAt({ agentStopped: true, pending: question() }))).toBeNull();
  const report = { built: [], commands: [], manualSteps: [], unverified: [] };
  expect(billboardCard(stateAt({ phase: "done", report }))).toBe("report");
  expect(billboardCard(stateAt({ phase: "done", report, agentStopped: true }))).toBe("report");
});

test("the crane stands on the back of its block, off the lot, its hook over the lot", () => {
  const hookOver = ([lx, lz]: Point) => {
    const { x, z, yaw, reach } = craneSpot([lx, lz]);
    // The jib points along local +x, turned by `yaw` round y: its hook hangs over the lot.
    expect(x + Math.cos(yaw) * reach).toBeCloseTo(lx);
    expect(z - Math.sin(yaw) * reach).toBeCloseTo(lz);
    expect(Math.max(Math.abs(x - lx), Math.abs(z - lz))).toBeGreaterThan(LOT_SIZE / 2 + 0.2);
    return { x, z };
  };
  for (const cell of SPIRAL) {
    const [cx, cz] = blockCentre(cell);
    const { x, z } = hookOver([cx, cz]);
    // Its mast stands inside the block, between the lot and the street, not on it.
    expect(Math.max(Math.abs(x - cx), Math.abs(z - cz))).toBeLessThan(GRID.block / 2 - 0.25);
    expect(nearStreet(x, z, 0.25)).toBe(false);
  }
  for (const spot of [NAME_SPOT, FOUNTAIN_SPOT]) {
    const { x, z } = hookOver(spot);
    expect(inGrid(x, z, -0.2)).toBe(false);
  }
});
