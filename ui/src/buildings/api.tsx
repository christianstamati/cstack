// API layer: a telephone exchange with a phone booth (built-in), a rotunda with an orbit
// ring (oRPC), a relay mast (tRPC), a flame-topped pagoda (Hono), a Greek temple (Elysia)
// and a keep with a bird's nest on top (NestJS).
import { Badge } from "./Badge.tsx";
import {
  Ball,
  Blinker,
  Box,
  Cone,
  Cyl,
  Dome,
  Door,
  Frame,
  Gable,
  LAMP,
  METAL,
  Plinth,
  Ring,
  Spin,
  WHITE,
  WOOD,
  Win,
  Wobble,
  type BuildingProps,
} from "./kit.tsx";

/** Built-in: the framework's own line. A small telephone exchange with a phone booth. */
function Exchange({ stage, theme }: BuildingProps) {
  const pane = "#bfe6ff";
  return (
    <Frame stage={stage} theme={theme}>
      <Plinth w={2.5} d={2.2} />
      <Box position={[0.2, 0.82, -0.45]} size={[1.9, 1.4, 1.1]} color={theme.base} />
      <Gable position={[0.2, 1.52, -0.45]} w={2.05} h={0.45} d={1.25} color="#5b6b8f" />
      <Badge of="api:builtin" position={[0.6, 1.1, 0.12]} size={0.34} />
      <Win position={[0.6, 0.55, 0.11]} w={0.4} h={0.3} />
      <Door position={[-0.15, 0.12, 0.11]} w={0.36} h={0.6} />
      <Cyl position={[0.9, 2.1, -0.6]} r={0.03} h={1.0} seg={4} color={METAL} />
      <Blinker position={[0.9, 2.62, -0.6]} color="#ff6b6b" size={0.09} />
      <group position={[-0.75, 0.12, 0.55]}>
        <Box position={[0, 0.85, 0]} size={[0.7, 1.7, 0.7]} color={theme.accent} />
        <Box position={[0, 0.9, 0.36]} size={[0.5, 1.1, 0.04]} color={pane} glow={0.6} sharp />
        <Box position={[0.36, 0.9, 0]} size={[0.04, 1.1, 0.5]} color={pane} glow={0.6} sharp />
        <Box position={[0, 1.77, 0]} size={[0.8, 0.12, 0.8]} color={theme.accent} />
        <Box position={[0, 1.6, 0.37]} size={[0.44, 0.1, 0.03]} color={WHITE} glow={0.8} sharp />
      </group>
      <Cyl position={[1.0, 0.8, 0.75]} r={0.04} h={1.6} seg={5} color="#3a3f4d" />
      <Ball position={[1.0, 1.66, 0.75]} r={0.13} color={LAMP} glow={1.2} shadow={false} />
    </Frame>
  );
}

/** oRPC: a rotunda with a glowing ring orbiting it, a little satellite riding the ring. */
function Rotunda({ stage, theme }: BuildingProps) {
  return (
    <Frame stage={stage} theme={theme}>
      <Cyl position={[0, 0.06, 0]} r={1.25} h={0.12} seg={12} color={theme.base} />
      <Cyl position={[0, 0.97, 0]} r={0.9} h={1.7} seg={12} color={theme.base} />
      <Dome position={[0, 1.82, 0]} r={0.9} seg={12} color="#3d63dd" />
      <Cyl position={[0, 2.75, 0]} r={0.12} h={0.12} seg={8} color={theme.accent} />
      <group position={[0, 1.45, 0]} rotation={[0.35, 0, 0.25]}>
        <Spin speed={0.8}>
          <Ring r={1.35} tube={0.06} seg={24} color="#6f8cff" glow={0.9} />
          <Ball position={[1.35, 0, 0]} r={0.15} detail={0} color="#c8d3ff" glow={0.7} />
        </Spin>
      </group>
      <Badge of="api:orpc" position={[0, 1.42, 0.92]} size={0.34} />
      <Door position={[0, 0.12, 0.88]} h={0.62} w={0.36} />
      <Win position={[0.6, 1.15, 0.68]} rotation={[0, 0.72, 0]} />
      <Win position={[-0.6, 1.15, 0.68]} rotation={[0, -0.72, 0]} />
    </Frame>
  );
}

const TRPC_BLUE = "#2596be";

