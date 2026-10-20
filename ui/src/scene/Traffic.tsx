// A few small cars driving round the built streets once two blocks stand: they come in by
// the entrance road, keep to the right-hand lane, wander from crossing to crossing, queue
// behind each other and take turns at crossings. Headlights come on at night. One frame
// loop moves them all, without allocating.
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import {
  AdditiveBlending,
  BoxGeometry,
  Color,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  type Group,
} from "three";

import type { TownState } from "../../../src/town/protocol.ts";
import { seededRandom } from "../logic.ts";
import {
  builtStreets,
  carCount,
  ENTRANCE,
  ENTRANCE_EDGE,
  GRID,
  segmentKey,
  type Point,
} from "../streets.ts";
import { useNight } from "./daylight.ts";
import { isPaved } from "./Streets.tsx";

const COLORS = ["#ff8f7a", "#8cc8f0", "#ffd86b", "#8fdcb6", "#c3a6f0", "#f5f2ea"];
const SPEED = 1.7;
/** How far right of the centre-line cars drive. */
const LANE = GRID.street / 4;
/** Room kept to the car in front, and around a crossing. */
const GAP = 1.0;
const CROSSING = GRID.street / 2 + 0.35;
/** After waiting this long, a car stops waiting (so nothing ever locks up for good). */
const PATIENCE = 4;
const CAR_Y = 0.04;

const UNIT = new BoxGeometry(1, 1, 1);
const WHEEL = new MeshStandardMaterial({ color: "#3a3d48", roughness: 0.8, flatShading: true });
const GLASS = new MeshStandardMaterial({ color: "#cfe7f2", roughness: 0.3, flatShading: true });
const HEADLIGHT = new MeshStandardMaterial({ color: "#fff6d8", flatShading: true });
const HEAD_DAY = new Color("#e9e6dc");
const HEAD_NIGHT = new Color("#fff2c2");
const BEAM = new MeshBasicMaterial({
  color: "#ffe9a8",
  transparent: true,
  opacity: 0,
  depthWrite: false,
  blending: AdditiveBlending,
  toneMapped: false,
});
const BEAM_SHAPE = new PlaneGeometry(0.5, 0.9).rotateX(-Math.PI / 2);
const BODIES = COLORS.map(
  (color) => new MeshStandardMaterial({ color, roughness: 0.6, flatShading: true }),
);

const key = ([x, z]: Point) => `${x.toFixed(3)},${z.toFixed(3)}`;
const EDGE_KEY = key(ENTRANCE_EDGE);
const ENTRANCE_ROAD = segmentKey({ a: ENTRANCE, b: ENTRANCE_EDGE });

interface Car {
  from: Point;
  to: Point;
  fromKey: string;
  toKey: string;
  /** Distance travelled from `from`. */
  travelled: number;
  length: number;
  /** The crossing this car is in (or about to enter), if it holds it. */
  holding: string | null;
  waited: number;
  heading: number;
}

/** A small low-poly car facing +z: body, cabin, wheels and headlights. */
function CarModel({ index }: { index: number }) {
  const body = BODIES[index % BODIES.length]!;
  return (
    <group>
      <mesh
        geometry={UNIT}
        material={body}
        position={[0, 0.17, 0]}
        scale={[0.42, 0.17, 0.84]}
        castShadow
      />
      <mesh
        geometry={UNIT}
        material={body}
        position={[0, 0.32, -0.06]}
        scale={[0.36, 0.14, 0.44]}
        castShadow
      />
      <mesh geometry={UNIT} material={GLASS} position={[0, 0.32, 0.17]} scale={[0.32, 0.1, 0.02]} />
      {[-0.22, 0.22].flatMap((x) =>
        [-0.26, 0.26].map((z) => (
          <mesh
            key={`${x}${z}`}
            geometry={UNIT}
            material={WHEEL}
            position={[x, 0.08, z]}
            scale={[0.06, 0.15, 0.15]}
          />
        )),
      )}
      {[-0.13, 0.13].map((x) => (
        <mesh
          key={x}
          geometry={UNIT}
          material={HEADLIGHT}
          position={[x, 0.19, 0.425]}
          scale={[0.09, 0.05, 0.02]}
        />
      ))}
      <mesh geometry={BEAM_SHAPE} material={BEAM} position={[0, 0.005, 0.9]} />
    </group>
  );
}

/** A street leaving a node: where it goes, that node's key and the street's key. */
interface Way {
  to: Point;
  toKey: string;
  road: string;
}

/** Reused by `turnOnto`, so turning never allocates. */
const choices: Way[] = [];

/** At the end of its street: on to a paved street with room at its start, not back the
 * way it came unless that's the only way; or wait there. An impatient car stops minding
 * the room. */
function turnOnto(
  car: Car,
  list: Car[],
  graph: Map<string, Way[]>,
  random: () => number,
  patient: boolean,
): void {
  choices.length = 0;
  let back: Way | null = null;
  for (const way of graph.get(car.toKey) ?? []) {
    if (!isPaved(way.road)) continue;
    let room = true;
    if (patient)
      for (const other of list)
        if (
          other !== car &&
          other.fromKey === car.toKey &&
          other.toKey === way.toKey &&
          other.travelled < GAP
        )
          room = false;
    if (!room) continue;
    if (way.toKey === car.fromKey) back = way;
    else choices.push(way);
  }
  if (choices.length === 0 && back) choices.push(back);
  if (choices.length === 0) {
    car.travelled = car.length;
    return;
  }
  const next = choices[Math.floor(random() * choices.length)]!;
  car.from = car.to;
  car.fromKey = car.toKey;
  car.to = next.to;
  car.toKey = next.toKey;
  car.travelled = 0;
  car.length = Math.abs(next.to[0] - car.from[0]) + Math.abs(next.to[1] - car.from[1]);
}

