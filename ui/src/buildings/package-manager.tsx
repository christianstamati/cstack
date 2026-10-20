// Package managers: a self-storage block (pnpm), a bakery (Bun), a parcel depot (npm) and
// a yarn shop (Yarn).
import { Badge } from "./Badge.tsx";
import {
  Ball,
  Box,
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
  WOOD,
  type BuildingProps,
} from "./kit.tsx";

const PNPM_ORANGE = "#f69220";

/** pnpm: self-storage, its front a grid of shutters, its logo on a roof billboard. */
function Storage({ stage, theme }: BuildingProps) {
  const shutters = [-0.75, 0, 0.75].flatMap((x, i) =>
    [0.55, 1.25].map((y, j) => ({ x, y, color: (i + j) % 2 === 0 ? PNPM_ORANGE : "#55555f" })),
  );
  return (
    <Frame stage={stage} theme={theme}>
      <Plinth w={2.7} d={1.9} />
      <Box position={[0, 0.92, 0]} size={[2.4, 1.6, 1.5]} color={theme.base} />
      <Box position={[0, 1.78, 0]} size={[2.5, 0.12, 1.6]} color="#3d3d46" />
      {shutters.map((s) => (
        <group key={`${s.x},${s.y}`}>
          <Box position={[s.x, s.y + 0.12, 0.77]} size={[0.6, 0.6, 0.05]} color={s.color} />
          <Box position={[s.x, s.y - 0.1, 0.81]} size={[0.14, 0.04, 0.03]} color={METAL} sharp />
        </group>
      ))}
      <Box position={[0, 0.17, 1.0]} size={[1.6, 0.1, 0.4]} color={theme.accent} />
      {[-0.55, 0.55].map((x) => (
        <Cyl key={x} position={[x, 2.05, -0.2]} r={0.035} h={0.5} seg={5} color={METAL} />
      ))}
      <Box position={[0, 2.5, -0.2]} size={[1.5, 0.75, 0.08]} color="#2b2d33" />
      <Badge of="packageManager:pnpm" position={[0, 2.5, -0.13]} size={0.48} />
    </Frame>
  );
}

const BUN = "#f2d2a0";

/** Bun: a bakery under a giant bun, a striped awning and an A-frame sign out front. */
function Bakery({ stage, theme }: BuildingProps) {
  const stripes = [-0.675, -0.225, 0.225, 0.675];
  return (
    <Frame stage={stage} theme={theme}>
      <Plinth w={2.4} d={2.2} />
      <Box position={[0, 0.72, -0.1]} size={[1.8, 1.2, 1.4]} color={theme.base} />
      <group position={[0, 1.07, 0.77]} rotation={[0.38, 0, 0]}>
        {stripes.map((x, i) => (
          <Box
            key={x}
            position={[x, 0, 0]}
            size={[0.45, 0.05, 0.5]}
            color={i % 2 === 0 ? theme.accent : WHITE}
            sharp
          />
        ))}
      </group>
      <Door position={[-0.45, 0.12, 0.61]} h={0.62} />
      <Win position={[0.4, 0.65, 0.61]} w={0.6} h={0.38} />
      <Wobble kind="bob" amount={0.05} speed={1.2} position={[0, 1.66, -0.1]}>
        <Ball scale={[1, 0.6, 1]} r={0.8} color={BUN} />
        <Ball position={[0, -0.05, 0]} scale={[1, 0.25, 1]} r={0.82} color="#c98d4e" />
        {[
          [0.2, 0.1],
          [-0.25, 0.2],
          [0.05, -0.3],
          [-0.15, -0.1],
          [0.32, -0.2],
        ].map(([x, z]) => (
          <Box
            key={`${x},${z}`}
            position={[x!, 0.46, z!]}
            rotation={[0, x! * 4, 0]}
            size={[0.1, 0.04, 0.05]}
            color={WHITE}
            sharp
          />
        ))}
      </Wobble>
      <group position={[0.85, 0.12, 1.0]} rotation={[0, -0.3, 0]}>
        <Box
          position={[0, 0.3, 0.06]}
          rotation={[-0.25, 0, 0]}
          size={[0.5, 0.6, 0.04]}
          color={WOOD}
        />
        <Box
          position={[0, 0.3, -0.06]}
          rotation={[0.25, 0, 0]}
          size={[0.5, 0.6, 0.04]}
          color={WOOD}
        />
        <Badge
          of="packageManager:bun"
          position={[0, 0.33, 0.1]}
          rotation={[-0.25, 0, 0]}
          size={0.3}
        />
      </group>
    </Frame>
  );
}

