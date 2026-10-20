// Frontend: a sleek black tower for Next.js, a stack of terraces under a palm tree for
// TanStack Start.
import { Badge } from "./Badge.tsx";
import {
  Ball,
  Blinker,
  Box,
  Cyl,
  Door,
  Frame,
  Plinth,
  WOOD,
  Win,
  Wobble,
  type BuildingProps,
} from "./kit.tsx";

const BLACK = "#16171d";

/** Next.js: a tall black tower lit floor by floor, its logo near the top. */
function Tower({ stage, theme }: BuildingProps) {
  const floors = [0.9, 1.4, 1.9, 2.4, 2.9];
  return (
    <Frame stage={stage} theme={theme}>
      <Plinth w={2.1} d={2.1} />
      <Box position={[0, 2.02, 0]} size={[1.3, 3.8, 1.3]} color={BLACK} />
      <Box position={[0, 3.98, 0]} size={[1.4, 0.14, 1.4]} color={theme.accent} />
      <Box position={[0.2, 4.2, -0.2]} size={[0.5, 0.3, 0.4]} color="#2b2d33" />
      {floors.map((y, i) =>
        [-0.35, 0, 0.35].map((x) => (
          <group key={`${y},${x}`}>
            {(i + x * 10) % 3 !== 1 ? <Win position={[x, y, 0.66]} w={0.22} h={0.26} /> : null}
            <Win position={[0.66, y, x]} rotation={[0, Math.PI / 2, 0]} w={0.22} h={0.26} />
            <Win position={[-0.66, y, x]} rotation={[0, Math.PI / 2, 0]} w={0.22} h={0.26} />
          </group>
        )),
      )}
      <Badge of="frontend:nextjs" position={[0, 3.5, 0.68]} size={0.62} />
      <Box position={[0, 0.5, 0.75]} size={[1.0, 0.06, 0.25]} color={theme.accent} />
      <Door position={[0, 0.12, 0.66]} w={0.5} h={0.36} color="#bfe6ff" />
      <Cyl position={[-0.35, 4.5, 0.35]} r={0.03} h={0.9} seg={4} color="#9aa0ad" />
      <Blinker position={[-0.35, 4.98, 0.35]} color="#ff6b6b" size={0.1} />
    </Frame>
  );
}

const TIERS = [
  { y: 0.395, w: 2.3, d: 2.0, sand: false },
  { y: 0.945, w: 1.75, d: 1.5, sand: true },
  { y: 1.495, w: 1.2, d: 1.0, sand: false },
] as const;
const FRONDS = [0, 1.25, 2.5, 3.75, 5.0];

/** TanStack Start: three terraces stacked up, a palm tree swaying on the top one. */
function Terraces({ stage, theme }: BuildingProps) {
  return (
    <Frame stage={stage} theme={theme}>
      <Plinth w={2.6} d={2.3} />
      {TIERS.map((tier) => (
        <group key={tier.y}>
          <Box
            position={[0, tier.y, 0]}
            size={[tier.w, 0.55, tier.d]}
            color={tier.sand ? "#e3b964" : theme.base}
          />
          <Win position={[-tier.w / 3, tier.y, tier.d / 2 + 0.01]} w={tier.w / 5} h={0.22} />
          <Win position={[tier.w / 3, tier.y, tier.d / 2 + 0.01]} w={tier.w / 5} h={0.22} />
          <Box
            position={[0, tier.y + 0.3, tier.d / 2 - 0.02]}
            size={[tier.w, 0.08, 0.08]}
            color={theme.accent}
            sharp
          />
        </group>
      ))}
      <Badge of="frontend:tanstack-start" position={[0, 0.95, 0.77]} size={0.36} />
      <Door position={[0, 0.12, 1.01]} h={0.5} />
      <Box position={[-0.75, 0.83, 0.85]} size={[0.06, 0.06, 0.2]} color={WOOD} sharp />
      <Wobble kind="sway" amount={0.08} speed={1.1} position={[0.15, 1.77, 0]}>
        <Cyl
          position={[0, 0.5, 0]}
          rotation={[0, 0, 0.12]}
          r={0.07}
          top={0.05}
          h={1.0}
          seg={5}
          color={WOOD}
        />
        {FRONDS.map((angle) => (
          <group key={angle} position={[-0.06, 1.0, 0]} rotation={[0, angle, 0]}>
            <Box
              position={[0.4, -0.1, 0]}
              rotation={[0, 0, -0.4]}
              size={[0.85, 0.04, 0.24]}
              color="#3fae6a"
              sharp
            />
          </group>
        ))}
        <Ball position={[-0.02, 0.92, 0.08]} r={0.08} detail={0} color="#7a5230" />
      </Wobble>
    </Frame>
  );
}

export const FRONTEND = { nextjs: Tower, "tanstack-start": Terraces };