export function Traffic({ state }: { state: TownState }) {
  const count = carCount(state.placements);
  const segments = useMemo(() => builtStreets(state.placements), [state.placements]);
  // Who's next to whom, on the city's streets (not the entrance road: cars only come in).
  const graph = useMemo(() => {
    const next = new Map<string, Way[]>();
    for (const segment of segments) {
      const [aKey, bKey] = [key(segment.a), key(segment.b)];
      if (aKey === EDGE_KEY || bKey === EDGE_KEY) continue;
      const road = segmentKey(segment);
      next.set(aKey, [...(next.get(aKey) ?? []), { to: segment.b, toKey: bKey, road }]);
      next.set(bKey, [...(next.get(bKey) ?? []), { to: segment.a, toKey: aKey, road }]);
    }
    return next;
  }, [segments]);
  const crossingsHeld = useRef(new Map<string, Car>());
  const cars = useRef<Car[]>([]);
  const groups = useRef<Array<Group | null>>([]);
  const random = useMemo(() => seededRandom(5), []);

  useNight((night) => {
    HEADLIGHT.color.lerpColors(HEAD_DAY, HEAD_NIGHT, night);
    HEADLIGHT.emissive.copy(HEADLIGHT.color);
    HEADLIGHT.emissiveIntensity = night * 1.8;
    BEAM.opacity = night * 0.35;
  });

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.1);
    const list = cars.current;
    const held = crossingsHeld.current;
    // New cars drive in from the slab's edge, one at a time.
    while (list.length < count) {
      let entering = false;
      for (const car of list)
        if (car.fromKey === EDGE_KEY && car.travelled < 2 * GAP) entering = true;
      if (entering || !isPaved(ENTRANCE_ROAD)) break;
      list.push({
        from: ENTRANCE_EDGE,
        to: ENTRANCE,
        fromKey: EDGE_KEY,
        toKey: key(ENTRANCE),
        travelled: 0,
        length: ENTRANCE_EDGE[1] - ENTRANCE[1],
        holding: null,
        waited: 0,
        heading: Math.PI,
      });
    }
    list.length = Math.min(list.length, count);

    for (let index = 0; index < list.length; index++) {
      const car = list[index]!;
      const patient = car.waited < PATIENCE;
      // Waiting at the end of its street for a way on: no moving, and patience runs out.
      let move = car.travelled >= car.length ? 0 : SPEED * delta;
      // Queue behind the car in front on the same lane.
      for (const other of list) {
        if (other === car || other.fromKey !== car.fromKey || other.toKey !== car.toKey) continue;
        const ahead = other.travelled - car.travelled;
        if (ahead > 0 && patient) move = Math.min(move, Math.max(ahead - GAP, 0));
      }
      // Take turns at crossings: hold the crossing ahead before driving into it.
      const isCrossing = (graph.get(car.toKey)?.length ?? 0) >= 3;
      if (isCrossing && car.length - car.travelled - move < CROSSING && car.holding !== car.toKey) {
        const holder = held.get(car.toKey);
        if (holder && holder !== car && list.includes(holder) && patient) move = 0;
        else {
          held.set(car.toKey, car);
          car.holding = car.toKey;
        }
      }
      car.travelled = Math.min(car.travelled + move, car.length);
      car.waited = move < SPEED * delta * 0.2 ? car.waited + delta : 0;
      if (car.travelled >= car.length) {
        const at = car.toKey;
        turnOnto(car, list, graph, random, patient);
        // Turned onto a new street: the wait is over.
        if (car.fromKey === at) car.waited = 0;
      }
      // Leave the crossing behind once past it.
      if (car.holding && car.holding !== car.toKey && car.travelled > CROSSING) {
        if (held.get(car.holding) === car) held.delete(car.holding);
        car.holding = null;
      }

      const group = groups.current[index];
      if (!group) continue;
      const dx = Math.sign(car.to[0] - car.from[0]);
      const dz = Math.sign(car.to[1] - car.from[1]);
      const t = car.length > 0 ? car.travelled / car.length : 0;
      // Right-hand lane: right of travel is (-dz, dx).
      group.position.set(
        car.from[0] + (car.to[0] - car.from[0]) * t - dz * LANE,
        CAR_Y,
        car.from[1] + (car.to[1] - car.from[1]) * t + dx * LANE,
      );
      let turn = Math.atan2(dx, dz) - car.heading;
      turn = Math.atan2(Math.sin(turn), Math.cos(turn));
      car.heading += turn * Math.min(1, delta * 9);
      group.rotation.y = car.heading;
      group.visible = true;
    }
    for (let i = list.length; i < groups.current.length; i++) {
      const group = groups.current[i];
      if (group) group.visible = false;
    }
  });

  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <group key={i} ref={(g) => void (groups.current[i] = g)} visible={false}>
          <CarModel index={i} />
        </group>
      ))}
    </>
  );
}
