// The city's grid and its streets, as pure data: which block each answer builds on, which
// streets are paved for the blocks taken so far, the routes along them and how many cars
// drive there. No React or three.js, so it can be tested.
//
// Blocks sit on a square grid, separated by streets. The store hands each building the next
// block nobody has had (its `lot`), spiralling out from the central block, so the town
// always grows from the middle whatever the interview asks first, and nothing ever moves. Columns run along x and rows along z;
// +x and +z run towards the default camera, and the entrance is on the +z side. Streets
// are worked out on a graph whose nodes sit every half block along the street centre-lines:
// at the crossings, and at the middle of each block's side, where its kerb is.
import { takesLot, type SlotId } from "../../src/town/catalog.ts";
import type { Placement } from "../../src/town/protocol.ts";

export const GRID = {
  /** Width of a block, kerb to kerb. */
  block: 4.6,
  /** Width of a street, kerb to kerb: two lanes. */
  street: 1.6,
  /** Width of the building's square in the middle of its block. */
  lot: 3,
  /** The columns and rows of blocks the city can grow to. */
  min: -1,
  max: 2,
  /** Width of the green park strip round the city, to the slab's edge. */
  belt: 3,
} as const;

/** From one block's centre to the next. */
export const PITCH = GRID.block + GRID.street;
const HALF = PITCH / 2;

export type Point = [x: number, z: number];
export type Cell = readonly [column: number, row: number];

/** A straight piece of street centre-line, half a block long (the entrance road is
 * longer), with `a` before `b` (by x, then z). */
export interface Segment {
  readonly a: Point;
  readonly b: Point;
}

/** The slab the city stands on, edge to edge. */
export const SLAB = {
  minX: GRID.min * PITCH - HALF - GRID.street / 2 - GRID.belt,
  maxX: GRID.max * PITCH + HALF + GRID.street / 2 + GRID.belt,
  minZ: GRID.min * PITCH - HALF - GRID.street / 2 - GRID.belt,
  maxZ: GRID.max * PITCH + HALF + GRID.street / 2 + GRID.belt,
} as const;

/** The grid nodes are (u, v) in half-pitch steps: x = u * HALF, z = v * HALF. Street
 * centre-lines are at odd u (running along z) and odd v (running along x). */
type Node = readonly [u: number, v: number];

/** The street the entrance road comes in on, between the central column and the next. */
const AVENUE = 1;
/** The outermost street on the entrance side. */
const FRONT = 2 * GRID.max + 1;
const ENTRANCE_NODE: Node = [AVENUE, FRONT];

const world = ([u, v]: Node): Point => [u * HALF, v * HALF];

/** Where the entrance road meets the city's front street. */
export const ENTRANCE: Point = world(ENTRANCE_NODE);
/** Where the entrance road starts, at the slab's edge. */
export const ENTRANCE_EDGE: Point = [ENTRANCE[0], SLAB.maxZ];

/** Every cell of the grid in the order blocks are handed out: the centre, then the ring
 * round it (the sides before the corners), then the outer ring, nearest the middle first. */
export const SPIRAL: readonly Cell[] = (() => {
  const cells: Cell[] = [];
  for (let column = GRID.min; column <= GRID.max; column++)
    for (let row = GRID.min; row <= GRID.max; row++) cells.push([column, row]);
  const ring = ([c, r]: Cell) => Math.max(Math.abs(c), Math.abs(r));
  const reach = ([c, r]: Cell) => Math.abs(c) + Math.abs(r);
  // Within a ring and distance: round from the left (-x), through the back, to the front.
  const turn = ([c, r]: Cell) => (Math.atan2(-r, -c) + 2 * Math.PI) % (2 * Math.PI);
  return cells.sort((a, b) => ring(a) - ring(b) || reach(a) - reach(b) || turn(a) - turn(b));
})();

export function blockCentre([column, row]: Cell): Point {
  return [column * PITCH, row * PITCH];
}

/** The middle of the block's front kerb (+z side), as a grid node. */
function kerbNode([column, row]: Cell): Node {
  return [2 * column, 2 * row + 1];
}

