// The thinking crane: while the agent works out its next question, a little tower crane
// pops up beside the next empty lot and swings a crate over it, with the agent's status
// line underneath. It folds away when the question arrives, and pops up at the next lot.
// Once every lot is settled there is no crane, and the status line waits at the bottom.
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import { Vector3, type Group } from "three";

import type { SlotId } from "../../../src/town/catalog.ts";
import type { TownState } from "../../../src/town/protocol.ts";
import { prefersReducedMotion } from "../buildings/Drop.tsx";
import { Blinker, Box, Cyl, Frame, PaintedText, STONE, Win, WOOD } from "../buildings/kit.tsx";
import { craneSpot, DEFAULT_THEME, isThinking, nextLot } from "../logic.ts";

const YELLOW = "#f2b632";
const DARK = "#2a2d36";
const MAST_HEIGHT = 5.2;
const LEVEL = 0.65;
const LEVELS = Math.round(MAST_HEIGHT / LEVEL);
const POST = 0.17;
/** Hook's cable length, before it bobs. */
const CABLE = 2.6;
/** The jib's tip, past the farthest lot centre the trolley ever reaches (about 2.6). */
const JIB_TIP = 3.3;

/** A thin beam from `a` to `b` in the plane z = `z` of its parent. */
function Strut({
  a,
  b,
  z = 0,
  w = 0.05,
}: {
  a: [number, number];
  b: [number, number];
  z?: number;
  w?: number;
}) {
  const [ax, ay] = a;
  const [bx, by] = b;
  const length = Math.hypot(bx - ax, by - ay);
  return (
    <Box
      position={[(ax + bx) / 2, (ay + by) / 2, z]}
      rotation={[0, 0, Math.atan2(by - ay, bx - ax)]}
      size={[length, w, w]}
      color={YELLOW}
      sharp
    />
  );
}

/** The lattice mast: four posts, a ring and a diagonal on each face per level. */
function Mast() {
  const faces = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
  return (
    <group>
      {[-POST, POST].flatMap((x) =>
        [-POST, POST].map((z) => (
          <Box
            key={`${x}:${z}`}
            position={[x, MAST_HEIGHT / 2, z]}
            size={[0.06, MAST_HEIGHT, 0.06]}
            color={YELLOW}
            sharp
          />
        )),
      )}
      {faces.map((turn) => (
        <group key={turn} rotation={[0, turn, 0]}>
          {Array.from({ length: LEVELS }, (_, i) => (
            <group key={i}>
              <Strut a={[-POST, i * LEVEL]} b={[POST, i * LEVEL]} z={POST} w={0.04} />
              <Strut a={[-POST, i * LEVEL]} b={[POST, (i + 1) * LEVEL]} z={POST} w={0.035} />
            </group>
          ))}
        </group>
      ))}
    </group>
  );
}

/** The turning top: cab, jib out over the lot, counter-jib with its weight, and the
 * trolley whose hook carries a crate with a "?" on it. The crane moves the trolley out to
 * the lot's centre and the hook up and down. */
function Top(props: { trolley: RefObject<Group | null>; hook: RefObject<Group | null> }) {
  const tip = JIB_TIP;
  return (
    <group>
      <Cyl position={[0, 0.07, 0]} r={0.32} h={0.14} seg={8} color={DARK} />
      <Box position={[0.05, 0.32, 0.36]} size={[0.5, 0.42, 0.36]} color={YELLOW} sharp />
      <Win position={[0.31, 0.36, 0.36]} rotation={[0, Math.PI / 2, 0]} w={0.24} h={0.2} />
      {/* Jib and counter-jib. */}
      <Box
        position={[(tip - 1.5) / 2, 0.55, 0]}
        size={[tip + 1.5, 0.14, 0.24]}
        color={YELLOW}
        sharp
      />
      <Box position={[-1.2, 0.36, 0]} size={[0.5, 0.42, 0.42]} color={STONE} sharp />
      {/* The peak and its ties. */}
      <Box position={[0, 1.05, 0]} size={[0.1, 1, 0.1]} color={YELLOW} sharp />
      <Strut a={[0, 1.5]} b={[tip, 0.62]} />
      <Strut a={[0, 1.5]} b={[-1.5, 0.62]} />
      <Blinker position={[0, 1.6, 0]} color="#ff4a3d" size={0.1} />
      <Blinker position={[tip, 0.66, 0]} color="#ff4a3d" size={0.08} phase={0.8} />
      {/* Trolley, cable and hook. */}
      <group ref={props.trolley} position={[2, 0.45, 0]}>
        <Box size={[0.3, 0.1, 0.28]} color={DARK} sharp />
        <group ref={props.hook} position={[0, -CABLE, 0]}>
          <CableAbove />
          <Box position={[0, -0.05, 0]} size={[0.14, 0.12, 0.08]} color={DARK} sharp />
          <group position={[0, -0.36, 0]}>
            <Box size={[0.5, 0.42, 0.5]} color={WOOD} sharp />
            {[0, Math.PI / 2, Math.PI, -Math.PI / 2].map((turn) => (
              <group key={turn} rotation={[0, turn, 0]}>
                <PaintedText position={[0, 0, 0.252]} text="?" w={0.4} h={0.36} ink="#fff2c9" />
              </group>
            ))}
          </group>
        </group>
      </group>
    </group>
  );
}