/** tRPC: a blue relay mast with three turning dishes and a hut at its foot. */
function RelayMast({ stage, theme }: BuildingProps) {
  const dishes = [
    { y: 2.0, angle: 0.3, speed: 0.4 },
    { y: 2.55, angle: 2.4, speed: -0.3 },
    { y: 3.0, angle: 4.4, speed: 0.5 },
  ];
  return (
    <Frame stage={stage} theme={theme}>
      <Plinth w={2.3} d={2.1} />
      <Cyl position={[-0.3, 1.92, -0.25]} r={0.48} top={0.1} h={3.6} seg={3} color={TRPC_BLUE} />
      {[0.9, 1.7, 2.5].map((y) => (
        <Cyl
          key={y}
          position={[-0.3, y, -0.25]}
          r={0.5 - (y - 0.12) * 0.105}
          h={0.06}
          seg={3}
          color={WHITE}
        />
      ))}
      {dishes.map((dish) => (
        <Spin
          key={dish.y}
          speed={dish.speed}
          position={[-0.3, dish.y, -0.25]}
          rotation={[0, dish.angle, 0]}
        >
          <Cone
            position={[0.34, 0, 0]}
            rotation={[0, 0, Math.PI / 2]}
            r={0.3}
            h={0.16}
            seg={10}
            color={WHITE}
          />
        </Spin>
      ))}
      <Blinker position={[-0.3, 3.8, -0.25]} color="#ff5a5a" size={0.12} />
      <Box position={[0.55, 0.52, 0.5]} size={[1.05, 0.8, 0.85]} color={theme.base} />
      <Box position={[0.55, 0.96, 0.5]} size={[1.15, 0.08, 0.95]} color={theme.accent} />
      <Badge of="api:trpc" position={[0.75, 0.6, 0.95]} size={0.32} />
      <Door position={[0.2, 0.12, 0.94]} w={0.3} h={0.5} />
    </Frame>
  );
}

const HONO_ORANGE = "#e36002";

/** Hono: a two-tier pagoda shop with a flame flickering on its top. */
function Pagoda({ stage, theme }: BuildingProps) {
  return (
    <Frame stage={stage} theme={theme}>
      <Plinth w={2.5} d={2.3} />
      <Box position={[0, 0.67, 0]} size={[1.7, 1.1, 1.5]} color={theme.base} />
      <Cone
        position={[0, 1.5, 0]}
        rotation={[0, Math.PI / 4, 0]}
        r={1.5}
        h={0.65}
        seg={4}
        color={HONO_ORANGE}
      />
      <Box position={[0, 1.98, 0]} size={[0.85, 0.5, 0.75]} color={theme.base} />
      <Cone
        position={[0, 2.45, 0]}
        rotation={[0, Math.PI / 4, 0]}
        r={0.85}
        h={0.5}
        seg={4}
        color={HONO_ORANGE}
      />
      <Badge of="api:hono" position={[0, 1.98, 0.4]} size={0.3} />
      <Wobble kind="sway" axis="x" amount={0.12} speed={6} position={[0, 2.7, 0]}>
        <Cone
          position={[0, 0.25, 0]}
          r={0.18}
          h={0.5}
          seg={5}
          color="#ff7a1a"
          glow={1.3}
          shadow={false}
        />
        <Cone
          position={[0, 0.2, 0]}
          r={0.1}
          h={0.3}
          seg={5}
          color="#ffe27a"
          glow={1.5}
          shadow={false}
        />
      </Wobble>
      <Box position={[0, 0.52, 0.76]} size={[0.55, 0.64, 0.04]} color={theme.accent} sharp />
      <Win position={[-0.58, 0.75, 0.76]} w={0.3} />
      <Win position={[0.58, 0.75, 0.76]} w={0.3} />
      {[-0.8, 0.8].map((x, i) => (
        <Wobble
          key={x}
          kind="sway"
          axis="x"
          amount={0.15}
          speed={2}
          phase={i}
          position={[x, 1.2, 0.92]}
        >
          <Cyl position={[0, -0.1, 0]} r={0.01} h={0.2} seg={3} color={METAL} />
          <Ball
            position={[0, -0.26, 0]}
            r={0.1}
            detail={0}
            color="#ff6b4a"
            glow={1}
            shadow={false}
          />
        </Wobble>
      ))}
    </Frame>
  );
}

