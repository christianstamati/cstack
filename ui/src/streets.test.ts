import { expect, test } from "vite-plus/test";

import { SLOTS, type SlotId } from "../../src/town/catalog.ts";
import type { Placement } from "../../src/town/protocol.ts";
import { TownStore } from "../../src/town/store.ts";
import {
  assignBlocks,
  blockCentre,
  builtStreets,
  carCount,
  crossings,
  ENTRANCE,
  GRID,
  kerbOf,
  nextBlock,
  onStreetLine,
  pavingOrder,
  PITCH,
  segmentKey,
  SPIRAL,
  streetRoute,
  trailLanes,
  type Cell,
  type Point,
  type Segment,
} from "./streets.ts";

type Placements = Partial<Record<SlotId, Placement>>;

/** A town where the agent decided these slots in this order, each with its first option
 * (the ones in `skip` as "not needed"). Built by the real store, so seq and lot are its. */
function town(slots: SlotId[], skip: SlotId[] = []): TownStore {
  const store = new TownStore("t");
  for (const id of slots) decide(store, id, skip.includes(id));
  return store;
}

function decide(store: TownStore, id: SlotId, notNeeded = false, option = 0): void {
  const slot = SLOTS.find((s) => s.id === id)!;
  const chosen = slot.options[option];
  const optionIds = notNeeded || !chosen ? [] : [chosen.id];
  store.decide({ slot: id, optionIds, labels: [chosen?.label ?? "shop"], reason: "x" });
}

const placed = (...slots: SlotId[]): Placements => town(slots).getState().placements;

/** Every slot, in the interview's order. */
const ALL = placed(...SLOTS.map((slot) => slot.id));
const LOT_SLOTS = SLOTS.filter((s) => s.kind === "building" || s.kind === "props").map((s) => s.id);

const keys = (segments: Segment[]) => new Set(segments.map(segmentKey));
const same = (a: Point, b: Point) => Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9;
const ring = ([c, r]: Cell) => Math.max(Math.abs(c), Math.abs(r));
const length = (route: Point[]) =>
  route
    .slice(1)
    .reduce((sum, p, i) => sum + Math.abs(p[0] - route[i]![0]) + Math.abs(p[1] - route[i]![1]), 0);

/** Is (x, z) within the band of a street (kerb to kerb)? Streets run between the blocks. */
function onStreet(x: number, z: number): boolean {
  const distance = (v: number) => {
    const t = v / PITCH - 0.5;
    return Math.abs(t - Math.round(t)) * PITCH;
  };
  return distance(x) < GRID.street / 2 || distance(z) < GRID.street / 2;
}

/** Every half-block piece of a route is in `built`. */
function onBuilt(route: Point[], built: Set<string>): boolean {
  for (let i = 1; i < route.length; i++) {
    const [p, q] = [route[i - 1]!, route[i]!];
    const steps = Math.round((Math.abs(q[0] - p[0]) + Math.abs(q[1] - p[1])) / (PITCH / 2));
    for (let s = 0; s < steps; s++) {
      const at = (t: number): Point => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
      if (!built.has(segmentKey({ a: at(s / steps), b: at((s + 1) / steps) }))) return false;
    }
  }
  return true;
}

test("the spiral starts in the middle and covers the grid ring by ring", () => {
  expect(SPIRAL[0]).toEqual([0, 0]);
  const cells = new Set(SPIRAL.map((cell) => cell.join(",")));
  const size = GRID.max - GRID.min + 1;
  expect(cells.size).toBe(SPIRAL.length);
  expect(SPIRAL.length).toBe(size * size);
  // Room for every slot that can take a block.
  expect(SPIRAL.length).toBeGreaterThanOrEqual(LOT_SLOTS.length);
  for (let i = 1; i < SPIRAL.length; i++)
    expect(ring(SPIRAL[i]!)).toBeGreaterThanOrEqual(ring(SPIRAL[i - 1]!));
  for (const cell of SPIRAL) {
    const [x, z] = blockCentre(cell);
    const half = GRID.lot / 2;
    for (const [dx, dz] of [
      [-half, -half],
      [half, -half],
      [-half, half],
      [half, half],
      [0, 0],
    ])
      expect(onStreet(x + dx!, z + dz!), `${cell.join(",")} lot on a street`).toBe(false);
  }
});

