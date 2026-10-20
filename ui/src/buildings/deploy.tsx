// Deployment: a black triangular tower with a light beam (Vercel), a warehouse with a crane
// stacking crates (SST), and a locked-up shed when there's nothing to deploy.
import { Badge } from "./Badge.tsx";
import {
  Ball,
  Blinker,
  Box,
  Cone,
  Cyl,
  Door,
  Frame,
  Gable,
  METAL,
  Plinth,
  Ring,
  Spin,
  WHITE,
  Win,
  Wobble,
  type BuildingProps,
} from "./kit.tsx";

/** The front face of the pyramid leans back by atan(0.7 / 3.8). */
const LEAN = -0.18;

/** Vercel: a tall black three-sided pyramid, its logo on the front, a beam into the sky. */
function Pyramid({ stage, theme }: BuildingProps) {
  return (
    <Frame stage={stage} theme={theme}>
      <Plinth w={2.6} d={2.6} />
      <Cone
        position={[0, 2.02, 0]}
        rotation={[0, Math.PI, 0]}
        r={1.4}
        h={3.8}
        seg={3}
        color="#111216"
      />
      <Ball position={[0, 3.95, 0]} r={0.13} detail={0} color={WHITE} glow={1.4} shadow={false} />
      <Spin speed={0.6} position={[0, 3.95, 0]}>
        <Cyl
          position={[0, 1.6, 0]}
          rotation={[0, 0, 0.12]}
          r={0.05}
          top={0.2}
          h={3.2}
          seg={6}
          color={WHITE}
          glow={1}
          opacity={0.18}
          shadow={false}
        />
      </Spin>
      <Badge of="deploy:vercel" position={[0, 1.35, 0.52]} rotation={[LEAN, 0, 0]} size={0.46} />
      <Door position={[0, 0.12, 0.69]} rotation={[LEAN, 0, 0]} w={0.36} h={0.5} />
      <Box
        position={[0, 0.78, 0.6]}
        rotation={[LEAN, 0, 0]}
        size={[0.5, 0.04, 0.03]}
        color={WHITE}
        glow={0.8}
        sharp
      />
      {[-0.95, 0.95].map((x) => (
        <Blinker
          key={x}
          position={[x, 0.2, 0.95]}
          color="#ffffff"
          size={0.08}
          phase={x}
          period={2}
        />
      ))}
    </Frame>
  );
}

const SST_ORANGE = "#e27152";
const CRATE = "#c98a4b";

/** SST: a warehouse with a round roof, crates stacked in front and one swinging from a crane. */
function Warehouse({ stage, theme }: BuildingProps) {
  const crates = [
    { at: [0.55, 0.4, 0.85], color: CRATE, turn: 0 },
    { at: [-0.05, 0.4, 0.95], color: CRATE, turn: 0.2 },
    { at: [0.3, 0.95, 0.9], color: SST_ORANGE, turn: -0.15 },
  ] as const;
  return (
    <Frame stage={stage} theme={theme}>
      <Plinth w={2.7} d={2.5} />
      <Box position={[-0.2, 0.77, -0.35]} size={[2.0, 1.3, 1.4]} color={theme.base} />
      <Cyl
        position={[-0.2, 1.42, -0.35]}
        rotation={[0, 0, Math.PI / 2]}
        r={0.7}
        h={2.06}
        seg={10}
        from={0}
        arc={Math.PI}
        color={SST_ORANGE}
      />
      <Badge of="deploy:sst" position={[-0.2, 1.62, 0.37]} size={0.38} />
      <Door position={[-0.75, 0.12, 0.36]} w={0.7} h={0.85} />
      <Win position={[0.4, 0.95, 0.36]} />
      {crates.map((crate) => (
        <group key={crate.at.join(",")} position={[...crate.at]} rotation={[0, crate.turn, 0]}>
          <Box size={[0.55, 0.55, 0.55]} color={crate.color} />
          <Box size={[0.57, 0.08, 0.57]} color="#8a5a2e" sharp />
        </group>
      ))}
      <Cyl position={[1.1, 1.2, -0.5]} r={0.06} h={2.4} seg={5} color={METAL} />
      <Box position={[1.1, 2.4, -0.05]} size={[0.08, 0.08, 1.0]} color={METAL} sharp />
      <Wobble kind="sway" axis="x" amount={0.12} speed={1.5} position={[1.1, 2.38, 0.35]}>
        <Cyl position={[0, -0.3, 0]} r={0.015} h={0.6} seg={3} color="#d9d4c4" />
        <Box position={[0, -0.75, 0]} size={[0.35, 0.3, 0.35]} color={CRATE} />
      </Wobble>
    </Frame>
  );
}

/** None: a shed with its roll-up door padlocked. Nothing ships today. */
function LockedShed({ stage, theme }: BuildingProps) {
  return (
    <Frame stage={stage} theme={theme}>
      <Plinth w={2.2} d={2.0} />
      <Box position={[0, 0.77, 0]} size={[1.8, 1.3, 1.4]} color={theme.base} />
      <Gable position={[0, 1.42, 0]} w={2.05} h={0.55} d={1.6} color="#7d7f8c" />
      <Badge of="deploy:none" position={[0, 1.62, 0.82]} size={0.22} />
      <Box position={[0, 0.6, 0.71]} size={[1.1, 0.95, 0.05]} color="#9aa0ad" sharp />
      {[0.3, 0.5, 0.7, 0.9].map((y) => (
        <Box
          key={y}
          position={[0, y, 0.74]}
          size={[1.1, 0.03, 0.02]}
          color="#6c7280"
          sharp
          shadow={false}
        />
      ))}
      <Box position={[0, 0.27, 0.77]} size={[0.2, 0.18, 0.08]} color="#e2b33c" />
      <Ring
        position={[0, 0.4, 0.77]}
        rotation={[0, 0, 0]}
        r={0.07}
        tube={0.022}
        arc={Math.PI}
        color="#b9bfcc"
      />
      <Cone position={[0.95, 0.12, 0.8]} r={0.1} h={0.25} seg={4} color="#4f9a55" />
      <Cone position={[1.05, 0.1, 0.62]} r={0.08} h={0.2} seg={4} color="#4f9a55" />
      <Box
        position={[-0.75, 0.9, 0.72]}
        rotation={[0, 0, 0.6]}
        size={[0.5, 0.06, 0.03]}
        color={theme.accent}
        sharp
      />
      <Box
        position={[-0.75, 0.9, 0.72]}
        rotation={[0, 0, -0.6]}
        size={[0.5, 0.06, 0.03]}
        color={theme.accent}
        sharp
      />
    </Frame>
  );
}

export const DEPLOY = { vercel: Pyramid, sst: Warehouse, none: LockedShed };
