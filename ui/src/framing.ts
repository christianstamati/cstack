// What the camera frames: the part of the town built so far (its blocks, the entrance sign,
// placed props on the green) and the lot the crane works on next, seen from the starting
// isometric view. Close on the entrance on bare land, zooming out as the city grows. Pure,
// so it can be tested; the camera eases towards it.
import type { SlotId } from "../../src/town/catalog.ts";
import type { Placement } from "../../src/town/protocol.ts";
import { EXTRA_SPOTS, FOUNTAIN_SPOT, LOT_SIZE, NAME_SPOT } from "./logic.ts";
import { assignBlocks, blockCentre, GRID, SLAB, type Point } from "./streets.ts";

type Vec3 = [x: number, y: number, z: number];

/** The starting view: from the entrance corner (+x, +z), about 35° above the horizon. */
const AZIMUTH = Math.PI / 4;
const POLAR = 0.96;

/** The view's axes and the room the page's HUD takes. */
export const VIEW = {
  azimuth: AZIMUTH,
  polar: POLAR,
  /** From the target towards the camera. */
  back: [
    Math.sin(POLAR) * Math.sin(AZIMUTH),
    Math.cos(POLAR),
    Math.sin(POLAR) * Math.cos(AZIMUTH),
  ] as Vec3,
  /** Screen right and screen up, in the world. */
  right: [Math.cos(AZIMUTH), 0, -Math.sin(AZIMUTH)] as Vec3,
  up: [
    -Math.cos(POLAR) * Math.sin(AZIMUTH),
    Math.sin(POLAR),
    -Math.cos(POLAR) * Math.cos(AZIMUTH),
  ] as Vec3,
  /** Pixels the billboard takes on the right (see .billboard in styles.css); none on
   * narrow windows, where it covers the town anyway. */
  billboard: (width: number) => (width >= 900 ? Math.min(390, width - 60) + 30 + 16 : 0),
  /** Pixels the HUD keeps at the top (status pills) and bottom (credits, docked status). */
  top: 64,
  bottom: 90,
} as const;

export interface Frame {
  /** Where the camera looks: the middle of the frame, just above the ground. */
  target: Vec3;
  /** Half the frame's size, across and up the screen, in world units. */
  halfWidth: number;
  halfHeight: number;
}

/** How tall things get: buildings with their logo signs, and the crane. */
const ROOF = 5;
const CRANE_TOP = 7;
/** The least a frame shows, so one sign or block isn't blown up to fill the page. */
const MIN_HALF_WIDTH = 11;
const MIN_HALF_HEIGHT = 7;
/** Room left round what's framed. */
const MARGIN = 1.2;
const TARGET_HEIGHT = 0.8;

function box([x, z]: Point, half: number, top: number): Vec3[] {
  const corners: Vec3[] = [];
  for (const dx of [-half, half])
    for (const dz of [-half, half]) for (const y of [0, top]) corners.push([x + dx, y, z + dz]);
  return corners;
}

/** The points to frame: the entrance sign, every block taken, props and the fountain on the
 * green once placed, and the lot the crane works on next (`next`, if any). */
export function framePoints(
  placements: Partial<Record<SlotId, Placement>>,
  next: Point | null,
): Vec3[] {
  const points: Vec3[] = box(NAME_SPOT, 1.6, 3);
  for (const cell of Object.values(assignBlocks(placements)))
    points.push(...box(blockCentre(cell), GRID.block / 2, ROOF));
  if (placements.ui) points.push(...box(FOUNTAIN_SPOT, 1.6, 2.5));
  for (const id of placements.extras?.optionIds ?? [])
    if (Object.hasOwn(EXTRA_SPOTS, id)) points.push(...box(EXTRA_SPOTS[id]!, 1, 4.5));
  if (next) points.push(...box(next, LOT_SIZE / 2 + 0.3, CRANE_TOP));
  return points;
}

const dot = (a: readonly number[], b: readonly number[]) =>
  a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;

/** The smallest frame (from the starting view) round `points`, with a margin. */
export function frameFor(points: Vec3[]): Frame {
  let [minR, maxR, minU, maxU] = [Infinity, -Infinity, Infinity, -Infinity];
  for (const p of points) {
    const r = dot(p, VIEW.right);
    const u = dot(p, VIEW.up);
    [minR, maxR, minU, maxU] = [
      Math.min(minR, r),
      Math.max(maxR, r),
      Math.min(minU, u),
      Math.max(maxU, u),
    ];
  }
  const [r, u] = [(minR + maxR) / 2, (minU + maxU) / 2];
  // The frame's middle, slid along the view line to just above the ground.
  const middle: Vec3 = [
    VIEW.right[0] * r + VIEW.up[0] * u,
    VIEW.right[1] * r + VIEW.up[1] * u,
    VIEW.right[2] * r + VIEW.up[2] * u,
  ];
  const slide = (TARGET_HEIGHT - middle[1]) / VIEW.back[1];
  return {
    target: [middle[0] + VIEW.back[0] * slide, TARGET_HEIGHT, middle[2] + VIEW.back[2] * slide],
    halfWidth: Math.max((maxR - minR) / 2 + MARGIN, MIN_HALF_WIDTH),
    halfHeight: Math.max((maxU - minU) / 2 + MARGIN, MIN_HALF_HEIGHT),
  };
}

/** The zoom (pixels per world unit) that fits `frame` into the page, left of the billboard
 * and between the HUD's strips. */
export function zoomFor(frame: Frame, size: { width: number; height: number }): number {
  const free = Math.max(size.width - VIEW.billboard(size.width), 320);
  const tall = Math.max(size.height - VIEW.top - VIEW.bottom, 240);
  return Math.min(free / (2 * frame.halfWidth), tall / (2 * frame.halfHeight));
}

/** The frame round the whole slab: the furthest the camera zooms out to by itself. */
export const SLAB_FRAME: Frame = frameFor(
  [SLAB.minX, SLAB.maxX].flatMap((x) => [SLAB.minZ, SLAB.maxZ].map((z): Vec3 => [x, 0, z])),
);