test("buildings take blocks in the order they are placed, from the centre out", () => {
  // The interview asks the structure first: it gets the central block.
  const blocks = assignBlocks(placed("name", "structure", "toolchain", "frontend"));
  expect(blocks.structure).toEqual(SPIRAL[0]);
  expect(blocks.toolchain).toEqual(SPIRAL[1]);
  expect(blocks.frontend).toEqual(SPIRAL[2]);
  expect(blocks.name).toBeUndefined();
  // The same slots placed the other way round.
  const reversed = assignBlocks(placed("frontend", "toolchain", "structure"));
  expect(reversed.frontend).toEqual(SPIRAL[0]);
  expect(reversed.structure).toEqual(SPIRAL[2]);
  // Every lot slot of the whole interview gets its own block, in seq order.
  const all = assignBlocks(ALL);
  const order = SLOTS.filter((s) => LOT_SLOTS.includes(s.id)).map((s) => all[s.id]);
  expect(order).toEqual(SPIRAL.slice(0, order.length));
});

test("not needed, the name and the paint take no block; nor do they hold one up", () => {
  const placements = town(["name", "structure", "api", "toolchain", "ui"], ["api"]).getState()
    .placements;
  const blocks = assignBlocks(placements);
  expect(blocks.api).toBeUndefined();
  expect(blocks.ui).toBeUndefined();
  expect(blocks.name).toBeUndefined();
  expect(blocks.structure).toEqual(SPIRAL[0]);
  expect(blocks.toolchain).toEqual(SPIRAL[1]);
  expect(nextBlock(placements)).toEqual(SPIRAL[2]);
  expect(nextBlock({})).toEqual(SPIRAL[0]);
});

test("re-answering a slot keeps its block", () => {
  const placements = placed("structure", "frontend", "data");
  const before = assignBlocks(placements);
  placements.frontend = {
    ...placements.frontend!,
    optionIds: ["tanstack-start"],
    labels: ["TanStack"],
  };
  expect(assignBlocks(placements)).toEqual(before);
});

test("no streets on bare land; the name paves the entrance road only", () => {
  expect(builtStreets({})).toEqual([]);
  const entrance = builtStreets(placed("name"));
  expect(entrance).toHaveLength(1);
  expect(same(entrance[0]!.a, ENTRANCE) || same(entrance[0]!.b, ENTRANCE)).toBe(true);
  // Not-needed answers build nothing either.
  expect(builtStreets(town(["api"], ["api"]).getState().placements)).toHaveLength(1);
});

test("built streets are axis-aligned pieces of street centre-lines", () => {
  for (const { a, b } of builtStreets(ALL)) {
    expect(a[0] === b[0] || a[1] === b[1]).toBe(true);
    expect(same(a, b)).toBe(false);
    for (const p of [a, b]) expect(onStreetLine(p)).toBe(true);
  }
});

/** The nodes reachable from `start` over `segments`. */
function reachable(segments: Segment[], start: Point): Set<string> {
  const key = (p: Point) => `${p[0].toFixed(3)},${p[1].toFixed(3)}`;
  const seen = new Set([key(start)]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const { a, b } of segments) {
      if (seen.has(key(a)) !== seen.has(key(b))) {
        seen.add(key(a));
        seen.add(key(b));
        grew = true;
      }
    }
  }
  return seen;
}

test("every block's kerb is connected to the entrance", () => {
  const nodes = reachable(builtStreets(ALL), ENTRANCE);
  for (const cell of Object.values(assignBlocks(ALL))) {
    const [x, z] = kerbOf(cell);
    expect(nodes.has(`${x.toFixed(3)},${z.toFixed(3)}`), cell.join(",")).toBe(true);
  }
});

