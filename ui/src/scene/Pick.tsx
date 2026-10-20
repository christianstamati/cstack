// "Change something": while the plan card waits for a pick, every building that stands for
// an answer glows with a ring round its foot and a click on it picks its slot. The plan card
// sets the picker; the buildings read it.
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, useSyncExternalStore } from "react";
import type { MeshBasicMaterial } from "three";

import type { SlotId } from "../../../src/town/catalog.ts";
import { prefersReducedMotion } from "../buildings/Drop.tsx";

export type Picker = (slot: SlotId) => void;

let picker: Picker | null = null;
const listeners = new Set<() => void>();

/** Starts pick mode with what to do on a pick, or ends it (null). */
export function setPicker(next: Picker | null): void {
  if (picker === next) return;
  picker = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** What a click on a building does in pick mode, or null outside it. */
export function usePicker(): Picker | null {
  return useSyncExternalStore(subscribe, () => picker);
}

const RING = "#ff9a2e";

/** A glowing ring on the ground round a building that can be picked, over a soft disc;
 * brighter on hover. */
export function PickRing({ radius, hot }: { radius: number; hot: boolean }) {
  const ring = useRef<MeshBasicMaterial>(null);
  const disc = useRef<MeshBasicMaterial>(null);
  const still = useMemo(prefersReducedMotion, []);
  useFrame(({ clock }) => {
    const pulse = still ? 0.5 : 0.5 + 0.5 * Math.sin(clock.elapsedTime * 4);
    if (ring.current) ring.current.opacity = hot ? 1 : 0.6 + 0.35 * pulse;
    if (disc.current) disc.current.opacity = hot ? 0.45 : 0.14 + 0.12 * pulse;
  });
  return (
    <group position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh>
        <circleGeometry args={[radius, 32]} />
        <meshBasicMaterial
          ref={disc}
          color={RING}
          transparent
          opacity={0.2}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0, 0, 0.005]}>
        <ringGeometry args={[radius, radius + (hot ? 0.3 : 0.2), 40]} />
        <meshBasicMaterial
          ref={ring}
          color={RING}
          transparent
          opacity={0.8}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