const NPM_RED = "#cb3837";
const CARDBOARD = "#c9955c";

/** npm: a red parcel depot, a roll-up door, parcels stacked by it and the logo on top. */
function Depot({ stage, theme }: BuildingProps) {
  return (
    <Frame stage={stage} theme={theme}>
      <Plinth w={2.6} d={2.1} />
      <Box position={[0, 0.82, -0.15]} size={[2.2, 1.4, 1.5]} color={NPM_RED} />
      <Box position={[0, 1.56, -0.15]} size={[2.3, 0.1, 1.6]} color="#8f2222" />
      <Box position={[0, 1.95, 0.3]} size={[1.5, 0.66, 0.1]} color={WHITE} />
      <Badge of="packageManager:npm" position={[0, 1.95, 0.36]} size={0.46} />
      <Box position={[-0.35, 0.57, 0.62]} size={[1.0, 0.9, 0.05]} color="#9aa0ad" sharp />
      {[0.3, 0.55, 0.8].map((y) => (
        <Box
          key={y}
          position={[-0.35, y, 0.65]}
          size={[1.0, 0.03, 0.02]}
          color="#6c7280"
          sharp
          shadow={false}
        />
      ))}
      <Win position={[0.7, 1.0, 0.61]} />
      <Box position={[0.65, 0.34, 0.95]} size={[0.44, 0.44, 0.44]} color={CARDBOARD} />
      <Box position={[0.65, 0.34, 0.95]} size={[0.46, 0.08, 0.3]} color="#e6c48f" sharp />
      <Box
        position={[1.0, 0.27, 0.55]}
        rotation={[0, 0.4, 0]}
        size={[0.3, 0.3, 0.3]}
        color={CARDBOARD}
      />
      <Wobble kind="bob" amount={0.03} speed={3} position={[0.68, 0.7, 0.9]}>
        <Box rotation={[0, -0.3, 0]} size={[0.3, 0.28, 0.3]} color={CARDBOARD} />
      </Wobble>
    </Frame>
  );
}

const YARN = "#2c8ebb";

/** Yarn: a little shop under a giant spinning ball of yarn, a hanging sign by the door. */
function YarnShop({ stage, theme }: BuildingProps) {
  return (
    <Frame stage={stage} theme={theme}>
      <Plinth w={2.4} d={2.1} />
      <Box position={[0, 0.67, 0]} size={[1.8, 1.1, 1.5]} color={theme.base} />
      <Gable position={[0, 1.22, 0]} w={2.0} h={0.35} d={1.6} color={YARN} />
      <Door position={[0.4, 0.12, 0.76]} />
      <Win position={[-0.4, 0.7, 0.76]} w={0.5} />
      <Spin speed={0.5} position={[0, 2.15, 0]}>
        <Ball r={0.68} color={YARN} />
        <Ring rotation={[Math.PI / 2, 0.4, 0]} r={0.68} tube={0.05} color="#5fb4dc" />
        <Ring rotation={[0.3, 0.9, 0]} r={0.68} tube={0.05} color="#5fb4dc" />
        <Ring rotation={[1.2, 0, 0.8]} r={0.68} tube={0.05} color="#1f6f96" />
        <Cyl
          position={[0.3, 0.45, 0]}
          rotation={[0, 0, -0.5]}
          r={0.03}
          h={1.4}
          seg={5}
          color="#d8dbe5"
        />
        <Cyl
          position={[-0.25, 0.45, 0.1]}
          rotation={[0.2, 0, 0.6]}
          r={0.03}
          h={1.4}
          seg={5}
          color="#d8dbe5"
        />
      </Spin>
      <Cyl
        position={[0.95, 0.85, 0.5]}
        rotation={[0.3, 0, 0.35]}
        r={0.025}
        h={1.5}
        seg={4}
        color={YARN}
      />
      <Ball position={[-0.95, 0.32, 0.65]} r={0.2} color="#e36fa0" />
      <Box position={[-0.95, 1.1, 0.82]} size={[0.5, 0.05, 0.05]} color={WOOD} sharp />
      <Wobble kind="sway" axis="x" amount={0.12} speed={1.8} position={[-1.08, 1.08, 0.82]}>
        <Badge of="packageManager:yarn" position={[0, -0.25, 0]} size={0.28} />
      </Wobble>
    </Frame>
  );
}

export const PACKAGE_MANAGER = { pnpm: Storage, bun: Bakery, npm: Depot, yarn: YarnShop };