test("the streets only grow as answers come in, in any order", () => {
  const random = (seed: number) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let run = 0; run < 20; run++) {
    const next = random(run + 1);
    const order = SLOTS.map((s) => s.id).sort(() => next() - 0.5);
    // Every third slot turns out not to be needed.
    const skip = order.filter((_, i) => i % 3 === 2);
    let before = new Set<string>();
    for (let i = 1; i <= order.length; i++) {
      const after = keys(builtStreets(town(order.slice(0, i), skip).getState().placements));
      for (const key of before) expect(after.has(key)).toBe(true);
      before = after;
    }
  }
});

test("flipping a slot across 'not needed' moves no building and tears down no street", () => {
  const store = town(["name", "structure", "api", "toolchain", "frontend", "data"], ["api"]);
  const blocksOf = () => assignBlocks(store.getState().placements);
  let streets = keys(builtStreets(store.getState().placements));
  const step = (change: () => void, moving: SlotId[]) => {
    const before = blocksOf();
    change();
    const after = blocksOf();
    for (const [slot, cell] of Object.entries(before))
      if (!moving.includes(slot as SlotId)) expect(after[slot as SlotId], slot).toEqual(cell);
    const now = keys(builtStreets(store.getState().placements));
    for (const key of streets) expect(now.has(key)).toBe(true);
    streets = now;
    return after;
  };
  // Not needed → real after later answers: it takes the next free block, at the end.
  const flipped = step(() => decide(store, "api"), ["api"]);
  expect(flipped.api).toEqual(SPIRAL[4]);
  // Real → not needed: its block stays where it was (empty); nobody moves into it.
  const emptied = step(() => decide(store, "toolchain", true), []);
  expect(emptied.toolchain).toEqual(SPIRAL[1]);
  expect(streetRoute("toolchain", "frontend", store.getState().placements)).toEqual([]);
  // A new building still goes to a block nobody has had.
  const grown = step(() => decide(store, "deploy"), ["deploy"]);
  expect(grown.deploy).toEqual(SPIRAL[5]);
  // And back: the old block again.
  expect(step(() => decide(store, "toolchain", false, 1), []).toolchain).toEqual(SPIRAL[1]);
});

test("a route runs along built streets from one kerb to the other", () => {
  const built = keys(builtStreets(ALL));
  const blocks = assignBlocks(ALL);
  for (const a of LOT_SLOTS)
    for (const b of LOT_SLOTS) {
      if (a === b) continue;
      const route = streetRoute(a, b, ALL);
      expect(route.length).toBeGreaterThanOrEqual(2);
      expect(same(route[0]!, kerbOf(blocks[a]!))).toBe(true);
      expect(same(route.at(-1)!, kerbOf(blocks[b]!))).toBe(true);
      for (let i = 1; i < route.length; i++) {
        const [p, q] = [route[i - 1]!, route[i]!];
        expect(same(p, q)).toBe(false);
        expect(p[0] === q[0] || p[1] === q[1]).toBe(true);
      }
      expect(onBuilt(route, built), `${a}→${b}`).toBe(true);
    }
  // The paint has no block: its links start at the entrance.
  expect(same(streetRoute("ui", "frontend", ALL)[0]!, ENTRANCE)).toBe(true);
});

test("neighbours are linked by a short route, not around the city", () => {
  const blocks = assignBlocks(ALL);
  for (const a of LOT_SLOTS)
    for (const b of LOT_SLOTS) {
      const [ai, aj] = blocks[a]!;
      const [bi, bj] = blocks[b]!;
      if (Math.abs(ai - bi) + Math.abs(aj - bj) !== 1) continue;
      // Kerbs on the same street: straight along it; one row apart: round one corner.
      expect(length(streetRoute(a, b, ALL)), `${a}→${b}`).toBeLessThanOrEqual(2 * PITCH + 1e-9);
    }
});

