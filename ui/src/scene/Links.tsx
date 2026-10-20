// Glowing cables arching between buildings that depend on each other (see
// src/town/links.ts), with a spark of light running along each one.
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { QuadraticBezierCurve3, Vector3, type Mesh, type MeshBasicMaterial } from "three";

import { slotById, type SlotId } from "../../../src/town/catalog.ts";
import { activeLinks } from "../../../src/town/links.ts";
import type { TownState } from "../../../src/town/protocol.ts";

const CABLE = "#8fd3ff";
const SPARK = "#e6f6ff";
/** Seconds for a cable to fade in, after both buildings have landed. */
const FADE_IN = 1.2;
const DELAY = 0.6;

/** An arc from lot `a` to lot `b`: it rises from the ground next to each building and
 * peaks higher the further apart they are. */
function arc(a: SlotId, b: SlotId): QuadraticBezierCurve3 {
  const [ax, az] = slotById(a).lot;
  const [bx, bz] = slotById(b).lot;
  const length = Math.hypot(bx - ax, bz - az);
  const dx = (bx - ax) / length;
  const dz = (bz - az) / length;
  const inset = Math.min(1.3, length / 3);
  return new QuadraticBezierCurve3(
    new Vector3(ax + dx * inset, 0.1, az + dz * inset),
    new Vector3((ax + bx) / 2, 2.2 + length * 0.22, (az + bz) / 2),
    new Vector3(bx - dx * inset, 0.1, bz - dz * inset),
  );
}

function Link({ a, b, index }: { a: SlotId; b: SlotId; index: number }) {
  const curve = useMemo(() => arc(a, b), [a, b]);
  const tube = useMemo(() => [curve, 32, 0.035, 5, false] as const, [curve]);
  const spark = useRef<Mesh>(null);
  const cable = useRef<MeshBasicMaterial>(null);
  const born = useRef<number | null>(null);
  const point = useMemo(() => new Vector3(), []);
  useFrame(({ clock }) => {
    born.current ??= clock.elapsedTime;
    const age = clock.elapsedTime - born.current - DELAY;
    const fade = Math.min(Math.max(age / FADE_IN, 0), 1);
    if (cable.current) cable.current.opacity = 0.35 * fade;
    if (spark.current) {
      const t = (clock.elapsedTime * 0.3 + index * 0.37) % 1;
      curve.getPoint(t, point);
      spark.current.position.copy(point);
      spark.current.visible = fade > 0.5;
    }
  });
  return (
    <group>
      <mesh>
        <tubeGeometry args={tube} />
        <meshBasicMaterial ref={cable} color={CABLE} transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh ref={spark} visible={false}>
        <icosahedronGeometry args={[0.09, 0]} />
        <meshBasicMaterial color={SPARK} />
      </mesh>
    </group>
  );
}

export function Links({ state }: { state: TownState }) {
  const links = activeLinks(state.placements);
  return (
    <>
      {links.map(([a, b], index) => (
        <Link key={`${a}-${b}`} a={a} b={b} index={index} />
      ))}
    </>
  );
}
