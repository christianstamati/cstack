import { expect, test } from "vite-plus/test";

import { SLOTS, type SlotId } from "../../src/town/catalog.ts";
import type { Placement } from "../../src/town/protocol.ts";
import {
  blockCentre,
  blockOf,
  builtStreets,
  carCount,
  crossings,
  ENTRANCE,
  GRID,
  kerbOf,
  onStreetLine,
  pavingOrder,
  PITCH,
  segmentKey,
  streetRoute,
  trailLanes,
  type Point,
  type Segment,
} from "./streets.ts";

type Placements = Partial<Record<SlotId, Placement>>;

const BLOCK_SLOTS = SLOTS.filter((slot) => slot.block !== null).map((slot) => slot.id);

function placed(...slots: SlotId[]): Placements {
  const placements: Placements = {};
  for (const id of slots) {
    const slot = SLOTS.find((s) => s.id === id)!;
    const option = slot.options[0];
    placements[id] = {
      slot: id,
      optionIds: option ? [option.id] : [],
      labels: [option?.label ?? "shop"],
      auto: false,
    };
  }
  return placements;
}

const ALL = placed(...SLOTS.map((slot) => slot.id));

const keys = (segments: Segment[]) => new Set(segments.map(segmentKey));
const same = (a: Point, b: Point) => Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9;
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

test("every slot with a block has its own cell inside the city, its lot off the streets", () => {
  const cells = new Set<string>();
  for (const id of BLOCK_SLOTS) {
    const cell = blockOf(id)!;
    for (const c of cell) {
      expect(c).toBeGreaterThanOrEqual(GRID.min);
      expect(c).toBeLessThanOrEqual(GRID.max);
    }
    cells.add(cell.join(","));
    const [x, z] = blockCentre(cell);
    const half = GRID.lot / 2;
    for (const [dx, dz] of [
      [-half, -half],
      [half, -half],
      [-half, half],
      [half, half],
      [0, 0],
    ])
      expect(onStreet(x + dx!, z + dz!), `${id}'s lot on a street`).toBe(false);
  }
  expect(cells.size).toBe(BLOCK_SLOTS.length);
  expect(blockOf("name")).toBeNull();
  expect(blockOf("ui")).toBeNull();
});

test("the city grows from the middle: frontend in the centre, rings never shrink in fill order", () => {
  expect(blockOf("frontend")).toEqual([0, 0]);
  const ring = (id: SlotId) => Math.max(...blockOf(id)!.map(Math.abs));
  const buildings = SLOTS.filter((slot) => slot.kind === "building").map((slot) => ring(slot.id));
  for (let i = 1; i < buildings.length; i++)
    expect(buildings[i]).toBeGreaterThanOrEqual(buildings[i - 1]!);
  expect(ring("data")).toBe(1);
  for (const id of ["api", "auth", "database", "dbHost"] as const) expect(ring(id)).toBe(1);
  for (const id of ["deploy", "structure", "toolchain", "packageManager", "extras"] as const)
    expect(ring(id)).toBe(2);
});

test("no streets on bare land; the name paves the entrance road only", () => {
  expect(builtStreets({})).toEqual([]);
  const entrance = builtStreets(placed("name"));
  expect(entrance).toHaveLength(1);
  const [road] = entrance;
  expect(same(road!.a, ENTRANCE) || same(road!.b, ENTRANCE)).toBe(true);
});

