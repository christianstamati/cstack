import { useFrame } from "@react-three/fiber";
import { useMemo } from "react";
import { CylinderGeometry, PlaneGeometry, type BufferGeometry } from "three";

import { decorSpots, ISLAND_RADIUS, seededRandom, type DecorSpot } from "../logic.ts";
import { NIGHT } from "./palette.ts";

const WATER_LEVEL = -1.6;

/** Moves each vertex outwards by a little random amount. Vertices at the same spot
 * (the cylinder's seam) move together, so the surface stays closed. */
function roughen(geometry: BufferGeometry, amount: number, seed: number): BufferGeometry {
  const position = geometry.getAttribute("position");
  const offsets = new Map<string, number>();
  const random = seededRandom(seed);
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    const key = `${x.toFixed(3)},${position.getY(i).toFixed(3)},${z.toFixed(3)}`;
    let offset = offsets.get(key);
    if (offset === undefined) {
      offset = (random() - 0.5) * amount;
      offsets.set(key, offset);
    }
    const length = Math.hypot(x, z);
    if (length > 0.001) {
      position.setX(i, x + (x / length) * offset);
      position.setZ(i, z + (z / length) * offset);
    }
  }
  geometry.computeVertexNormals();
  return geometry;
}

function Water() {
  const geometry = useMemo(() => new PlaneGeometry(420, 420, 64, 64).rotateX(-Math.PI / 2), []);
  const base = useMemo(
    () => Float32Array.from(geometry.getAttribute("position").array),
    [geometry],
  );
  useFrame(({ clock }) => {
    const position = geometry.getAttribute("position");
    const t = clock.elapsedTime * 0.6;
    for (let i = 0; i < position.count; i++) {
      const x = base[i * 3] ?? 0;
      const z = base[i * 3 + 2] ?? 0;
      position.setY(i, Math.sin(x * 0.14 + t) * 0.35 + Math.cos(z * 0.17 + t * 1.3) * 0.3);
    }
    position.needsUpdate = true;
  });
  return (
    <mesh geometry={geometry} position={[0, WATER_LEVEL, 0]} receiveShadow>
      <meshStandardMaterial color={NIGHT.water} flatShading roughness={0.9} metalness={0} />
    </mesh>
  );
}

function Tree({ spot }: { spot: DecorSpot }) {
  return (
    <group position={[spot.x, 0, spot.z]} scale={spot.scale} rotation={[0, spot.rotation, 0]}>
      <mesh position={[0, 0.4, 0]} castShadow>
        <cylinderGeometry args={[0.14, 0.2, 0.8, 5]} />
        <meshStandardMaterial color={NIGHT.trunk} flatShading />
      </mesh>
      <mesh position={[0, 1.35, 0]} castShadow>
        <coneGeometry args={[0.85, 1.5, 6]} />
        <meshStandardMaterial color={NIGHT.leaves} flatShading />
      </mesh>
      <mesh position={[0, 2.1, 0]} castShadow>
        <coneGeometry args={[0.6, 1.1, 6]} />
        <meshStandardMaterial color={NIGHT.leavesLight} flatShading />
      </mesh>
    </group>
  );
}

function Rock({ spot }: { spot: DecorSpot }) {
  return (
    <mesh
      position={[spot.x, 0.15 * spot.scale, spot.z]}
      rotation={[spot.rotation, spot.rotation * 2, 0]}
      scale={[spot.scale * 0.7, spot.scale * 0.45, spot.scale * 0.6]}
      castShadow
      receiveShadow
    >
      <dodecahedronGeometry args={[0.6, 0]} />
      <meshStandardMaterial color={NIGHT.rock} flatShading />
    </mesh>
  );
}

/** The island: a grassy top at y = 0, a rocky underside, a beach and the sea. */
export function Island() {
  const top = useMemo(
    () => roughen(new CylinderGeometry(ISLAND_RADIUS, ISLAND_RADIUS - 0.4, 1, 16, 1), 0.5, 1),
    [],
  );
  const cliff = useMemo(
    () => roughen(new CylinderGeometry(ISLAND_RADIUS - 0.4, 6.5, 5, 16, 3), 1.1, 2),
    [],
  );
  const beach = useMemo(
    () => roughen(new CylinderGeometry(ISLAND_RADIUS + 1.4, ISLAND_RADIUS + 2.4, 0.9, 16), 0.8, 3),
    [],
  );
  const decor = useMemo(() => decorSpots(), []);
  return (
    <group>
      <mesh geometry={top} position={[0, -0.5, 0]} receiveShadow>
        <meshStandardMaterial color={NIGHT.grass} flatShading />
      </mesh>
      <mesh geometry={cliff} position={[0, -3.5, 0]}>
        <meshStandardMaterial color={NIGHT.cliff} flatShading />
      </mesh>
      <mesh geometry={beach} position={[0, WATER_LEVEL + 0.25, 0]} receiveShadow>
        <meshStandardMaterial color={NIGHT.sand} flatShading />
      </mesh>
      {decor.map((spot, i) =>
        spot.kind === "tree" ? <Tree key={i} spot={spot} /> : <Rock key={i} spot={spot} />,
      )}
      <Water />
    </group>
  );
}