const MARBLE = "#efe9f2";

/** Elysia: a little Greek temple, columns under a pastel pediment, a flame inside. */
function Temple({ stage, theme }: BuildingProps) {
  const columns = [-0.8, 0, 0.8].flatMap((x) => [-0.55, 0.55].map((z) => [x, z] as const));
  return (
    <Frame stage={stage} theme={theme}>
      <Box position={[0, 0.08, 0]} size={[2.5, 0.16, 1.9]} color={theme.base} />
      <Box position={[0, 0.23, 0]} size={[2.25, 0.14, 1.65]} color={MARBLE} />
      {columns.map(([x, z]) => (
        <Cyl key={`${x},${z}`} position={[x, 0.95, z]} r={0.13} h={1.3} seg={8} color={MARBLE} />
      ))}
      <Box position={[0, 1.69, 0]} size={[2.2, 0.18, 1.5]} color={MARBLE} />
      <Gable position={[0, 1.78, 0]} w={2.3} h={0.6} d={1.55} color="#d59ce8" />
      <Badge of="api:elysia" position={[0, 2.0, 0.8]} size={0.26} />
      <Cyl position={[0, 0.45, 0]} r={0.14} h={0.3} seg={6} color={theme.accent} />
      <Wobble kind="sway" axis="x" amount={0.12} speed={6} position={[0, 0.6, 0]}>
        <Cone
          position={[0, 0.15, 0]}
          r={0.12}
          h={0.3}
          seg={5}
          color={LAMP}
          glow={1.4}
          shadow={false}
        />
      </Wobble>
      {[-1.0, 1.0].map((x) => (
        <Cone key={x} position={[x, 0.55, 0.85]} r={0.16} h={0.5} seg={6} color="#3fae6a" />
      ))}
    </Frame>
  );
}

const NEST_RED = "#e0234e";

/** NestJS: a red keep with battlements, a bird on its nest on the roof. */
function Keep({ stage, theme }: BuildingProps) {
  const merlons = [-0.6, 0, 0.6].flatMap((x) => [-0.6, 0.6].map((z) => [x, z] as const));
  merlons.push([-0.6, 0], [0.6, 0]);
  return (
    <Frame stage={stage} theme={theme}>
      <Plinth w={2.2} d={2.2} />
      <Box position={[0, 1.17, 0]} size={[1.5, 2.1, 1.5]} color={NEST_RED} />
      {merlons.map(([x, z]) => (
        <Box key={`${x},${z}`} position={[x, 2.34, z]} size={[0.3, 0.25, 0.3]} color={NEST_RED} />
      ))}
      <Cyl position={[0, 2.35, 0]} r={0.42} top={0.5} h={0.22} seg={10} color={WOOD} />
      <Ball position={[-0.15, 2.5, 0.12]} r={0.1} color={WHITE} />
      <Ball position={[0.15, 2.5, 0.1]} r={0.1} color="#f0e6cf" />
      <Wobble kind="bob" amount={0.06} speed={3} position={[0, 2.62, -0.1]}>
        <Ball r={0.18} color="#4a6fa5" />
        <Ball position={[0, 0.18, 0.08]} r={0.11} color="#4a6fa5" />
        <Cone
          position={[0, 0.18, 0.22]}
          rotation={[Math.PI / 2, 0, 0]}
          r={0.04}
          h={0.1}
          seg={4}
          color="#f2b33c"
        />
      </Wobble>
      <Badge of="api:nestjs" position={[0, 1.75, 0.77]} size={0.42} />
      <Door position={[0, 0.12, 0.76]} h={0.75} />
      <Win position={[-0.5, 1.1, 0.76]} w={0.14} h={0.4} />
      <Win position={[0.5, 1.1, 0.76]} w={0.14} h={0.4} />
      <Box position={[0.95, 0.42, -0.2]} size={[0.5, 0.6, 0.9]} color={theme.base} />
      <Gable position={[0.95, 0.72, -0.2]} w={0.56} h={0.3} d={0.95} color={METAL} />
    </Frame>
  );
}

export const API = {
  builtin: Exchange,
  orpc: Rotunda,
  trpc: RelayMast,
  hono: Pagoda,
  elysia: Temple,
  nestjs: Keep,
};