test("built streets are axis-aligned pieces of street centre-lines", () => {
  for (const segment of builtStreets(ALL)) {
    const { a, b } = segment;
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

test("every placed block's kerb is connected to the entrance, whatever comes first", () => {
  for (const id of BLOCK_SLOTS) {
    const placements = placed(id);
    const nodes = reachable(builtStreets(placements), ENTRANCE);
    const [x, z] = kerbOf(id);
    expect(nodes.has(`${x.toFixed(3)},${z.toFixed(3)}`), id).toBe(true);
  }
  const all = reachable(builtStreets(ALL), ENTRANCE);
  for (const id of BLOCK_SLOTS) {
    const [x, z] = kerbOf(id);
    expect(all.has(`${x.toFixed(3)},${z.toFixed(3)}`), id).toBe(true);
  }
});

test("the streets only grow as blocks are added, in any order", () => {
  const random = (seed: number) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let run = 0; run < 20; run++) {
    const next = random(run + 1);
    const order = SLOTS.map((s) => s.id).sort(() => next() - 0.5);
    let before = new Set<string>();
    for (let i = 1; i <= order.length; i++) {
      const after = keys(builtStreets(placed(...order.slice(0, i))));
      for (const key of before) expect(after.has(key)).toBe(true);
      before = after;
    }
    expect(before).toEqual(keys(builtStreets(ALL)));
  }
});

test("a route runs along built streets from one kerb to the other", () => {
  const built = keys(builtStreets(ALL));
  for (const a of BLOCK_SLOTS)
    for (const b of BLOCK_SLOTS) {
      if (a === b) continue;
      const route = streetRoute(a, b, ALL);
      expect(route.length).toBeGreaterThanOrEqual(2);
      expect(same(route[0]!, kerbOf(a))).toBe(true);
      expect(same(route.at(-1)!, kerbOf(b))).toBe(true);
      for (let i = 1; i < route.length; i++) {
        const [p, q] = [route[i - 1]!, route[i]!];
        expect(same(p, q)).toBe(false);
        expect(p[0] === q[0] || p[1] === q[1]).toBe(true);
        // Every half-block piece of the leg is a built street.
        const steps = Math.round((Math.abs(q[0] - p[0]) + Math.abs(q[1] - p[1])) / (PITCH / 2));
        for (let s = 0; s < steps; s++) {
          const t0 = s / steps;
          const t1 = (s + 1) / steps;
          const from: Point = [p[0] + (q[0] - p[0]) * t0, p[1] + (q[1] - p[1]) * t0];
          const to: Point = [p[0] + (q[0] - p[0]) * t1, p[1] + (q[1] - p[1]) * t1];
          expect(built.has(segmentKey({ a: from, b: to })), `${a}→${b}`).toBe(true);
        }
      }
    }
});

test("neighbours are linked by a short route, not around the city", () => {
  for (const a of BLOCK_SLOTS)
    for (const b of BLOCK_SLOTS) {
      const [ai, aj] = blockOf(a)!;
      const [bi, bj] = blockOf(b)!;
      if (Math.abs(ai - bi) + Math.abs(aj - bj) !== 1) continue;
      // Kerbs on the same street: straight along it; one row apart: round one corner.
      expect(length(streetRoute(a, b, ALL)), `${a}→${b}`).toBeLessThanOrEqual(2 * PITCH + 1e-9);
    }
});

test("a route only uses the streets built so far", () => {
  const placements = placed("name", "frontend", "deploy");
  const built = keys(builtStreets(placements));
  const route = streetRoute("frontend", "deploy", placements);
  expect(same(route[0]!, kerbOf("frontend"))).toBe(true);
  expect(same(route.at(-1)!, kerbOf("deploy"))).toBe(true);
  for (let i = 1; i < route.length; i++) {
    const [p, q] = [route[i - 1]!, route[i]!];
    const steps = Math.round((Math.abs(q[0] - p[0]) + Math.abs(q[1] - p[1])) / (PITCH / 2));
    for (let s = 0; s < steps; s++) {
      const from: Point = [p[0] + ((q[0] - p[0]) * s) / steps, p[1] + ((q[1] - p[1]) * s) / steps];
      const to: Point = [
        p[0] + ((q[0] - p[0]) * (s + 1)) / steps,
        p[1] + ((q[1] - p[1]) * (s + 1)) / steps,
      ];
      expect(built.has(segmentKey({ a: from, b: to }))).toBe(true);
    }
  }
  // No route to a block that isn't there yet.
  expect(streetRoute("frontend", "api", placements)).toEqual([]);
});

test("cars come once two blocks are connected: one per two blocks, six at most", () => {
  expect(carCount({})).toBe(0);
  expect(carCount(placed("name"))).toBe(0);
  expect(carCount(placed("name", "frontend"))).toBe(0);
  expect(carCount(placed("name", "frontend", "data"))).toBe(1);
  expect(carCount(placed("frontend", "data", "api"))).toBe(1);
  expect(carCount(placed("frontend", "data", "api", "auth"))).toBe(2);
  expect(carCount(ALL)).toBe(6);
  // A "not needed" lot still grows the town.
  expect(
    carCount({
      ...placed("frontend"),
      api: { slot: "api", optionIds: [], labels: [], auto: true },
    }),
  ).toBe(1);
});

test("new streets are paved outward from the existing network, one after another", () => {
  const before = builtStreets(placed("name", "frontend"));
  const after = builtStreets(placed("name", "frontend", "deploy"));
  const order = pavingOrder(before, after);
  expect(order.map((o) => segmentKey(o.segment)).sort()).toEqual(
    [...keys(after)].filter((k) => !keys(before).has(k)).sort(),
  );
  const network = new Set(before.flatMap(({ a, b }) => [a, b].map((p) => p.join(","))));
  const laid = new Set(network);
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
  // One block: a ring of streets with the avenue leaving it; corners are turns, no crossing.
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
  const route = (...points: Point[]) => points;
  const h = PITCH / 2;
  const lanes = trailLanes([
    route([0, h], [2 * h, h]),
    route([2 * h, h], [0, h]),
    route([0, h], [0, 3 * h]),
    route([-2 * h, h], [4 * h, h]),
  ]);
  expect(lanes).toHaveLength(4);
  // The first two share a street: different lanes; the third shares nothing with them.
  expect(lanes[0]).not.toBe(lanes[1]);
  expect(lanes[3]).not.toBe(lanes[0]);
  expect(lanes[3]).not.toBe(lanes[1]);
  for (const lane of lanes) expect([-1, 0, 1]).toContain(lane);
});
