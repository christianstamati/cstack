// A few puffy low-poly clouds drifting slowly past the floating town: some high behind it,
// some low in front, below the slab. White by day, dim blue at night.
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { Color, IcosahedronGeometry, MeshStandardMaterial, type Group } from "three";

import { seededRandom } from "../logic.ts";
import { SLAB } from "../streets.ts";
import { useNight } from "./daylight.ts";
import { CITY } from "./palette.ts";

const CENTRE = [(SLAB.minX + SLAB.maxX) / 2, (SLAB.minZ + SLAB.maxZ) / 2] as const;
/** Across the default view (screen right) and away from the camera (into the screen). */
const ACROSS = [Math.SQRT1_2, -Math.SQRT1_2] as const;
const AWAY = [-Math.SQRT1_2, -Math.SQRT1_2] as const;
/** How far along `ACROSS` a cloud drifts before it comes round again. */
const SPAN = 46;
const SPEED = 0.35;
const NIGHT_CLOUD = new Color("#5d6694");
const DAY_CLOUD = new Color(CITY.cloud);

interface Cloud {
  /** Where it is along `ACROSS`, from -SPAN to SPAN. */
  across: number;
  away: number;
  y: number;
  scale: number;
  puffs: Array<[x: number, y: number, z: number, r: number]>;
}

function clouds(): Cloud[] {
  const random = seededRandom(11);
  const make = (across: number, away: number, y: number, scale: number): Cloud => {
    const count = 3 + Math.floor(random() * 3);
    const puffs: Cloud["puffs"] = [];
    for (let i = 0; i < count; i++) {
      const x = (i - (count - 1) / 2) * 1.1 + (random() - 0.5) * 0.4;
      const r = 0.9 + random() * 0.7 - Math.abs(x) * 0.18;
      puffs.push([x, r * 0.35 + random() * 0.2, (random() - 0.5) * 0.8, r]);
    }
    return { across, away, y, scale, puffs };
  };
  return [
    make(-30, 28, 7, 1.6),
    make(-6, 34, 10, 2),
    make(18, 26, 6, 1.4),
    make(36, 32, 9, 1.8),
    make(-20, -20, -6, 1.5),
    make(12, -24, -8, 1.8),
    make(32, -18, -5, 1.2),
  ];
}

export function Clouds() {
  const list = useMemo(clouds, []);
  const groups = useRef<Array<Group | null>>([]);
  const geometry = useMemo(() => new IcosahedronGeometry(1, 1), []);
  const material = useMemo(
    () => new MeshStandardMaterial({ flatShading: true, roughness: 1, transparent: true }),
    [],
  );
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );
  useNight((night) => {
    material.color.lerpColors(DAY_CLOUD, NIGHT_CLOUD, night);
    material.emissive.copy(material.color);
    material.emissiveIntensity = 0.35 - night * 0.2;
    material.opacity = 0.95 - night * 0.25;
  });
  useFrame((_, delta) => {
    list.forEach((cloud, i) => {
      cloud.across += delta * SPEED * (0.7 + (i % 3) * 0.2);
      if (cloud.across > SPAN) cloud.across -= 2 * SPAN;
      const group = groups.current[i];
      if (!group) return;
      group.position.set(
        CENTRE[0] + ACROSS[0] * cloud.across + AWAY[0] * cloud.away,
        cloud.y,
        CENTRE[1] + ACROSS[1] * cloud.across + AWAY[1] * cloud.away,
      );
    });
  });
  return (
    <>
      {list.map((cloud, i) => (
        <group
          key={i}
          ref={(g) => void (groups.current[i] = g)}
          scale={cloud.scale}
          rotation={[0, Math.PI / 4, 0]}
        >
          {cloud.puffs.map(([x, y, z, r], j) => (
            <mesh
              key={j}
              geometry={geometry}
              material={material}
              position={[x, y, z]}
              scale={[r, r * 0.75, r * 0.85]}
            />
          ))}
        </group>
      ))}
    </>
  );
}
