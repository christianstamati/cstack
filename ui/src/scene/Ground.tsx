// The floating slab the town grows on: a square of grass with rounded corners over a
// darker base, a green belt of trees round its edge, little parks between the blocks and a
// few rocks. On bare land that's all there is; streets and blocks come with the answers.
import { useLayoutEffect, useMemo, useRef, type RefObject } from "react";
import { Color, Object3D, type InstancedMesh } from "three";

import { decorSpots, type DecorSpot } from "../logic.ts";
import { SLAB } from "../streets.ts";
import { CITY } from "./palette.ts";

const WIDTH = SLAB.maxX - SLAB.minX;
const DEPTH = SLAB.maxZ - SLAB.minZ;
const CENTRE = [(SLAB.minX + SLAB.maxX) / 2, (SLAB.minZ + SLAB.maxZ) / 2] as const;
const GRASS_HEIGHT = 0.7;
const BASE_HEIGHT = 0.9;

/** Puts one instance per spot, each with `place` setting its transform and colour. */
function useInstances(
  mesh: RefObject<InstancedMesh | null>,
  spots: DecorSpot[],
  place: (spot: DecorSpot, index: number, object: Object3D, color: Color) => void,
) {
  useLayoutEffect(() => {
    const instances = mesh.current;
    if (!instances) return;
    const object = new Object3D();
    const color = new Color();
    spots.forEach((spot, i) => {
      object.position.set(spot.x, 0, spot.z);
      object.rotation.set(0, spot.rotation, 0);
      object.scale.setScalar(spot.scale);
      color.set(CITY.trunk);
      place(spot, i, object, color);
      object.updateMatrix();
      instances.setMatrixAt(i, object.matrix);
      instances.setColorAt(i, color);
    });
    instances.instanceMatrix.needsUpdate = true;
    if (instances.instanceColor) instances.instanceColor.needsUpdate = true;
    instances.computeBoundingSphere();
    // The spots never change; placed once.
  }, []);
}

/** Round low-poly trees: a trunk and one or two puffs of leaves, in a few greens. */
function Trees({ spots }: { spots: DecorSpot[] }) {
  const trunks = useRef<InstancedMesh>(null);
  const crowns = useRef<InstancedMesh>(null);
  const tops = useRef<InstancedMesh>(null);
  useInstances(trunks, spots, (_, __, object) => {
    object.position.y = 0.35 * object.scale.y;
  });
  useInstances(crowns, spots, (_, i, object, color) => {
    object.position.y = 1.0 * object.scale.y;
    color.set(CITY.leaves[i % CITY.leaves.length]!);
  });
  useInstances(tops, spots, (_, i, object, color) => {
    // Every other tree gets a smaller puff on top.
    object.position.y = 1.55 * object.scale.y;
    object.scale.multiplyScalar(i % 2 === 0 ? 0.62 : 0.0001);
    color.set(CITY.leaves[(i + 2) % CITY.leaves.length]!);
  });
  return (
    <>
      <instancedMesh ref={trunks} args={[undefined, undefined, spots.length]} castShadow>
        <cylinderGeometry args={[0.09, 0.13, 0.7, 6]} />
        <meshStandardMaterial flatShading roughness={0.9} />
      </instancedMesh>
      <instancedMesh
        ref={crowns}
        args={[undefined, undefined, spots.length]}
        castShadow
        receiveShadow
      >
        <icosahedronGeometry args={[0.62, 0]} />
        <meshStandardMaterial flatShading roughness={0.9} />
      </instancedMesh>
      <instancedMesh
        ref={tops}
        args={[undefined, undefined, spots.length]}
        castShadow
        receiveShadow
      >
        <icosahedronGeometry args={[0.62, 0]} />
        <meshStandardMaterial flatShading roughness={0.9} />
      </instancedMesh>
    </>
  );
}

function Rocks({ spots }: { spots: DecorSpot[] }) {
  const rocks = useRef<InstancedMesh>(null);
  useInstances(rocks, spots, (spot, _, object, color) => {
    object.position.y = 0.12 * spot.scale;
    object.rotation.set(spot.rotation, spot.rotation * 2, 0);
    object.scale.set(spot.scale * 0.7, spot.scale * 0.45, spot.scale * 0.6);
    color.set(CITY.rock);
  });
  return (
    <instancedMesh ref={rocks} args={[undefined, undefined, spots.length]} castShadow receiveShadow>
      <dodecahedronGeometry args={[0.6, 0]} />
      <meshStandardMaterial flatShading roughness={0.95} />
    </instancedMesh>
  );
}

export function Ground() {
  const decor = useMemo(() => decorSpots(), []);
  const trees = useMemo(() => decor.filter((spot) => spot.kind === "tree"), [decor]);
  const rocks = useMemo(() => decor.filter((spot) => spot.kind === "rock"), [decor]);
  return (
    <group>
      <mesh position={[CENTRE[0], -GRASS_HEIGHT / 2, CENTRE[1]]} receiveShadow>
        <roundedBoxGeometry args={[WIDTH, GRASS_HEIGHT, DEPTH, 3, 0.32]} />
        <meshStandardMaterial color={CITY.grass} flatShading roughness={1} />
      </mesh>
      <mesh position={[CENTRE[0], -GRASS_HEIGHT - BASE_HEIGHT / 2 + 0.05, CENTRE[1]]}>
        <roundedBoxGeometry args={[WIDTH - 0.5, BASE_HEIGHT, DEPTH - 0.5, 3, 0.3]} />
        <meshStandardMaterial color={CITY.slabEdge} flatShading roughness={1} />
      </mesh>
      <mesh position={[CENTRE[0], -GRASS_HEIGHT - BASE_HEIGHT - 0.12, CENTRE[1]]}>
        <roundedBoxGeometry args={[WIDTH - 1.4, 0.3, DEPTH - 1.4, 2, 0.12]} />
        <meshStandardMaterial color={CITY.slabBase} flatShading roughness={1} />
      </mesh>
      <Trees spots={trees} />
      <Rocks spots={rocks} />
    </group>
  );
}