/** Where traffic for a block stops: the middle of its front kerb. */
export function kerbOf(cell: Cell): Point {
  return world(kerbNode(cell));
}

type Placements = Partial<Record<SlotId, Placement>>;

/** The block each slot was given: `SPIRAL[lot]`. A slot keeps its block when it turns
 * "not needed" (the block stays, empty), so blocks never move or disappear. */
export function assignBlocks(placements: Placements): Partial<Record<SlotId, Cell>> {
  const blocks: Partial<Record<SlotId, Cell>> = {};
  for (const placement of Object.values(placements)) {
    const cell = placement.lot === null ? undefined : SPIRAL[placement.lot];
    if (cell) blocks[placement.slot] = cell;
  }
  return blocks;
}

/** The block the next building will take: the first one nobody has had; null once the
 * grid is full. */
export function nextBlock(placements: Placements): Cell | null {
  const used = Object.values(placements).map((placement) => placement.lot ?? -1);
  return SPIRAL[Math.max(-1, ...used) + 1] ?? null;
}

const near = (value: number) => Math.abs(value - Math.round(value)) < 1e-6;

/** Is the point on a street centre-line inside the city (or on the entrance road)? */
export function onStreetLine([x, z]: Point): boolean {
  const u = x / HALF;
  const v = z / HALF;
  const inside = (w: number) => w >= 2 * GRID.min - 1 - 1e-6 && w <= 2 * GRID.max + 1 + 1e-6;
  const onU = near(u) && Math.round(u) % 2 !== 0 && inside(u);
  const onV = near(v) && Math.round(v) % 2 !== 0 && inside(v);
  if (onU && inside(v)) return true;
  if (onV && inside(u)) return true;
  // The entrance road, out to the edge of the slab.
  return Math.abs(x - ENTRANCE[0]) < 1e-6 && z >= ENTRANCE[1] - 1e-6 && z <= SLAB.maxZ + 1e-6;
}

/** Is (x, z) within `margin` of a street the city could ever pave (kerb to kerb)? */
export function nearStreet(x: number, z: number, margin = 0): boolean {
  const reach = GRID.street / 2 + margin;
  const low = GRID.min * PITCH - HALF - reach;
  const high = GRID.max * PITCH + HALF + reach;
  const inCity = (w: number) => w > low && w < high;
  const lineDistance = (w: number) => {
    const t = w / PITCH - 0.5;
    return Math.abs(t - Math.round(t)) * PITCH;
  };
  if (inCity(x) && inCity(z) && (lineDistance(x) < reach || lineDistance(z) < reach)) return true;
  // The entrance road.
  return Math.abs(x - ENTRANCE[0]) < reach && z > ENTRANCE[1] - reach;
}

function canonical(p: Node, q: Node): [Node, Node] {
  return p[0] < q[0] || (p[0] === q[0] && p[1] < q[1]) ? [p, q] : [q, p];
}

const nodeKey = ([u, v]: Node) => `${u},${v}`;

const pointKey = ([x, z]: Point) => `${x.toFixed(3)},${z.toFixed(3)}`;

/** A stable key for a segment, whichever way round its ends are given. */
export function segmentKey({ a, b }: Segment): string {
  const [p, q] = [pointKey(a), pointKey(b)].sort();
  return `${p}|${q}`;
}

/** The half-block pieces of street from `from` to `to` (same row or column of nodes). */
function line(from: Node, to: Node): Array<[Node, Node]> {
  const pieces: Array<[Node, Node]> = [];
  const du = Math.sign(to[0] - from[0]);
  const dv = Math.sign(to[1] - from[1]);
  let at = from;
  while (at[0] !== to[0] || at[1] !== to[1]) {
    const next: Node = [at[0] + du, at[1] + dv];
    pieces.push(canonical(at, next));
    at = next;
  }
  return pieces;
}

/** The streets a block paves: all four sides, then the way to the entrance — along its
 * front street to the avenue, and up the avenue to the front of the city. */
