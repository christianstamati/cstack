// Database hosting: a neon-lit block (Neon), a green hangar with a radar (Supabase), a
// datacenter under a cloud (AWS), a ringed planet (PlanetScale), a cluster of pods
// (Turso), a globe on a column (Atlas) and a garden shed with a server rack (local).
import { Badge } from "./Badge.tsx";
import {
  Ball,
  Blinker,
  Box,
  Cone,
  Cyl,
  DARK_WOOD,
  Dome,
  Door,
  Frame,
  Gable,
  INK,
  Plinth,
  Ring,
  Spin,
  STONE,
  WHITE,
  WOOD,
  Win,
  Wobble,
  type BuildingProps,
} from "./kit.tsx";

const NEON = "#34d59a";

/** Neon: a dark block outlined in glowing green tubes, its logo lit up on the roof. */
function NeonBlock({ stage, theme }: BuildingProps) {
  return (
    <Frame stage={stage} theme={theme}>
      <Plinth w={2.3} d={2.0} />
      <Box position={[0, 1.02, 0]} size={[1.9, 1.8, 1.5]} color="#1c2230" />
      {[0.7, 1.3].map((y) =>
        [-0.5, 0.5].map((x) => (
          <Win key={`${x},${y}`} position={[x, y, 0.76]} w={0.34} h={0.3} color="#bff7e2" />
        )),
      )}
      <Box
        position={[-0.93, 1.02, 0.76]}
        size={[0.05, 1.7, 0.05]}
        color={NEON}
        glow={1.4}
        sharp
        shadow={false}
      />
      <Box
        position={[0.93, 1.02, 0.76]}
        size={[0.05, 1.7, 0.05]}
        color={NEON}
        glow={1.4}
        sharp
        shadow={false}
      />
      <Box
        position={[0, 1.92, 0.76]}
        size={[1.9, 0.05, 0.05]}
        color={NEON}
        glow={1.4}
        sharp
        shadow={false}
      />
      <Box
        position={[0, 0.17, 0.76]}
        size={[1.9, 0.05, 0.05]}
        color={NEON}
        glow={1.4}
        sharp
        shadow={false}
      />
      <Cyl position={[-0.5, 2.2, 0]} r={0.03} h={0.5} seg={4} color="#3a3f4d" />
      <Cyl position={[0.5, 2.2, 0]} r={0.03} h={0.5} seg={4} color="#3a3f4d" />
      <Box position={[0, 2.6, 0]} size={[1.3, 0.6, 0.08]} color="#11151f" />
      <Badge of="dbHost:neon" position={[0, 2.6, 0.06]} size={0.4} />
      <Ring
        position={[0, 2.6, 0.05]}
        rotation={[0, 0, 0]}
        r={0.72}
        tube={0.03}
        seg={4}
        color={NEON}
        glow={1.6}
      />
      <Door position={[0, 0.12, 0.76]} w={0.4} h={0.5} color={theme.accent} />
    </Frame>
  );
}

const SUPA_GREEN = "#3fcf8e";

