import { BoxGeometry } from "three";

import { SLOTS, type SlotId } from "../../../src/town/catalog.ts";
import { LOT_SIZE, lotPosition } from "../logic.ts";
import { NIGHT } from "./palette.ts";

/** The tile's shape, only read to build each marker's edge lines (never drawn itself). */
const TILE = new BoxGeometry(LOT_SIZE, 0.04, LOT_SIZE);

/** A faint square on the grass where a slot's building will go. */
export function LotMarker({ slot }: { slot: SlotId }) {
  return (
    <group position={lotPosition(slot)}>
      <mesh position={[0, 0.02, 0]} receiveShadow>
        <boxGeometry args={[LOT_SIZE, 0.04, LOT_SIZE]} />
        <meshStandardMaterial color={NIGHT.lot} flatShading />
      </mesh>
      <lineSegments position={[0, 0.02, 0]}>
        <edgesGeometry args={[TILE]} />
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
