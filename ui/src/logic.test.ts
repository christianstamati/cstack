import { expect, test } from "vite-plus/test";

import { SLOTS, type SlotId } from "../../src/town/catalog.ts";
import type { Placement } from "../../src/town/protocol.ts";
import {
  answerOutcome,
  BASE_COLORS,
  decorSpots,
  DEFAULT_THEME,
  dropPose,
  hoverText,
  LOT_SIZE,
  ISLAND_RADIUS,
  lotPosition,
  modelKindFor,
  projectNameFrom,
  propSpot,
  readMuted,
  reconnectDelay,
  THEME_COLORS,
  themeFor,
  tokenFrom,
  uiSettings,
  writeMuted,
} from "./logic.ts";

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

test("every slot has a lot on the island", () => {
  for (const slot of SLOTS) expect(lotPosition(slot.id)).toHaveLength(3);
});

test("lots sit on the island top, inside its edge", () => {
  for (const slot of SLOTS) {
    const [x, y, z] = lotPosition(slot.id);
    expect([x, z]).toEqual([...slot.lot]);
    expect(y).toBe(0);
    expect(Math.hypot(x, z)).toBeLessThan(ISLAND_RADIUS - 1);
  }
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

test("trees and rocks keep clear of every lot and stay on the island", () => {
  const spots = decorSpots();
  expect(spots.length).toBeGreaterThan(5);
  for (const spot of spots) {
    expect(Math.hypot(spot.x, spot.z)).toBeLessThan(ISLAND_RADIUS - 0.7);
    for (const slot of SLOTS) {
      const [x, , z] = lotPosition(slot.id);
      expect(Math.hypot(spot.x - x, spot.z - z)).toBeGreaterThan(LOT_SIZE);
    }
  }
  expect(decorSpots()).toEqual(spots);
});

test("trees grow around the edge, not between the lots; the edge stays lush", () => {
  const trees = decorSpots().filter((spot) => spot.kind === "tree");
  expect(trees.length).toBeGreaterThanOrEqual(14);
  for (const tree of trees) {
    expect(Math.hypot(tree.x, tree.z)).toBeGreaterThan(11.5);
    for (const slot of SLOTS) {
      const [x, , z] = lotPosition(slot.id);
      expect(Math.hypot(tree.x - x, tree.z - z)).toBeGreaterThan(3.1);
    }
  }
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

test("props stand on the island, clear of every lot and of each other", () => {
  const extras = SLOTS.find((s) => s.id === "extras")!;
  const methods = SLOTS.find((s) => s.id === "authMethods")!;
  const spots = [
    ...extras.options.map((o, i) => propSpot("extras", o.id, i)),
    ...methods.options.map((o, i) => propSpot("authMethods", o.id, i)),
    propSpot("extras", "storybook", 5),
  ];
  for (const [x, z] of spots) expect(Math.hypot(x, z)).toBeLessThan(ISLAND_RADIUS - 1);
  for (let i = 0; i < spots.length; i++)
    for (let j = i + 1; j < spots.length; j++)
      expect(Math.hypot(spots[i]![0] - spots[j]![0], spots[i]![1] - spots[j]![1])).toBeGreaterThan(
        0.9,
      );
  // Extras away from their own lot stay clear of every building lot.
  for (const option of extras.options.filter((o) => o.id !== "example")) {
    const [x, z] = propSpot("extras", option.id, 0);
    for (const slot of SLOTS) {
      const [lx, , lz] = lotPosition(slot.id);
      expect(Math.hypot(x - lx, z - lz)).toBeGreaterThan(LOT_SIZE);
    }
  }
});

test("trees keep clear of the props too", () => {
  const extras = SLOTS.find((s) => s.id === "extras")!;
  for (const spot of decorSpots())
    for (const option of extras.options) {
      const [x, z] = propSpot("extras", option.id, 0);
      expect(Math.hypot(spot.x - x, spot.z - z)).toBeGreaterThan(2);
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