/** Supabase: a round-roofed green hangar with a radar dish turning on a mast beside it. */
function Hangar({ stage, theme }: BuildingProps) {
  return (
    <Frame stage={stage} theme={theme}>
      <Plinth w={2.4} d={2.6} />
      <Cyl
        position={[-0.2, 0.12, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        r={1.0}
        h={2.2}
        seg={10}
        from={Math.PI / 2}
        arc={Math.PI}
        color={SUPA_GREEN}
      />
      <Box position={[-0.2, 0.47, 1.1]} size={[0.9, 0.7, 0.05]} color={theme.accent} sharp />
      <Badge of="dbHost:supabase" position={[-0.2, 0.98, 1.12]} size={0.26} />
      {[-0.6, 0, 0.6].map((z) => (
        <Box
          key={z}
          position={[-0.2, 1.1, z]}
          size={[0.3, 0.05, 0.35]}
          color="#bff7e2"
          glow={0.8}
          sharp
          shadow={false}
        />
      ))}
      <Cyl position={[0.95, 0.75, -0.6]} r={0.04} h={1.5} seg={5} color="#9aa0ad" />
      <Spin speed={0.7} position={[0.95, 1.5, -0.6]}>
        <group rotation={[0.5, 0, 0]}>
          <Cone rotation={[Math.PI, 0, 0]} r={0.4} h={0.2} seg={10} color={WHITE} />
          <Ball position={[0, 0.14, 0]} r={0.04} detail={0} color={SUPA_GREEN} glow={1} />
        </group>
      </Spin>
    </Frame>
  );
}

const AWS_INK = "#232f3e";
const AWS_ORANGE = "#ff9900";

/** AWS: a dark datacenter blinking with rack lights, a puffy cloud drifting above it. */
function Datacenter({ stage, theme }: BuildingProps) {
  const lights = [-0.75, -0.375, 0, 0.375, 0.75].flatMap((x) =>
    [0.5, 0.8].map((y) => [x, y] as const),
  );
  return (
    <Frame stage={stage} theme={theme}>
      <Plinth w={2.5} d={2.0} />
      <Box position={[0, 0.72, 0]} size={[2.2, 1.2, 1.6]} color={AWS_INK} />
      <Box position={[0, 1.33, 0]} size={[2.24, 0.1, 1.64]} color={AWS_ORANGE} />
      {lights.map(([x, y], i) => (
        <Blinker
          key={`${x},${y}`}
          position={[x, y, 0.81]}
          color={i % 3 === 0 ? "#7dffb0" : "#7fd1ff"}
          size={0.1}
          period={1 + (i % 4) * 0.4}
          phase={i * 0.37}
        />
      ))}
      <Door position={[0, 0.12, 0.81]} w={0.3} h={0.28} color={theme.accent} />
      <Badge of="dbHost:aws" position={[0.6, 1.1, 0.82]} size={0.24} />
      <Wobble kind="bob" amount={0.12} speed={0.9} position={[0, 2.3, 0]}>
        <Ball position={[-0.5, 0, 0]} r={0.42} color={WHITE} glow={0.15} />
        <Ball position={[0, 0.15, 0.05]} r={0.55} color={WHITE} glow={0.15} />
        <Ball position={[0.52, 0, -0.05]} r={0.4} color={WHITE} glow={0.15} />
        <Ball position={[0.15, -0.05, 0.3]} r={0.35} color={WHITE} glow={0.15} />
      </Wobble>
    </Frame>
  );
}

/** PlanetScale: a dark ringed planet turning over a pillar, a small orange moon nearby. */
function Planet({ stage, theme }: BuildingProps) {
  return (
    <Frame stage={stage} theme={theme}>
      <Box position={[0, 0.1, 0]} size={[1.7, 0.2, 1.7]} color={theme.base} />
      <Cyl position={[0, 0.75, 0]} r={0.55} top={0.38} h={1.1} seg={8} color={STONE} />
      <Cyl position={[0, 1.32, 0]} r={0.48} h={0.06} seg={8} color={theme.accent} />
      <Badge
        of="dbHost:planetscale"
        position={[0, 0.75, 0.5]}
        rotation={[-0.15, 0, 0]}
        size={0.32}
      />
      <group position={[0, 2.15, 0]} rotation={[0.35, 0, -0.3]}>
        <Spin speed={0.5}>
          <Ball r={0.72} color="#2b2b33" />
          <Ball position={[0.3, 0.45, 0.4]} r={0.15} detail={0} color="#3a3a45" />
          <Ring r={1.12} tube={0.07} seg={24} color={WHITE} glow={0.3} />
        </Spin>
      </group>
      <Wobble kind="bob" amount={0.15} speed={1.1} position={[1.05, 2.7, 0.2]}>
        <Ball r={0.15} detail={0} color="#f35815" glow={0.5} />
      </Wobble>
    </Frame>
  );
}

const TURSO_TEAL = "#2ec4a6";

/** Turso: one pod in the middle and five small replicas around it, joined by paths. */
function Pods({ stage, theme }: BuildingProps) {
  const replicas = [0, 1, 2, 3, 4].map((i) => (i / 5) * Math.PI * 2 + 0.3);
  return (
    <Frame stage={stage} theme={theme}>
      {replicas.map((angle, i) => (
        <group key={angle} rotation={[0, angle, 0]}>
          <Box position={[0, 0.03, 0.6]} size={[0.14, 0.04, 0.9]} color={STONE} sharp />
          <group position={[0, 0, 1.1]}>
            <Cyl position={[0, 0.2, 0]} r={0.28} h={0.4} seg={8} color={theme.base} />
            <Dome position={[0, 0.4, 0]} r={0.28} seg={8} color={TURSO_TEAL} />
            <Blinker
              position={[0, 0.24, 0.28]}
              color="#bff7ee"
              size={0.12}
              period={2}
              phase={i * 0.4}
            />
          </group>
        </group>
      ))}
      <Cyl position={[0, 0.45, 0]} r={0.65} h={0.9} seg={10} color={theme.base} />
      <Dome position={[0, 0.9, 0]} r={0.65} seg={10} color={TURSO_TEAL} />
      <Cyl position={[0, 1.65, 0]} r={0.025} h={0.3} seg={4} color={STONE} />
      <Badge of="dbHost:turso" position={[0, 1.95, 0]} size={0.4} />
      <Door position={[0, 0, 0.65]} w={0.3} h={0.45} />
    </Frame>
  );
}

/** Atlas: a blue-and-green globe turning in a gold ring on a stone column. */
function Globe({ stage, theme }: BuildingProps) {
  const land = [
    [0.4, 0.3, 0.42],
    [-0.45, 0.1, 0.4],
    [0.1, -0.35, -0.5],
    [-0.2, 0.5, -0.35],
  ] as const;
  return (
    <Frame stage={stage} theme={theme}>
      <Box position={[0, 0.14, 0]} size={[1.5, 0.28, 1.5]} color={theme.base} />
      <Box position={[0, 0.35, 0]} size={[1.1, 0.14, 1.1]} color={STONE} />
      <Cyl position={[0, 1.0, 0]} r={0.26} top={0.2} h={1.2} seg={8} color={STONE} />
      <Badge of="dbHost:atlas" position={[0, 0.8, 0.27]} size={0.28} />
      <Cyl position={[0, 1.63, 0]} r={0.35} h={0.08} seg={8} color="#d8b25a" />
      <group position={[0, 2.35, 0]} rotation={[0, 0, 0.4]}>
        <Spin speed={0.4}>
          <Ball r={0.64} color="#3b8ad9" />
          {land.map(([x, y, z]) => (
            <Ball
              key={`${x},${y}`}
              position={[x, y, z]}
              scale={[1, 0.7, 0.5]}
              r={0.27}
              detail={0}
              color="#47a248"
            />
          ))}
        </Spin>
        <Ring rotation={[0, Math.PI / 2, 0]} r={0.78} tube={0.035} seg={20} color="#d8b25a" />
      </group>
    </Frame>
  );
}

/** Local: a wooden garden shed with a server rack blinking next to it. */
function Shed({ stage, theme }: BuildingProps) {
  const leds = [0.4, 0.62, 0.84, 1.06];
  return (
    <Frame stage={stage} theme={theme}>
      <Box position={[-0.4, 0.06, -0.15]} size={[1.8, 0.12, 1.5]} color={STONE} />
      <Box position={[-0.4, 0.72, -0.15]} size={[1.5, 1.2, 1.2]} color={WOOD} />
      <Gable position={[-0.4, 1.32, -0.15]} w={1.7} h={0.6} d={1.4} color={DARK_WOOD} />
      <Badge of="dbHost:local" position={[-0.4, 1.55, 0.56]} size={0.22} />
      <Door position={[-0.4, 0.12, 0.46]} color={theme.accent} />
      <Win position={[0.36, 0.85, -0.15]} rotation={[0, Math.PI / 2, 0]} w={0.3} h={0.3} />
      <Box position={[0.8, 0.7, 0.55]} size={[0.6, 1.3, 0.55]} color={INK} />
      {leds.map((y, i) => (
        <group key={y}>
          <Blinker
            position={[0.64, y, 0.84]}
            color={i % 2 === 0 ? "#7dffb0" : "#ffcf5a"}
            size={0.08}
            phase={i * 0.5}
          />
          <Box
            position={[0.86, y, 0.84]}
            size={[0.24, 0.03, 0.02]}
            color="#4a4d5a"
            sharp
            shadow={false}
          />
        </group>
      ))}
      <Cyl
        position={[0.3, 0.04, 0.9]}
        rotation={[0, 0.6, Math.PI / 2]}
        r={0.02}
        h={0.8}
        seg={3}
        color="#2b2d33"
      />
      <Cone position={[1.1, 0.15, -0.5]} r={0.12} h={0.3} seg={5} color="#4f9a55" />
    </Frame>
  );
}

export const DB_HOST = {
  neon: NeonBlock,
  supabase: Hangar,
  aws: Datacenter,
  planetscale: Planet,
  turso: Pods,
  atlas: Globe,
  local: Shed,
};
