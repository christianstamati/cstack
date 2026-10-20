// Backend / data: a campsite when there's none, an observatory (Convex), a post office
// (Payload) and a water tower (Drizzle).
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group } from "three";

import { Badge } from "./Badge.tsx";
import {
  Ball,
  Box,
  Cone,
  Cyl,
  Dome,
  Door,
  Frame,
  Gable,
  INK,
  LAMP,
  METAL,
  Plinth,
  Spin,
  WHITE,
  WOOD,
  Win,
  Wobble,
  type BuildingProps,
} from "./kit.tsx";

/** None: a tent and a flickering campfire. No backend, just camping. */
function Camp({ stage, theme }: BuildingProps) {
  return (
    <Frame stage={stage} theme={theme}>
      <Gable position={[-0.3, 0, -0.2]} w={1.7} h={1.25} d={1.9} color={theme.accent} />
      <Gable position={[-0.3, 0, 0.76]} w={0.6} h={0.7} d={0.02} color={INK} />
      <Cyl position={[-1.15, 0.45, 0.75]} r={0.03} h={0.9} seg={4} color={WOOD} />
      <Badge of="data:none" position={[-1.15, 0.85, 0.79]} size={0.24} />
      <group position={[0.85, 0, 0.8]}>
        <Cyl
          position={[0, 0.06, 0]}
          rotation={[0, 0.5, Math.PI / 2]}
          r={0.06}
          h={0.6}
          seg={5}
          color={WOOD}
        />
        <Cyl
          position={[0, 0.06, 0]}
          rotation={[0, -0.6, Math.PI / 2]}
          r={0.06}
          h={0.6}
          seg={5}
          color={WOOD}
        />
        <Wobble kind="sway" axis="x" amount={0.15} speed={7}>
          <Cone
            position={[0, 0.28, 0]}
            r={0.17}
            h={0.4}
            seg={5}
            color="#ff8a2a"
            glow={1.3}
            shadow={false}
          />
          <Cone
            position={[0, 0.24, 0]}
            r={0.09}
            h={0.26}
            seg={5}
            color="#ffe27a"
            glow={1.5}
            shadow={false}
          />
        </Wobble>
      </group>
      <Cyl
        position={[0.95, 0.12, 0]}
        rotation={[0, 0, Math.PI / 2]}
        r={0.12}
        h={0.6}
        seg={6}
        color={WOOD}
      />
      <Cyl
        position={[0.2, 0.12, 1.15]}
        rotation={[0, 0.9, Math.PI / 2]}
        r={0.12}
        h={0.5}
        seg={6}
        color={WOOD}
      />
    </Frame>
  );
}

const CONVEX_ORANGE = "#ee6d3a";
const CONVEX_PURPLE = "#8d2676";

/** Convex: a round observatory, its telescope slowly scanning the sky. */
function Observatory({ stage, theme }: BuildingProps) {
  return (
    <Frame stage={stage} theme={theme}>
      <Cyl position={[0, 0.06, 0]} r={1.3} h={0.12} seg={12} color={theme.base} />
      <Cyl position={[0, 0.77, 0]} r={1.05} h={1.3} seg={12} color={theme.base} />
      <Cyl position={[0, 1.44, 0]} r={1.1} h={0.12} seg={12} color={theme.accent} />
      <Spin speed={0.25} position={[0, 1.48, 0]}>
        <Dome r={1.02} seg={12} color={CONVEX_ORANGE} />
        <Box
          position={[0, 0.6, 0.3]}
          rotation={[-0.75, 0, 0]}
          size={[0.3, 0.06, 0.95]}
          color={INK}
          sharp
        />
        <group position={[0, 0.5, 0.25]} rotation={[0.9, 0, 0]}>
          <Cyl position={[0, 0.45, 0]} r={0.16} top={0.12} h={1.0} seg={8} color={CONVEX_PURPLE} />
          <Cyl position={[0, 0.96, 0]} r={0.12} h={0.04} seg={8} color={LAMP} glow={1} />
        </group>
      </Spin>
      <Badge of="data:convex" position={[0, 1.08, 1.06]} size={0.4} />
      <Door position={[0, 0.12, 1.03]} h={0.62} w={0.36} />
      <Win position={[0.66, 0.85, 0.8]} rotation={[0, 0.69, 0]} />
      <Win position={[-0.66, 0.85, 0.8]} rotation={[0, -0.69, 0]} />
    </Frame>
  );
}

const PAYLOAD_DARK = "#2b2d33";

