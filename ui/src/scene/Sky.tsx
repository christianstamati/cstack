import { useMemo } from "react";

import { seededRandom } from "../logic.ts";
import { NIGHT } from "./palette.ts";

// Low over the sea, so it shows behind the island from the starting view.
const MOON_POSITION = [-130, 26, -140] as const;
const STAR_COUNT = 700;

function starPositions(): Float32Array {
  const random = seededRandom(42);
  const positions = new Float32Array(STAR_COUNT * 3);
  for (let i = 0; i < STAR_COUNT; i++) {
    // Upper part of a sphere, so stars stay above the horizon.
    const theta = random() * Math.PI * 2;
    const y = 0.08 + random() * 0.92;
    const r = Math.sqrt(1 - y * y);
    positions.set([Math.cos(theta) * r * 170, y * 170, Math.sin(theta) * r * 170], i * 3);
  }
  return positions;
}

/** Background, fog, stars, the moon and the lights. */
export function Sky() {
  const stars = useMemo(starPositions, []);
  return (
    <>
      <color attach="background" args={[NIGHT.sky]} />
      <fog attach="fog" args={[NIGHT.sky, 60, 170]} />
      <ambientLight color={NIGHT.ambient} intensity={0.9} />
      <hemisphereLight args={["#5068b0", "#1a1b30", 1]} />
      <directionalLight
        color={NIGHT.moonLight}
        intensity={2.4}
        position={[-28, 26, -30]}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        shadow-bias={-0.0005}
      />
      <mesh position={MOON_POSITION}>
        <icosahedronGeometry args={[9, 1]} />
        <meshBasicMaterial color={NIGHT.moon} fog={false} />
      </mesh>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[stars, 3]} />
        </bufferGeometry>
        <pointsMaterial color="#fff6dd" size={2} sizeAttenuation={false} fog={false} />
      </points>
    </>
  );
}