function blockStreets([column, row]: Cell): Array<[Node, Node]> {
  const [left, right] = [2 * column - 1, 2 * column + 1];
  const [back, front] = [2 * row - 1, 2 * row + 1];
  const corner = column <= 0 ? right : left;
  return [
    ...line([left, front], [right, front]),
    ...line([left, back], [right, back]),
    ...line([left, back], [left, front]),
    ...line([right, back], [right, front]),
    ...line([corner, front], [AVENUE, front]),
    ...line([AVENUE, front], ENTRANCE_NODE),
  ];
}

/** The grid pieces paved for these placements (the entrance road aside). */
function gridStreets(placements: Placements): Array<[Node, Node]> {
  const pieces = new Map<string, [Node, Node]>();
  for (const cell of Object.values(assignBlocks(placements)))
    for (const piece of blockStreets(cell))
      pieces.set(`${nodeKey(piece[0])}|${nodeKey(piece[1])}`, piece);
  return [...pieces.values()];
}

/** Every street paved for these placements: nothing on bare land; the entrance road once
 * anything is placed (the name sign stands by it); and for each block taken, the streets
 * round it and on to the entrance. A new placement only ever adds streets. */
export function builtStreets(placements: Placements): Segment[] {
  if (!Object.values(placements).some(Boolean)) return [];
  const entrance: Segment = { a: ENTRANCE, b: ENTRANCE_EDGE };
  return [
    entrance,
    ...gridStreets(placements).map(([p, q]): Segment => ({ a: world(p), b: world(q) })),
  ];
}

/** Where a slot's traffic starts: its block's kerb, or the entrance for the sign and the
 * paint; null when it has no place in the town (not placed, or not needed). */
function kerbNodeOf(slot: SlotId, placements: Placements): Node | null {
  const placement = placements[slot];
  if (!placement) return null;
  if (slot === "name" || slot === "ui") return ENTRANCE_NODE;
  const cell = assignBlocks(placements)[slot];
  return cell && takesLot(slot, placement.optionIds) ? kerbNode(cell) : null;
}

/** The way from `a`'s kerb to `b`'s along the streets built for `placements`: its start,
 * its corners and its end, each leg along one street. The shortest way, turning as little
 * as it can; empty when either end has no place in the town. */
export function streetRoute(a: SlotId, b: SlotId, placements: Placements): Point[] {
  const start = kerbNodeOf(a, placements);
  const goal = kerbNodeOf(b, placements);
  if (!start || !goal || nodeKey(start) === nodeKey(goal)) return [];
  const neighbours = new Map<string, Node[]>();
  for (const [p, q] of gridStreets(placements)) {
    neighbours.set(nodeKey(p), [...(neighbours.get(nodeKey(p)) ?? []), q]);
    neighbours.set(nodeKey(q), [...(neighbours.get(nodeKey(q)) ?? []), p]);
  }
  // Distances to the goal, then walk down them from the start.
  const distance = new Map([[nodeKey(goal), 0]]);
  const queue: Node[] = [goal];
  for (let i = 0; i < queue.length; i++) {
    const node = queue[i]!;
    for (const next of neighbours.get(nodeKey(node)) ?? []) {
      if (distance.has(nodeKey(next))) continue;
      distance.set(nodeKey(next), distance.get(nodeKey(node))! + 1);
      queue.push(next);
    }
  }
  if (!distance.has(nodeKey(start))) return [];
  const path: Node[] = [start];
  let heading: Node | null = null;
  while (nodeKey(path.at(-1)!) !== nodeKey(goal)) {
    const at = path.at(-1)!;
    const steps = (neighbours.get(nodeKey(at)) ?? []).filter(
      (next) => distance.get(nodeKey(next)) === distance.get(nodeKey(at))! - 1,
    );
    // Keep going straight when that's as short.
    const straight = steps.find(
      (next) => heading && next[0] - at[0] === heading[0] && next[1] - at[1] === heading[1],
    );
    const next = straight ?? steps[0]!;
    heading = [next[0] - at[0], next[1] - at[1]];
    path.push(next);
  }
  // Only the corners.
  const corners = path.filter((node, i) => {
    if (i === 0 || i === path.length - 1) return true;
    const before = path[i - 1]!;
    const after = path[i + 1]!;
    return (before[0] === node[0]) !== (node[0] === after[0]);
  });
  return corners.map(world);
}