/** Payload: a post office with a pillared porch, a big envelope on the roof and a mailbox. */
function PostOffice({ stage, theme }: BuildingProps) {
  return (
    <Frame stage={stage} theme={theme}>
      <Plinth w={2.6} d={2.2} />
      <Box position={[0, 0.82, -0.2]} size={[2.2, 1.4, 1.5]} color={theme.base} />
      <Box position={[0, 1.58, -0.2]} size={[2.3, 0.14, 1.6]} color={PAYLOAD_DARK} />
      <Wobble kind="bob" amount={0.06} speed={1.6} position={[0, 2.05, 0.1]}>
        <Box size={[0.95, 0.62, 0.06]} color={WHITE} />
        <Box
          position={[-0.22, 0.13, 0.04]}
          rotation={[0, 0, -0.55]}
          size={[0.56, 0.05, 0.02]}
          color={PAYLOAD_DARK}
          sharp
        />
        <Box
          position={[0.22, 0.13, 0.04]}
          rotation={[0, 0, 0.55]}
          size={[0.56, 0.05, 0.02]}
          color={PAYLOAD_DARK}
          sharp
        />
      </Wobble>
      <Box position={[0, 1.3, 0.78]} size={[1.5, 0.1, 0.55]} color={PAYLOAD_DARK} />
      <Badge of="data:payload" position={[0, 1.55, 0.98]} size={0.32} />
      <Cyl position={[-0.6, 0.71, 0.95]} r={0.07} h={1.18} seg={6} color={WHITE} />
      <Cyl position={[0.6, 0.71, 0.95]} r={0.07} h={1.18} seg={6} color={WHITE} />
      <Door position={[0, 0.12, 0.56]} w={0.5} h={0.7} />
      <Win position={[-0.75, 0.9, 0.56]} />
      <Win position={[0.75, 0.9, 0.56]} />
      <group position={[1.05, 0, 1.15]}>
        <Cyl position={[0, 0.25, 0]} r={0.04} h={0.5} seg={5} color={METAL} />
        <Box position={[0, 0.62, 0]} size={[0.3, 0.26, 0.38]} color={theme.accent} />
        <Cyl
          position={[0, 0.75, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          r={0.15}
          h={0.38}
          seg={8}
          from={Math.PI / 2}
          arc={Math.PI}
          color={theme.accent}
        />
      </group>
    </Frame>
  );
}

const DRIZZLE_LIME = "#c5f74f";
const WATER = "#6fc3ff";

/** A drop that falls from the tank into the puddle, again and again. */
function FallingDrop() {
  const ref = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = (clock.elapsedTime * 0.7) % 1;
    ref.current.position.y = 1.72 - t * t * 1.65;
    ref.current.visible = t < 0.98;
  });
  return (
    <group ref={ref} position={[0.35, 1.72, 0.35]}>
      <Ball r={0.11} color={WATER} glow={0.5} shadow={false} />
      <Cone
        position={[0, 0.13, 0]}
        r={0.095}
        h={0.18}
        seg={8}
        color={WATER}
        glow={0.5}
        shadow={false}
      />
    </group>
  );
}

/** Drizzle: a lime water tower on stilts, a drop dripping into a puddle below. */
function WaterTower({ stage, theme }: BuildingProps) {
  const legs = [
    [-0.6, -0.6],
    [0.6, -0.6],
    [-0.6, 0.6],
    [0.6, 0.6],
  ] as const;
  return (
    <Frame stage={stage} theme={theme}>
      {legs.map(([x, z]) => (
        <Cyl key={`${x},${z}`} position={[x, 0.9, z]} r={0.07} h={1.8} seg={6} color={METAL} />
      ))}
      <Box
        position={[0, 0.9, 0.6]}
        rotation={[0, 0, 0.9]}
        size={[1.55, 0.05, 0.05]}
        color={METAL}
        sharp
      />
      <Box
        position={[0, 0.9, -0.6]}
        rotation={[0, 0, -0.9]}
        size={[1.55, 0.05, 0.05]}
        color={METAL}
        sharp
      />
      <Cyl position={[0, 1.85, 0]} r={0.9} h={0.1} seg={12} color={theme.base} />
      <Cyl position={[0, 2.35, 0]} r={0.85} h={0.9} seg={12} color={DRIZZLE_LIME} />
      <Cyl position={[0, 2.1, 0]} r={0.87} h={0.06} seg={12} color={INK} />
      <Cyl position={[0, 2.6, 0]} r={0.87} h={0.06} seg={12} color={INK} />
      <Cone position={[0, 3.08, 0]} r={0.95} h={0.56} seg={12} color={INK} />
      <Ball position={[0, 3.4, 0]} r={0.08} detail={0} color={DRIZZLE_LIME} glow={0.8} />
      <Badge of="data:drizzle" position={[0, 2.35, 0.9]} size={0.5} />
      <Cyl position={[0, 0.9, 0]} r={0.08} h={1.8} seg={6} color={theme.accent} />
      <FallingDrop />
      <Cyl position={[0.35, 0.02, 0.35]} r={0.42} h={0.03} seg={10} color="#4f9ee0" glow={0.3} />
      {[0.4, 0.75, 1.1, 1.45].map((y) => (
        <Box key={y} position={[0.6, y, 0.68]} size={[0.24, 0.03, 0.03]} color={METAL} sharp />
      ))}
    </Frame>
  );
}

export const DATA = { none: Camp, convex: Observatory, payload: PostOffice, drizzle: WaterTower };
