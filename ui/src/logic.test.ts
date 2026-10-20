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
  freeCells,
  hoverText,
  isPlanWaiting,
  isThinking,
  LOT_SIZE,
  lotPosition,
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
import { blockCentre, blockOf, ENTRANCE, GRID, nearStreet, SLAB } from "./streets.ts";

function uiPlacement(settings: Record<string, string>): Placement {
  return {
    slot: "ui",
    optionIds: Object.entries(settings).map(([key, value]) => `${key}:${value}`),
    labels: Object.values(settings),
    auto: true,
  };
}

function placement(slot: SlotId, optionIds: string[], labels: string[], auto = false): Placement {
  return { slot, optionIds, labels, auto };
}

test("every slot has a lot", () => {
  for (const slot of SLOTS) expect(lotPosition(slot.id)).toHaveLength(3);
});

test("a block's lot is the middle of its block", () => {
  for (const slot of SLOTS) {
    if (!slot.block) continue;
    const [x, y, z] = lotPosition(slot.id);
    expect([x, z]).toEqual(blockCentre(slot.block));
    expect(y).toBe(0);
  }
});

test("the name sign stands by the entrance; the paint fountain on a free square", () => {
  const [nx, , nz] = lotPosition("name");
  expect(Math.hypot(nx - ENTRANCE[0], nz - ENTRANCE[1])).toBeLessThan(5);
  expect(nearStreet(nx, nz, 0.9)).toBe(false);
  const [ux, , uz] = lotPosition("ui");
  expect(
    freeCells().some((cell) => {
      const [cx, cz] = blockCentre(cell);
      return cx === ux && cz === uz;
    }),
  ).toBe(true);
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

/** Is (x, z) inside the block of a slot (with `margin` around it)? */
function inSlotBlock(x: number, z: number, margin = 0): boolean {
  return SLOTS.some((slot) => {
    if (!slot.block) return false;
    const [cx, cz] = blockCentre(slot.block);
    return Math.max(Math.abs(x - cx), Math.abs(z - cz)) < GRID.block / 2 + margin;
  });
}

test("trees and rocks stay on the slab, off every block, street, sign and prop", () => {
  const spots = decorSpots();
  expect(spots.length).toBeGreaterThan(20);
  const [nx, , nz] = lotPosition("name");
  const [ux, , uz] = lotPosition("ui");
  for (const spot of spots) {
    expect(spot.x).toBeGreaterThan(SLAB.minX + 0.5);
    expect(spot.x).toBeLessThan(SLAB.maxX - 0.5);
    expect(spot.z).toBeGreaterThan(SLAB.minZ + 0.5);
    expect(spot.z).toBeLessThan(SLAB.maxZ - 0.5);
    expect(inSlotBlock(spot.x, spot.z, 0.3)).toBe(false);
    expect(nearStreet(spot.x, spot.z, 0.3)).toBe(false);
    expect(Math.hypot(spot.x - nx, spot.z - nz)).toBeGreaterThan(2.4);
    expect(Math.hypot(spot.x - ux, spot.z - uz)).toBeGreaterThan(1.9);
  }
  expect(decorSpots()).toEqual(spots);
});

test("a green belt of trees grows round the edge of the slab", () => {
  const trees = decorSpots().filter((spot) => spot.kind === "tree");
  const belt = trees.filter(
    (t) =>
      t.x < SLAB.minX + GRID.belt ||
      t.x > SLAB.maxX - GRID.belt ||
      t.z < SLAB.minZ + GRID.belt ||
      t.z > SLAB.maxZ - GRID.belt,
  );
  expect(belt.length).toBeGreaterThanOrEqual(24);
  // On all four sides.
  expect(belt.some((t) => t.x < SLAB.minX + GRID.belt)).toBe(true);
  expect(belt.some((t) => t.x > SLAB.maxX - GRID.belt)).toBe(true);
  expect(belt.some((t) => t.z < SLAB.minZ + GRID.belt)).toBe(true);
  expect(belt.some((t) => t.z > SLAB.maxZ - GRID.belt)).toBe(true);
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

test("props stand on the slab, off the streets, clear of each other and of other blocks", () => {
  const extras = SLOTS.find((s) => s.id === "extras")!;
  const methods = SLOTS.find((s) => s.id === "authMethods")!;
  const spots = [
    ...extras.options.map((o, i) => propSpot("extras", o.id, i)),
    ...methods.options.map((o, i) => propSpot("authMethods", o.id, i)),
    propSpot("extras", "storybook", 5),
    propSpot("extras", "playwright", 6),
  ];
  for (const [x, z] of spots) {
    expect(x).toBeGreaterThan(SLAB.minX + 1);
    expect(x).toBeLessThan(SLAB.maxX - 1);
    expect(z).toBeGreaterThan(SLAB.minZ + 1);
    expect(z).toBeLessThan(SLAB.maxZ - 1);
    expect(nearStreet(x, z, 0.6)).toBe(false);
  }
  for (let i = 0; i < spots.length; i++)
    for (let j = i + 1; j < spots.length; j++)
      expect(Math.hypot(spots[i]![0] - spots[j]![0], spots[i]![1] - spots[j]![1])).toBeGreaterThan(
        0.9,
      );
  // Props stand on their own slot's block, or off every block.
  const own = (slot: "extras" | "authMethods") => blockCentre(blockOf(slot)!);
  for (const [slot, list] of [
    ["extras", extras.options],
    ["authMethods", methods.options],
  ] as const) {
    list.forEach((option, index) => {
      const [x, z] = propSpot(slot, option.id, index);
      const [cx, cz] = own(slot);
      const onOwn = Math.max(Math.abs(x - cx), Math.abs(z - cz)) < GRID.block / 2;
      expect(onOwn || !inSlotBlock(x, z, 0.3), `${slot}:${option.id}`).toBe(true);
    });
  }
});

test("trees keep clear of the props too", () => {
  const extras = SLOTS.find((s) => s.id === "extras")!;
  for (const spot of decorSpots())
    for (const option of extras.options) {
      const [x, z] = propSpot("extras", option.id, 0);
      expect(Math.hypot(spot.x - x, spot.z - z)).toBeGreaterThan(1.8);
    }
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

test("nextLot skips placed slots", () => {
  expect(nextLot(stateAt())).toBe(SLOTS[0]!.id);
  const [first, second, third] = SLOTS;
  const placements: TownState["placements"] = {
    [first!.id]: placement(first!.id, [], ["shop"]),
    [second!.id]: placement(second!.id, [second!.options[0]!.id], ["x"]),
  };
  expect(nextLot(stateAt({ placements }))).toBe(third!.id);
});

test("nextLot skips slots settled as not needed, and is null when every slot is settled", () => {
  const placements: TownState["placements"] = {};
  for (const slot of SLOTS)
    if (slot.id !== "extras") placements[slot.id] = placement(slot.id, [], ["Not needed"], true);
  expect(nextLot(stateAt({ placements }))).toBe("extras");
  placements.extras = placement("extras", [], ["Not needed"], true);
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

test("the crane stands on the street side of its block, off the lot, its hook over the lot", () => {
  for (const slot of SLOTS) {
    const { x, z, yaw, reach } = craneSpot(slot.id);
    // Never on anybody's lot.
    for (const other of SLOTS) {
      const [lx, , lz] = lotPosition(other.id);
      const outside = Math.max(Math.abs(x - lx), Math.abs(z - lz)) > LOT_SIZE / 2 + 0.2;
      expect(outside, `${slot.id}'s crane on ${other.id}'s lot`).toBe(true);
    }
    // The jib points along local +x, turned by `yaw` round y: its hook hangs over the lot.
    const [lx, , lz] = lotPosition(slot.id);
    expect(x + Math.cos(yaw) * reach).toBeCloseTo(lx);
    expect(z - Math.sin(yaw) * reach).toBeCloseTo(lz);
    if (!slot.block) continue;
    // Its mast stands inside its own block, between the lot and the street, not on it.
    const [cx, cz] = blockCentre(slot.block);
    expect(Math.max(Math.abs(x - cx), Math.abs(z - cz))).toBeLessThan(GRID.block / 2 - 0.25);
    expect(nearStreet(x, z, 0.25)).toBe(false);
  }
});
