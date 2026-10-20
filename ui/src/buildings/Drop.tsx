// Drops whatever it wraps onto its lot: it falls from above, squashes as it lands, bounces
// once and settles, with a puff of dust on the ground.
import { useFrame } from "@react-three/fiber";
import { useRef, useState, type ReactNode } from "react";
import type { Group, Mesh, MeshBasicMaterial } from "three";

import { dropPose } from "../logic.ts";

/** How high a building starts above its lot, in world units. */
export const DROP_HEIGHT = 7;
const DURATION_MS = 600;
/** When the building first touches the ground, as a fraction of the drop. */
const IMPACT = 0.55;
const DUST_MS = 450;

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export function Drop(props: { children: ReactNode }) {
  const body = useRef<Group>(null);
  const dust = useRef<Mesh>(null);
  const dustMaterial = useRef<MeshBasicMaterial>(null);
  const start = useRef<number | null>(null);
  const [settled, setSettled] = useState(prefersReducedMotion);
  // Up in the air from the first frame. Never changes, so R3F applies it only on mount and
  // the frame loop owns the height from then on; a new answer remounts and drops again.
  const [startY] = useState(() => (settled ? 0 : DROP_HEIGHT));

  useFrame(({ clock }) => {
    if (settled || !body.current) return;
    start.current ??= clock.elapsedTime;
    const ms = (clock.elapsedTime - start.current) * 1000;
    const pose = dropPose(ms / DURATION_MS);
    body.current.position.y = pose.y * DROP_HEIGHT;
    body.current.scale.set(pose.squashXZ, pose.squashY, pose.squashXZ);

    const dustT = (ms - IMPACT * DURATION_MS) / DUST_MS;
    if (dust.current && dustMaterial.current) {
      dust.current.visible = dustT >= 0 && dustT < 1;
      dust.current.scale.setScalar(1 + dustT * 1.2);
      dustMaterial.current.opacity = 0.55 * (1 - dustT);
    }
    if (ms >= DURATION_MS && dustT >= 1) setSettled(true);
  });

  return (
    <>
      <group ref={body} position-y={startY}>
        {props.children}
      </group>
      {settled ? null : (
        <mesh ref={dust} position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
          <ringGeometry args={[1.1, 1.45, 20]} />
          <meshBasicMaterial
            ref={dustMaterial}
            color="#e9e2cf"
            transparent
            opacity={0}
            depthWrite={false}
          />
        </mesh>
      )}
    </>
  );
}
