import { useMemo } from "react";
import { BoxGeometry, EdgesGeometry } from "three";

import { SLOTS, type SlotId } from "../../../src/town/catalog.ts";
import { LOT_SIZE, lotPosition } from "../logic.ts";
import { NIGHT } from "./palette.ts";

/** A faint square on the grass where a slot's building will go. */
export function LotMarker({ slot }: { slot: SlotId }) {
  const edges = useMemo(() => new EdgesGeometry(new BoxGeometry(LOT_SIZE, 0.04, LOT_SIZE)), []);
  return (
    <group position={lotPosition(slot)}>
      <mesh position={[0, 0.02, 0]} receiveShadow>
        <boxGeometry args={[LOT_SIZE, 0.04, LOT_SIZE]} />
        <meshStandardMaterial color={NIGHT.lot} flatShading />
      </mesh>
      <lineSegments geometry={edges} position={[0, 0.02, 0]}>
        <lineBasicMaterial color={NIGHT.lotEdge} transparent opacity={0.35} />
      </lineSegments>
    </group>
  );
}

/** Every slot's empty lot. Buildings are placed at the same `lotPosition`s. */
export function Lots() {
  return (
    <>
      {SLOTS.map((slot) => (
        <LotMarker key={slot.id} slot={slot.id} />
      ))}
    </>
  );
}
