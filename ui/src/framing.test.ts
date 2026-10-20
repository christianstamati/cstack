import { expect, test } from "vite-plus/test";

import { SLOTS, type SlotId } from "../../src/town/catalog.ts";
import type { Placement } from "../../src/town/protocol.ts";
import { TownStore } from "../../src/town/store.ts";
import { framePoints, frameFor, VIEW, zoomFor, type Frame } from "./framing.ts";
import { NAME_SPOT } from "./logic.ts";
import { SLAB, type Point } from "./streets.ts";

type Placements = Partial<Record<SlotId, Placement>>;

/** The agent decided these slots in this order, each with its first option. */
function placed(...slots: SlotId[]): Placements {
  const store = new TownStore("t");
  for (const id of slots) {
    const option = SLOTS.find((s) => s.id === id)!.options[0];
    store.decide({ slot: id, optionIds: option ? [option.id] : [], labels: ["x"], reason: "x" });
  }
  return store.getState().placements;
}

const dot = (a: readonly number[], b: readonly number[]) =>
  a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;

/** Is every point inside the frame, seen from the starting view? */
function inside(frame: Frame, points: Array<[number, number, number]>): boolean {
  return points.every((p) => {
    const offset = [p[0] - frame.target[0], p[1] - frame.target[1], p[2] - frame.target[2]];
    return (
      Math.abs(dot(offset, VIEW.right)) <= frame.halfWidth + 1e-9 &&
      Math.abs(dot(offset, VIEW.up)) <= frame.halfHeight + 1e-9
    );
  });
}

const SCREEN = { width: 1440, height: 860 };
const next = (p: Placements): Point | null =>
  Object.keys(p).length < SLOTS.length ? [0, 0] : null;

test("on bare land the camera frames the entrance, close up", () => {
  const points = framePoints({}, NAME_SPOT);
  const frame = frameFor(points);
  expect(inside(frame, points)).toBe(true);
  expect(Math.hypot(frame.target[0] - NAME_SPOT[0], frame.target[2] - NAME_SPOT[1])).toBeLessThan(
    4,
  );
  expect(frame.halfWidth).toBeLessThan(13);
});

test("the frame holds every built block, the sign and the crane's next lot", () => {
  const placements = placed("name", "structure", "toolchain", "frontend");
  const points = framePoints(placements, [6.2, 0]);
  const frame = frameFor(points);
  expect(inside(frame, points)).toBe(true);
  // The target sits about the ground, a little up.
  expect(frame.target[1]).toBeCloseTo(0.8);
});

test("the camera zooms out as the city grows, but stays closer than the whole slab", () => {
  const order = SLOTS.map((slot) => slot.id);
  let before = Number.POSITIVE_INFINITY;
  for (let i = 1; i <= order.length; i++) {
    const placements = placed(...order.slice(0, i));
    const zoom = zoomFor(frameFor(framePoints(placements, next(placements))), SCREEN);
    expect(zoom).toBeLessThanOrEqual(before + 1e-9);
    before = zoom;
  }
  // The whole slab, corner to corner, would need a smaller zoom than the finished city.
  const corners: Array<[number, number, number]> = [
    [SLAB.minX, 0, SLAB.minZ],
    [SLAB.maxX, 0, SLAB.minZ],
    [SLAB.minX, 0, SLAB.maxZ],
    [SLAB.maxX, 0, SLAB.maxZ],
  ];
  expect(zoomFor(frameFor(corners), SCREEN)).toBeLessThan(before);
});

test("the zoom fits the frame in the room left of the billboard", () => {
  const frame: Frame = { target: [0, 0, 0], halfWidth: 10, halfHeight: 5 };
  const zoom = zoomFor(frame, SCREEN);
  const room = SCREEN.width - VIEW.billboard(SCREEN.width);
  expect(zoom * 2 * frame.halfWidth).toBeLessThanOrEqual(room + 1e-6);
  expect(zoom * 2 * frame.halfHeight).toBeLessThanOrEqual(SCREEN.height + 1e-6);
  // A narrow window has no billboard room to keep.
  expect(VIEW.billboard(800)).toBe(0);
});
