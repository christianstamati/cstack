// The report's signs in the town: a little checklist board for each manual step, beside the
// building it belongs to (or by the entrance road), and a yellow warning sign by the road
// for what wasn't verified. Their words show in the hover label, never in 3D.
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import type { Group } from "three";

import type { TownState } from "../../../src/town/protocol.ts";
import { prefersReducedMotion } from "../buildings/Drop.tsx";
import { Box, Cyl, Extruded, Frame, WHITE } from "../buildings/kit.tsx";
import { DEFAULT_THEME, signSpots, type SignSpot } from "../logic.ts";
import { clearHover, setHover } from "./Hover.tsx";

const POST = "#4a4f5c";
const TODO = "#4f86e0";
const WARNING = "#f2c230";
const INK = "#2a2420";
/** The signs turn to face the starting view, like the entrance sign. */
const FACING = Math.PI / 4;
/** Where the hover label points, above the board. */
const TOP = 1.25;

export function Signs({ state }: { state: TownState }) {
  const signs = useMemo(
    () => (state.phase === "done" && state.report ? signSpots(state.report, state.placements) : []),
    [state.phase, state.report, state.placements],
  );
  return (
    <>
      {signs.map((sign, i) => (
        <Sign key={`${sign.kind}:${i}`} id={`sign:${i}`} sign={sign} delay={0.4 + i * 0.12} />
      ))}
    </>
  );
}

/** Pops up after `delay` seconds (at once with reduced motion). */
function usePop(group: RefObject<Group | null>, delay: number): void {
  const born = useRef<number | null>(null);
  const done = useRef(prefersReducedMotion());
  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    if (done.current) {
      g.scale.setScalar(1);
      return;
    }
    born.current ??= clock.elapsedTime;
    const t = (clock.elapsedTime - born.current - delay) / 0.35;
    const p = Math.min(Math.max(t, 0), 1);
    // A little overshoot, then settled.
    const s = p < 1 ? Math.max(p * (1 + 0.5 * Math.sin(p * Math.PI)), 0.0001) : 1;
    g.scale.setScalar(s);
    if (p >= 1) done.current = true;
  });
}

function Sign({ id, sign, delay }: { id: string; sign: SignSpot; delay: number }) {
  const group = useRef<Group>(null);
  usePop(group, delay);
  useEffect(() => () => clearHover(id), [id]);
  const [x, z] = sign.at;
  const over = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    setHover({
      id,
      title: sign.kind === "todo" ? "To do" : "Not verified yet",
      detail: sign.lines.join(" · "),
      anchor: [x, TOP, z],
    });
  };
  const out = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    clearHover(id);
  };
  return (
    <group position={[x, 0, z]} rotation={[0, FACING, 0]}>
      <group ref={group} scale={0.0001} onPointerOver={over} onPointerOut={out}>
        <Frame stage="placed" theme={DEFAULT_THEME}>
          {sign.kind === "todo" ? <Checklist /> : <Warning />}
        </Frame>
      </group>
    </group>
  );
}

/** A blue board on a post with three ticked lines: something to do by hand. */
function Checklist() {
  return (
    <group>
      <Cyl position={[0, 0.35, 0]} r={0.03} h={0.7} seg={5} color={POST} />
      <Box position={[0, 0.82, 0]} size={[0.5, 0.42, 0.05]} color={TODO} glow={0.35} />
      {[0.12, 0, -0.12].map((dy) => (
        <group key={dy} position={[0, 0.82 + dy, 0.03]}>
          <Box position={[-0.15, 0, 0]} size={[0.06, 0.06, 0.01]} color={WHITE} glow={0.5} sharp />
          <Box position={[0.05, 0, 0]} size={[0.24, 0.035, 0.01]} color={WHITE} glow={0.5} sharp />
        </group>
      ))}
    </group>
  );
}

const TRIANGLE = [
  [-0.3, 0],
  [0.3, 0],
  [0, 0.52],
] as const;

/** A yellow warning triangle with an exclamation mark: something wasn't verified. */
function Warning() {
  return (
    <group>
      <Cyl position={[0, 0.4, 0]} r={0.03} h={0.8} seg={5} color={POST} />
      <Extruded position={[0, 0.66, 0]} points={TRIANGLE} depth={0.05} color={WARNING} glow={0.4} />
      <Box position={[0, 0.88, 0.03]} size={[0.05, 0.16, 0.01]} color={INK} sharp />
      <Box position={[0, 0.76, 0.03]} size={[0.05, 0.05, 0.01]} color={INK} sharp />
    </group>
  );
}
