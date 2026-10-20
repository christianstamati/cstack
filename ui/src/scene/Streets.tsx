// The city's streets and blocks, built as the answers come in. When a block is taken its
// streets are paved piece by piece, outward from the roads already there (the first ones
// from the slab's edge), then their lane markings are painted and crosswalks appear where
// three streets meet. The block itself rises with its sidewalk, street lamps, trees in
// planters and a bench. Nothing is torn down: re-answering a slot only swaps its building.
import { useFrame } from "@react-three/fiber";
import { memo, useEffect, useMemo, useRef } from "react";
import {
  AdditiveBlending,
  BoxGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SRGBColorSpace,
  type Group,
  type Mesh,
} from "three";

import type { TownState } from "../../../src/town/protocol.ts";
import { prefersReducedMotion } from "../buildings/Drop.tsx";
import { FOUNTAIN_SPOT, seededRandom } from "../logic.ts";
import {
  assignBlocks,
  blockCentre,
  builtStreets,
  crossings,
  GRID,
  pavingOrder,
  PITCH,
  segmentKey,
  type Cell,
  type Point,
  type Segment,
} from "../streets.ts";
import { useNight } from "./daylight.ts";
import { useLightsUp } from "./finale.ts";
import { CITY } from "./palette.ts";

/** Height of a block's sidewalk: buildings on a block stand on it. */
export const BLOCK_TOP = 0.12;
const ROAD_TOP = 0.03;
/** Seconds to lay one piece of street, between pieces, and to paint its markings. */
const LAY = 0.32;
const STEP = 0.2;
const PAINT = 0.25;
const RISE = 0.4;
const HALF = PITCH / 2;
const now = () => performance.now() / 1000;
const clamp01 = (t: number) => Math.min(Math.max(t, 0), 1);

// When each piece of street is fully paved (seconds on `performance.now`), for the cars.
const pavedAt = new Map<string, number>();

/** Is the street piece with this key paved and open to traffic? */
export function isPaved(key: string, at = now()): boolean {
  const time = pavedAt.get(key);
  return time !== undefined && time <= at;
}

/** When the piece with this key is (or will be) paved; undefined if it isn't planned. */
export function pavedTime(key: string): number | undefined {
  return pavedAt.get(key);
}

// Shared by every piece: built once for the page.
const UNIT = new BoxGeometry(1, 1, 1);
const ASPHALT = new MeshStandardMaterial({
  color: CITY.asphalt,
  roughness: 0.95,
  flatShading: true,
});
const MARKING = new MeshStandardMaterial({
  color: CITY.marking,
  emissive: CITY.marking,
  emissiveIntensity: 0.12,
  roughness: 0.8,
});
const SIDEWALK = new MeshStandardMaterial({
  color: CITY.sidewalk,
  roughness: 0.9,
  flatShading: true,
});
const LAWN = new MeshStandardMaterial({ color: CITY.lawn, roughness: 1, flatShading: true });
const PLAZA = new MeshStandardMaterial({ color: CITY.plaza, roughness: 0.9, flatShading: true });
const POST = new MeshStandardMaterial({ color: CITY.post, roughness: 0.6, flatShading: true });
const PLANTER = new MeshStandardMaterial({
  color: CITY.planter,
  roughness: 0.9,
  flatShading: true,
});
const TRUNK = new MeshStandardMaterial({ color: CITY.trunk, roughness: 0.9, flatShading: true });
const BENCH = new MeshStandardMaterial({ color: CITY.bench, roughness: 0.8, flatShading: true });
const LEAVES = CITY.leaves.map(
  (color) => new MeshStandardMaterial({ color, roughness: 0.9, flatShading: true }),
);
/** Lamp heads: pale by day, warm and bright at night. Each block draws its lamps with its
 * own copies of these two. */