/** The cable from the hook up to the trolley; the hook's group moves, the cable stretches
 * with it because its height is read from the hook's position each frame. */
function CableAbove() {
  const cable = useRef<Group>(null);
  useFrame(() => {
    const group = cable.current;
    const hook = group?.parent;
    if (!group || !hook) return;
    const length = -hook.position.y;
    group.scale.y = length;
    group.position.y = length / 2;
  });
  return (
    <group ref={cable}>
      <Cyl r={0.015} h={1} seg={4} color={DARK} shadow={false} />
    </group>
  );
}

// The status label's element, moved by the crane every frame without re-rendering React.
let labelElement: HTMLDivElement | null = null;

/** How fast the crane pops up and folds away (per second, exponential). */
const POP_RATE = 7;

export function Crane({ state }: { state: TownState }) {
  const thinking = isThinking(state);
  const target = thinking ? nextLot(state) : null;
  const root = useRef<Group>(null);
  const top = useRef<Group>(null);
  const trolley = useRef<Group>(null);
  const hook = useRef<Group>(null);
  // The lot the crane stands at now; it only moves while folded away.
  const shown = useRef<SlotId | null>(null);
  const scale = useRef(0);
  const anchor = useMemo(() => new Vector3(), []);
  const still = useMemo(prefersReducedMotion, []);
  const spot = (slot: SlotId | null) => (slot ? craneSpot(slot) : null);

  useFrame(({ clock, camera, size }, delta) => {
    const group = root.current;
    if (!group) return;
    if (shown.current !== target && scale.current < 0.02) {
      shown.current = target;
      const at = spot(target);
      if (at) {
        group.position.set(at.x, 0, at.z);
        group.rotation.y = at.yaw;
        trolley.current?.position.setX(at.reach);
      }
    }
    const goal = target !== null && shown.current === target ? 1 : 0;
    scale.current += (goal - scale.current) * Math.min(1, delta * POP_RATE);
    if (goal === 0 && scale.current < 0.02) scale.current = 0;
    group.scale.setScalar(Math.max(scale.current, 0.0001));
    group.visible = scale.current > 0;

    const t = clock.elapsedTime;
    if (top.current) top.current.rotation.y = still ? 0 : Math.sin(t * 0.6) * 0.35;
    if (hook.current) hook.current.position.y = -(CABLE + (still ? 0 : Math.sin(t * 1.3) * 0.35));

    const element = labelElement;
    if (!element) return;
    // Thinking with every lot settled: no crane, so the line waits at the bottom.
    if (thinking && target === null && shown.current === null) {
      element.style.transform = `translate(${size.width / 2}px, ${size.height - 90}px)`;
      element.style.visibility = "visible";
      return;
    }
    const at = spot(shown.current);
    if (!at || scale.current < 0.6) {
      element.style.visibility = "hidden";
      return;
    }
    // Under the hook: the lot's centre, on the ground.
    anchor.set(at.x + Math.cos(at.yaw) * at.reach, 0, at.z - Math.sin(at.yaw) * at.reach);
    anchor.project(camera);
    const x = ((anchor.x + 1) / 2) * size.width;
    const y = ((1 - anchor.y) / 2) * size.height;
    element.style.transform = `translate(${x}px, ${y}px)`;
    element.style.visibility = anchor.z < 1 ? "visible" : "hidden";
  });

  return (
    <group ref={root} visible={false} scale={0.0001}>
      <Frame stage="placed" theme={DEFAULT_THEME}>
        <Box position={[0, 0.14, 0]} size={[0.8, 0.28, 0.8]} color={STONE} sharp />
        <Mast />
        <group ref={top} position={[0, MAST_HEIGHT, 0]}>
          <Top trolley={trolley} hook={hook} />
        </group>
      </Frame>
    </group>
  );
}

/** Outside the canvas: the agent's status line under the crane. */
export function CraneStatus({ state }: { state: TownState }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    labelElement = ref.current;
    return () => {
      labelElement = null;
    };
  }, []);
  const text = state.status?.trim() || "Thinking…";
  return (
    <div ref={ref} className="crane-status" role="status" aria-live="polite">
      {isThinking(state) ? <span className="crane-pill">{text}</span> : null}
    </div>
  );
}