test("a route only uses the streets built so far", () => {
  const placements = placed("name", "frontend", "deploy");
  const route = streetRoute("frontend", "deploy", placements);
  expect(route.length).toBeGreaterThanOrEqual(2);
  expect(onBuilt(route, keys(builtStreets(placements)))).toBe(true);
  // No route to a block that isn't there.
  expect(streetRoute("frontend", "api", placements)).toEqual([]);
  const skipped = town(["name", "frontend", "deploy", "api"], ["api"]).getState().placements;
  expect(streetRoute("frontend", "api", skipped)).toEqual([]);
});

test("cars come once two blocks stand: one per two blocks, six at most", () => {
  expect(carCount({})).toBe(0);
  expect(carCount(placed("name"))).toBe(0);
  expect(carCount(placed("name", "frontend"))).toBe(0);
  expect(carCount(placed("name", "frontend", "data"))).toBe(1);
  expect(carCount(placed("frontend", "data", "api"))).toBe(1);
  expect(carCount(placed("frontend", "data", "api", "auth"))).toBe(2);
  expect(carCount(town(["frontend", "data", "api"], ["api"]).getState().placements)).toBe(1);
  expect(carCount(ALL)).toBe(6);
});

test("new streets are paved outward from the existing network, one after another", () => {
  const before = builtStreets(placed("name", "frontend"));
  const after = builtStreets(placed("name", "frontend", "deploy", "data", "api"));
  const order = pavingOrder(before, after);
  expect(order.map((o) => segmentKey(o.segment)).sort()).toEqual(
    [...keys(after)].filter((k) => !keys(before).has(k)).sort(),
  );
  const laid = new Set(before.flatMap(({ a, b }) => [a, b].map((p) => p.join(","))));
  const steps = [...order].sort((x, y) => x.step - y.step);
  expect(steps[0]!.step).toBe(0);
  for (const { segment, from, step } of steps) {
    // Each piece starts where the road already reaches.
    expect(laid.has(from.join(",")), `step ${step}`).toBe(true);
    expect(same(from, segment.a) || same(from, segment.b)).toBe(true);
    laid.add(segment.a.join(","));
    laid.add(segment.b.join(","));
  }
  // From bare land, the entrance road is laid first, from the edge of the slab inwards.
  const first = pavingOrder([], builtStreets(placed("name")));
  expect(first).toHaveLength(1);
  expect(same(first[0]!.from, ENTRANCE)).toBe(false);
});

test("crosswalks go where three or more streets meet, one per street", () => {
  expect(crossings(builtStreets(placed("name")))).toEqual([]);
  // One central block: a ring of streets with the avenue leaving it; corners are turns.
  const one = crossings(builtStreets(placed("frontend")));
  expect(one).toHaveLength(1);
  expect(same(one[0]!.at, [PITCH / 2, PITCH / 2])).toBe(true);
  expect(one[0]!.arms).toHaveLength(3);
  for (const { at, arms } of crossings(builtStreets(ALL))) {
    expect(arms.length).toBeGreaterThanOrEqual(3);
    expect(onStreetLine(at)).toBe(true);
    for (const [dx, dz] of arms) expect(Math.abs(dx) + Math.abs(dz)).toBe(1);
  }
});

test("trails sharing a street get different lanes", () => {
  const h = PITCH / 2;
  const lanes = trailLanes([
    [
      [0, h],
      [2 * h, h],
    ],
    [
      [2 * h, h],
      [0, h],
    ],
    [
      [0, h],
      [0, 3 * h],
    ],
    [
      [-2 * h, h],
      [4 * h, h],
    ],
  ]);
  expect(lanes).toHaveLength(4);
  expect(lanes[0]).not.toBe(lanes[1]);
  expect(lanes[3]).not.toBe(lanes[0]);
  expect(lanes[3]).not.toBe(lanes[1]);
  for (const lane of lanes) expect([-1, 0, 1]).toContain(lane);
});