const LAMP_HEAD = new MeshStandardMaterial({ color: "#f4f1e6", flatShading: true });
const LAMP_DAY = new Color("#f4f1e6");
const LAMP_NIGHT = new Color("#ffd98a");
/** The pool of light under a lamp at night. */
const LAMP_POOL = new MeshBasicMaterial({
  color: "#ffcf7a",
  transparent: true,
  opacity: 0,
  depthWrite: false,
  blending: AdditiveBlending,
  toneMapped: false,
});
const POOL = new CircleGeometry(0.9, 16).rotateX(-Math.PI / 2);

let zebra: MeshStandardMaterial | null = null;

/** White bars across a street, drawn once on a canvas. */
function zebraMaterial(): MeshStandardMaterial {
  if (zebra) return zebra;
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 16;
  const context = canvas.getContext("2d");
  if (context) {
    context.fillStyle = CITY.marking;
    for (let x = 4; x < 128; x += 18) context.fillRect(x, 0, 10, 16);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  zebra = new MeshStandardMaterial({ map: texture, transparent: true, roughness: 0.8 });
  return zebra;
}

/** A node where streets cross (odd half-pitch steps along both x and z). */
function isCrossingNode([x, z]: Point): boolean {
  const odd = (value: number) => {
    const steps = Math.round(value / HALF);
    return Math.abs(value / HALF - steps) < 1e-6 && Math.abs(steps % 2) === 1;
  };
  return odd(x) && odd(z);
}

interface Piece {
  key: string;
  /** The axis the street runs along, and where it sits on the other one. */
  axis: "x" | "z";
  across: number;
  /** Where the asphalt starts (the end it is laid from) and ends, along the axis. */
  from: number;
  to: number;
  /** Centres of its lane-marking dashes, along the axis. */
  dashes: number[];
  start: number;
}

const DASH = 0.42;
const DASH_EVERY = 0.9;
/** Room kept clear of dashes next to a crossing, for the crossing and its crosswalk. */
const CROSSING_CLEAR = GRID.street / 2 + 0.6;

function pieceOf(segment: Segment, from: Point, start: number): Piece {
  const { a, b } = segment;
  const axis = a[1] === b[1] ? "x" : "z";
  const along = (p: Point) => (axis === "x" ? p[0] : p[1]);
  const [lo, hi] = [along(a), along(b)];
  // At a crossing the asphalt runs on over the crossing's square.
  const loPad = isCrossingNode(a) ? GRID.street / 2 : 0;
  const hiPad = isCrossingNode(b) ? GRID.street / 2 : 0;
  const fromA = from[0] === a[0] && from[1] === a[1];
  // Dashes every DASH_EVERY from a plain end, clear of crossings.
  const dashes: number[] = [];
  const first = isCrossingNode(a) ? lo + CROSSING_CLEAR : lo;
  const last = isCrossingNode(b) ? hi - CROSSING_CLEAR : hi;
  const anchor = isCrossingNode(b) && !isCrossingNode(a) ? lo : hi;
  const direction = anchor === lo ? 1 : -1;
  for (let c = anchor + (direction * DASH_EVERY) / 2; c > lo && c < hi; c += direction * DASH_EVERY)
    if (c - DASH / 2 >= first - 1e-6 && c + DASH / 2 <= last + 1e-6) dashes.push(c);
  return {
    key: segmentKey(segment),
    axis,
    across: axis === "x" ? a[1] : a[0],
    from: fromA ? lo - loPad : hi + hiPad,
    to: fromA ? hi + hiPad : lo - loPad,
    dashes,
    start,
  };
}

/** Sets a unit box's transform to cover `from`..`to` along the axis, `width` across. */
function stretch(
  mesh: Mesh,
  piece: Piece,
  from: number,
  to: number,
  width: number,
  y: number,
  h: number,
) {
  const middle = (from + to) / 2;
  const length = Math.max(Math.abs(to - from), 0.0001);
  if (piece.axis === "x") {
    mesh.position.set(middle, y, piece.across);
    mesh.scale.set(length, h, width);
  } else {
    mesh.position.set(piece.across, y, middle);
    mesh.scale.set(width, h, length);
  }
}

const RoadPiece = memo(function RoadPiece({ piece }: { piece: Piece }) {
  const road = useRef<Mesh>(null);
  const dashes = useRef<Array<Mesh | null>>([]);
  const done = useRef(false);
  useFrame(() => {
    if (done.current || !road.current) return;
    const t = now() - piece.start;
    const laid = clamp01(t / LAY);
    const painted = clamp01((t - LAY) / PAINT);
    stretch(
      road.current,
      piece,
      piece.from,
      piece.from + (piece.to - piece.from) * laid,
      GRID.street,
      ROAD_TOP / 2,
      ROAD_TOP,
    );
    road.current.visible = laid > 0;
    piece.dashes.forEach((centre, i) => {
      const dash = dashes.current[i];
      if (!dash) return;
      const half = (DASH / 2) * painted;
      stretch(dash, piece, centre - half, centre + half, 0.08, ROAD_TOP + 0.003, 0.006);
      dash.visible = painted > 0;
    });
    if (laid === 1 && painted === 1) done.current = true;
  });
  return (
    <group>
      <mesh ref={road} geometry={UNIT} material={ASPHALT} visible={false} receiveShadow />
      {piece.dashes.map((centre, i) => (
        <mesh
          key={centre}
          ref={(mesh) => void (dashes.current[i] = mesh)}
          geometry={UNIT}
          material={MARKING}
          visible={false}
        />
      ))}
    </group>
  );
});

/** Zebra stripes across one street leaving a crossing, popping up once it's paved. */
const Crosswalk = memo(function Crosswalk(props: {
  at: Point;
  arm: [number, number];
  ready: number;
}) {
  const group = useRef<Group>(null);
  const done = useRef(false);
  const material = useMemo(zebraMaterial, []);
  useFrame(() => {
    if (done.current || !group.current) return;
    const t = clamp01((now() - props.ready) / 0.3);
    group.current.scale.setScalar(Math.max(t, 0.0001));
    group.current.visible = t > 0;
    if (t === 1) done.current = true;
  });
  const [dx, dz] = props.arm;
  const offset = GRID.street / 2 + 0.3;
  return (
    <group
      ref={group}
      position={[props.at[0] + dx * offset, ROAD_TOP + 0.004, props.at[1] + dz * offset]}
      rotation={[0, dx !== 0 ? Math.PI / 2 : 0, 0]}
      visible={false}
    >
      <mesh rotation={[-Math.PI / 2, 0, 0]} material={material}>
        <planeGeometry args={[GRID.street - 0.2, 0.42]} />
      </mesh>
    </group>
  );
});

export function Streets({ state }: { state: TownState }) {
  const placements = state.placements;
  const segments = useMemo(() => builtStreets(placements), [placements]);
  const timing = useRef(new Map<string, { start: number; from: Point }>());
  const before = useRef<Segment[] | null>(null);
  const pieces = useMemo(() => {
    const at = now();
    // What's there when the page opens is already built; with reduced motion, so is the rest.
    if (before.current === null || prefersReducedMotion()) {
      for (const segment of segments)
        timing.current.set(segmentKey(segment), { start: -Infinity, from: segment.a });
    } else {
      for (const { segment, from, step } of pavingOrder(before.current, segments))
        if (!timing.current.has(segmentKey(segment)))
          timing.current.set(segmentKey(segment), { start: at + step * STEP, from });
    }
    before.current = segments;
    return segments.map((segment) => {
      const { start, from } = timing.current.get(segmentKey(segment))!;
      pavedAt.set(segmentKey(segment), start + LAY);
      return pieceOf(segment, from, start);
    });
  }, [segments]);
  // A crosswalk appears once the last street into its crossing is laid.
  const walks = useMemo(() => {
    const ends = new Map<string, number>();
    for (const segment of segments) {
      const laid = timing.current.get(segmentKey(segment))!.start + LAY;
      for (const p of [segment.a, segment.b]) {
        const key = `${p[0].toFixed(3)},${p[1].toFixed(3)}`;
        ends.set(key, Math.max(ends.get(key) ?? -Infinity, laid));
      }
    }
    return crossings(segments).flatMap(({ at, arms }) =>
      arms.map((arm) => ({
        key: `${at.join(",")}>${arm.join(",")}`,
        at,
        arm,
        ready: (ends.get(`${at[0].toFixed(3)},${at[1].toFixed(3)}`) ?? 0) + PAINT,
      })),
    );
    // `pieces` is worked out from the same segments, and fills `timing` first.
  }, [pieces, segments]);
  return (
    <group>
      {pieces.map((piece) => (
        <RoadPiece key={piece.key} piece={piece} />
      ))}
      {walks.map((walk) => (
        <Crosswalk key={walk.key} at={walk.at} arm={walk.arm} ready={walk.ready} />
      ))}
    </group>
  );
}

/** A block's own lamp materials (a lamp head, its pool of light), so the finale can light
 * each block's lamps in turn. */
interface LampLook {
  head: MeshStandardMaterial;
  pool: MeshBasicMaterial;
}

function Lamp({ x, z, look }: { x: number; z: number; look: LampLook }) {
  // The arm reaches over the street from the corner of the block.
  const turn = Math.atan2(Math.sign(x), Math.sign(z));
  return (
    <group position={[x, BLOCK_TOP, z]} rotation={[0, turn, 0]}>
      <mesh
        geometry={UNIT}
        material={POST}
        position={[0, 0.65, 0]}
        scale={[0.07, 1.3, 0.07]}
        castShadow
      />
      <mesh geometry={UNIT} material={POST} position={[0, 1.3, 0.16]} scale={[0.05, 0.05, 0.36]} />
      <mesh
        geometry={UNIT}
        material={look.head}
        position={[0, 1.25, 0.32]}
        scale={[0.16, 0.08, 0.2]}
      />
      <mesh geometry={POOL} material={look.pool} position={[0, 0.01, 0.35]} />
    </group>
  );
}

function PlanterTree({ x, z, leaves }: { x: number; z: number; leaves: number }) {
  return (
    <group position={[x, BLOCK_TOP, z]}>
      <mesh material={PLANTER} position={[0, 0.09, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.26, 0.24, 0.18, 8]} />
      </mesh>
      <mesh material={TRUNK} position={[0, 0.4, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.07, 0.5, 5]} />
      </mesh>
      <mesh material={LEAVES[leaves % LEAVES.length]} position={[0, 0.85, 0]} castShadow>
        <icosahedronGeometry args={[0.38, 0]} />
      </mesh>
    </group>
  );
}

function Bench({ x, z, turn }: { x: number; z: number; turn: number }) {
  return (
    <group position={[x, BLOCK_TOP, z]} rotation={[0, turn, 0]}>
      <mesh
        geometry={UNIT}
        material={BENCH}
        position={[0, 0.2, 0]}
        scale={[0.6, 0.05, 0.2]}
        castShadow
      />
      <mesh
        geometry={UNIT}
        material={BENCH}
        position={[0, 0.33, -0.09]}
        scale={[0.6, 0.16, 0.04]}
        castShadow
      />
      {[-0.24, 0.24].map((leg) => (
        <mesh
          key={leg}
          geometry={UNIT}
          material={POST}
          position={[leg, 0.09, 0]}
          scale={[0.05, 0.18, 0.18]}
        />
      ))}
    </group>
  );
}

/** A placed block: it rises with its sidewalk and lawn, then its lamps, trees and bench
 * pop up. */
const Block = memo(function Block({ cell, born }: { cell: Cell; born: number }) {
  const base = useRef<Group>(null);
  const extras = useRef<Group>(null);
  const done = useRef(false);
  const lamps = useMemo<LampLook>(() => ({ head: LAMP_HEAD.clone(), pool: LAMP_POOL.clone() }), []);
  useEffect(
    () => () => {
      lamps.head.dispose();
      lamps.pool.dispose();
    },
    [lamps],
  );
  // Warm and bright at night; brighter still when the finale lights the town up.
  const night = useRef(0);
  const lit = useRef(1);
  const paint = () => {
    const glow = night.current * lit.current;
    lamps.head.color.lerpColors(LAMP_DAY, LAMP_NIGHT, Math.min(glow, 1));
    lamps.head.emissive.copy(lamps.head.color);
    lamps.head.emissiveIntensity = 0.1 + glow * 1.6;
    lamps.pool.opacity = Math.min(glow * 0.32, 0.42);
  };
  useNight((value) => {
    night.current = value;
    paint();
  });
  useLightsUp(base, (level) => {
    lit.current = level;
    paint();
  });
  useFrame(() => {
    if (done.current || !base.current || !extras.current) return;
    const t = now() - born;
    const rise = clamp01(t / RISE);
    const pop = clamp01((t - RISE * 0.6) / 0.35);
    base.current.scale.set(1, Math.max(rise, 0.0001), 1);
    extras.current.scale.setScalar(Math.max(pop, 0.0001));
    extras.current.visible = pop > 0;
    if (rise === 1 && pop === 1) done.current = true;
  });
  const [x, z] = blockCentre(cell);
  const random = seededRandom(97 + (cell[0] + 5) * 13 + (cell[1] + 5) * 7);
  const edge = GRID.block / 2 - 0.27;
  // Lamps on two opposite corners, trees in planters on the other two; mirrored per block.
  const flip = (cell[0] + cell[1]) % 2 === 0 ? 1 : -1;
  const inner = GRID.block - 1;
  return (
    <group position={[x, 0, z]}>
      <group ref={base}>
        <mesh
          geometry={UNIT}
          material={SIDEWALK}
          position={[0, BLOCK_TOP / 2, 0]}
          scale={[GRID.block, BLOCK_TOP, GRID.block]}
          receiveShadow
          castShadow
        />
        <mesh
          geometry={UNIT}
          material={LAWN}
          position={[0, BLOCK_TOP + 0.01, 0]}
          scale={[inner, 0.02, inner]}
          receiveShadow
        />
      </group>
      <group ref={extras} visible={false}>
        <Lamp x={edge * flip} z={edge} look={lamps} />
        <Lamp x={-edge * flip} z={-edge} look={lamps} />
        <PlanterTree x={-edge * flip} z={edge} leaves={Math.floor(random() * 5)} />
        <PlanterTree x={edge * flip} z={-edge} leaves={Math.floor(random() * 5)} />
        <Bench x={(random() < 0.5 ? -1 : 1) * 1.0} z={edge + 0.02} turn={0} />
      </group>
    </group>
  );
});

/** The blocks taken so far, and the fountain's square once the paint is chosen. */
export function Blocks({ state }: { state: TownState }) {
  const first = useRef<Set<string> | null>(null);
  const born = useRef(new Map<string, number>());
  const cells = Object.values(assignBlocks(state.placements));
  first.current ??= new Set(cells.map((cell) => cell.join(",")));
  for (const cell of cells) {
    const key = cell.join(",");
    if (!born.current.has(key))
      born.current.set(key, first.current.has(key) || prefersReducedMotion() ? -Infinity : now());
  }
  return (
    <group>
      {cells.map((cell) => (
        <Block key={cell.join(",")} cell={cell} born={born.current.get(cell.join(","))!} />
      ))}
      {state.placements.ui ? (
        <mesh material={PLAZA} position={[FOUNTAIN_SPOT[0], 0.03, FOUNTAIN_SPOT[1]]} receiveShadow>
          <cylinderGeometry args={[1.45, 1.5, 0.06, 20]} />
        </mesh>
      ) : null}
    </group>
  );
}