/** How many cars drive round the town: none until two blocks stand (and so are linked by
 * a street), then one for every two blocks, six at most. */
export function carCount(placements: Placements): number {
  const blocks = Object.keys(assignBlocks(placements)).length;
  return blocks < 2 ? 0 : Math.min(6, Math.floor(blocks / 2));
}

export interface Paving {
  segment: Segment;
  /** The end it is laid from: where the road already reaches. */
  from: Point;
  /** When it is laid, in steps: 0 first; a step's pieces start where earlier ones end. */
  step: number;
}

/** The order the new streets in `after` are laid in: outward from the streets in `before`
 * (from the slab's edge on bare land), one piece after another. */
export function pavingOrder(before: Segment[], after: Segment[]): Paving[] {
  const old = new Set(before.map(segmentKey));
  const fresh = after.filter((segment) => !old.has(segmentKey(segment)));
  const reached = new Set(before.flatMap(({ a, b }) => [pointKey(a), pointKey(b)]));
  if (reached.size === 0) reached.add(pointKey(ENTRANCE_EDGE));
  const order: Paving[] = [];
  let left = fresh;
  for (let step = 0; left.length > 0; step++) {
    const now = left.filter(({ a, b }) => reached.has(pointKey(a)) || reached.has(pointKey(b)));
    // Nothing touches the road (never happens with built streets): lay the rest anyway.
    const laying = now.length > 0 ? now : left;
    for (const segment of laying)
      order.push({ segment, from: reached.has(pointKey(segment.b)) ? segment.b : segment.a, step });
    for (const { a, b } of laying) {
      reached.add(pointKey(a));
      reached.add(pointKey(b));
    }
    left = left.filter((segment) => !laying.includes(segment));
  }
  return order;
}

export interface Crossing {
  at: Point;
  /** The streets leaving it, as unit steps along x or z. */
  arms: Array<[dx: number, dz: number]>;
}

/** The crossings of these streets where three or more meet: where crosswalks go. */
export function crossings(segments: Segment[]): Crossing[] {
  const found = new Map<string, Crossing>();
  for (const { a, b } of segments) {
    for (const [from, to] of [
      [a, b],
      [b, a],
    ] as const) {
      const key = pointKey(from);
      const crossing = found.get(key) ?? { at: from, arms: [] };
      crossing.arms.push([Math.sign(to[0] - from[0]), Math.sign(to[1] - from[1])]);
      found.set(key, crossing);
    }
  }
  return [...found.values()].filter((crossing) => crossing.arms.length >= 3);
}

/** The half-block pieces a route runs along, as segment keys. */
export function routePieces(route: Point[]): string[] {
  const pieces: string[] = [];
  for (let i = 1; i < route.length; i++) {
    const [p, q] = [route[i - 1]!, route[i]!];
    const steps = Math.max(1, Math.round((Math.abs(q[0] - p[0]) + Math.abs(q[1] - p[1])) / HALF));
    for (let s = 0; s < steps; s++) {
      const at = (t: number): Point => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
      pieces.push(segmentKey({ a: at(s / steps), b: at((s + 1) / steps) }));
    }
  }
  return pieces;
}

/** A lane (-1, 0 or 1, across the street) for each route, so routes that share a street
 * stay apart where they can: each takes the lane it shares the fewest pieces on. */
export function trailLanes(routes: Point[][]): number[] {
  const used = new Map<number, Set<string>>([
    [0, new Set()],
    [-1, new Set()],
    [1, new Set()],
  ]);
  return routes.map((route) => {
    const pieces = routePieces(route);
    let best = 0;
    let fewest = Number.POSITIVE_INFINITY;
    for (const lane of [0, -1, 1]) {
      const shared = pieces.filter((piece) => used.get(lane)!.has(piece)).length;
      if (shared < fewest) {
        fewest = shared;
        best = lane;
      }
    }
    for (const piece of pieces) used.get(best)!.add(piece);
    return best;
  });
}
