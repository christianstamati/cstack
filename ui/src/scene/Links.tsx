// Glowing cables between buildings that depend on each other (see src/town/links.ts).
// Each rises straight up beside its building, arches over the town and comes down beside
// the other, so it never cuts through a building; sparks of light run along it.
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import {
  AdditiveBlending,
  CubicBezierCurve3,
  Vector3,
  type Group,
  type MeshBasicMaterial,
} from "three";

import { slotById, type SlotId } from "../../../src/town/catalog.ts";
import { activeLinks } from "../../../src/town/links.ts";
import type { TownState } from "../../../src/town/protocol.ts";

const CABLE = "#6fe3ff";
const SPARK = "#f2fbff";
/** Seconds for a cable to fade in, after both buildings have landed. */
const FADE_IN = 1.0;
const DELAY = 0.7;
const SPARKS = 3;
/** How far from a lot's centre a cable meets the ground: just outside the building. */
const FOOT = 2.0;

/** Rises beside lot `a`, arches higher the further apart the lots are, comes down beside `b`. */
function cableCurve(a: SlotId, b: SlotId): CubicBezierCurve3 {
  const [ax, az] = slotById(a).lot;
  const [bx, bz] = slotById(b).lot;
  const length = Math.hypot(bx - ax, bz - az);
  const dx = (bx - ax) / length;
  const dz = (bz - az) / length;
  const foot = Math.min(FOOT, length / 3);
  const lift = 3.9 + length * 0.16;
  const start = new Vector3(ax + dx * foot, 0.1, az + dz * foot);
  const end = new Vector3(bx - dx * foot, 0.1, bz - dz * foot);
  return new CubicBezierCurve3(
    start,
    new Vector3(start.x, lift, start.z),
    new Vector3(end.x, lift, end.z),
    end,
  );
}

function Cable({ a, b, index }: { a: SlotId; b: SlotId; index: number }) {
  const curve = useMemo(() => cableCurve(a, b), [a, b]);
  const core = useMemo(() => [curve, 48, 0.07, 6, false] as const, [curve]);
  const halo = useMemo(() => [curve, 48, 0.17, 6, false] as const, [curve]);
  const coreMaterial = useRef<MeshBasicMaterial>(null);
  const haloMaterial = useRef<MeshBasicMaterial>(null);
  const sparks = useRef<Array<Group | null>>([]);
  const born = useRef<number | null>(null);
  const point = useMemo(() => new Vector3(), []);
  useFrame(({ clock }) => {
    born.current ??= clock.elapsedTime;
    const age = clock.elapsedTime - born.current - DELAY;
    const fade = Math.min(Math.max(age / FADE_IN, 0), 1);
    const pulse = 0.85 + 0.15 * Math.sin(clock.elapsedTime * 2 + index);
    if (coreMaterial.current) coreMaterial.current.opacity = 0.9 * fade * pulse;
    if (haloMaterial.current) haloMaterial.current.opacity = 0.22 * fade * pulse;
    sparks.current.forEach((spark, i) => {
      if (!spark) return;
      const t = (clock.elapsedTime * 0.22 + i / SPARKS + index * 0.13) % 1;
      curve.getPoint(t, point);
      spark.position.copy(point);
      spark.visible = fade > 0.5;
    });
  });
  return (
    <group>
      <mesh>
        <tubeGeometry args={core} />
        <meshBasicMaterial
          ref={coreMaterial}
          color={CABLE}
          transparent
          opacity={0}
          toneMapped={false}
        />
      </mesh>
      <mesh>
        <tubeGeometry args={halo} />
        <meshBasicMaterial
          ref={haloMaterial}
          color={CABLE}
          transparent
          opacity={0}
          depthWrite={false}
          blending={AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      {Array.from({ length: SPARKS }, (_, i) => (
        <group key={i} ref={(g) => void (sparks.current[i] = g)} visible={false}>
          <mesh>
            <icosahedronGeometry args={[0.16, 0]} />
            <meshBasicMaterial color={SPARK} toneMapped={false} />
          </mesh>
          <mesh>
            <icosahedronGeometry args={[0.38, 1]} />
            <meshBasicMaterial
              color={CABLE}
              transparent
              opacity={0.35}
              depthWrite={false}
              blending={AdditiveBlending}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export function Links({ state }: { state: TownState }) {
  return (
    <>
      {activeLinks(state.placements).map(([a, b], index) => (
        <Cable key={`${a}-${b}`} a={a} b={b} index={index} />
      ))}
    </>
  );
}
