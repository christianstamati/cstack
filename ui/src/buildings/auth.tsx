// Authentication: an open gate when there's none, a vault (Better Auth), a hotel with a
// service bell (Clerk), a stepped glass office (WorkOS), a round keep with a big key
// (Convex Auth) and a badge office (Payload auth).
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
  INK,
  LAMP,
  METAL,
  Plinth,
  Ring,
  Spin,
  STONE,
  WHITE,
  Win,
  Wobble,
  type BuildingProps,
} from "./kit.tsx";

/** None: two stone pillars, the gate between them swung wide open. */
function OpenGate({ stage, theme }: BuildingProps) {
  const swing = 1.2;
  return (
    <Frame stage={stage} theme={theme}>
      <Box position={[0, 0.03, 0.3]} size={[1.5, 0.06, 2.2]} color={STONE} sharp />
      {[-1, 1].map((side) => (
        <group key={side}>
          <Box position={[side * 1.05, 0.8, 0]} size={[0.44, 1.6, 0.44]} color={theme.base} />
          <Box position={[side * 1.05, 1.65, 0]} size={[0.54, 0.12, 0.54]} color={theme.accent} />
          <Ball position={[side * 1.05, 1.85, 0]} r={0.14} color={LAMP} glow={1.2} shadow={false} />
          <Wobble
            kind="sway"
            axis="y"
            amount={0.06}
            speed={1.2}
            phase={side}
            position={[side * 0.84, 0, 0]}
          >
            <Box
              position={[-side * 0.45 * Math.cos(swing), 0.62, 0.45 * Math.sin(swing)]}
              rotation={[0, side * swing, 0]}
              size={[0.9, 1.0, 0.06]}
              color="#3a3f4d"
            />
          </Wobble>
        </group>
      ))}
      <Badge of="auth:none" position={[-1.05, 1.1, 0.23]} size={0.26} />
    </Frame>
  );
}

const VAULT_STEEL = "#b9bfcc";

/** Better Auth: a squat bunker with a round vault door, its wheel slowly turning. */
function Vault({ stage, theme }: BuildingProps) {
  return (
    <Frame stage={stage} theme={theme}>
      <Plinth w={2.4} d={2.0} />
      <Box position={[0, 0.82, 0]} size={[2.1, 1.4, 1.6]} color={theme.base} />
      <Box position={[0, 1.57, 0]} size={[2.2, 0.12, 1.7]} color={INK} />
      <Cyl
        position={[0, 0.75, 0.82]}
        rotation={[Math.PI / 2, 0, 0]}
        r={0.56}
        h={0.1}
        seg={14}
        color={INK}
      />
      <Cyl
        position={[0, 0.75, 0.87]}
        rotation={[Math.PI / 2, 0, 0]}
        r={0.48}
        h={0.1}
        seg={14}
        color={VAULT_STEEL}
      />
      <Spin axis="z" speed={0.4} position={[0, 0.75, 0.94]}>
        {[0, Math.PI / 3, (2 * Math.PI) / 3].map((angle) => (
          <Box key={angle} rotation={[0, 0, angle]} size={[0.72, 0.06, 0.05]} color={METAL} sharp />
        ))}
        <Cyl rotation={[Math.PI / 2, 0, 0]} r={0.09} h={0.06} seg={8} color={theme.accent} />
      </Spin>
      <Box position={[0, 1.95, 0.55]} size={[0.75, 0.6, 0.08]} color={INK} />
      <Badge of="auth:better-auth" position={[0, 1.95, 0.6]} size={0.4} />
      <Ball
        position={[-0.85, 1.15, 0.85]}
        r={0.08}
        detail={0}
        color={LAMP}
        glow={1.2}
        shadow={false}
      />
      <Ball
        position={[0.85, 1.15, 0.85]}
        r={0.08}
        detail={0}
        color={LAMP}
        glow={1.2}
        shadow={false}
      />
      <Blinker position={[0.6, 0.75, 0.83]} color="#7dffb0" size={0.07} />
    </Frame>
  );
}

const CLERK_PURPLE = "#6c47ff";
const BRASS = "#e7c35a";

/** Clerk: a purple hotel, a big brass service bell on its roof that dings now and then. */
function Hotel({ stage, theme }: BuildingProps) {
  const windows = [-0.5, 0, 0.5].flatMap((x) => [1.2, 1.7, 2.2].map((y) => [x, y] as const));
  return (
    <Frame stage={stage} theme={theme}>
      <Plinth w={2.2} d={2.0} />
      <Box position={[0, 1.32, 0]} size={[1.8, 2.4, 1.5]} color={CLERK_PURPLE} />
      {windows.map(([x, y]) => (
        <Win key={`${x},${y}`} position={[x, y, 0.76]} w={0.28} h={0.3} />
      ))}
      <Box position={[0, 0.9, 0.98]} size={[1.0, 0.08, 0.5]} color={theme.accent} />
      <Badge of="auth:clerk" position={[0, 0.72, 0.77]} size={0.18} />
      <Door position={[-0.55, 0.12, 0.76]} w={0.4} h={0.66} color={theme.base} />
      <Cyl position={[0, 2.55, 0]} r={0.7} h={0.06} seg={12} color={INK} />
      <Wobble kind="sway" amount={0.08} speed={4} position={[0, 2.58, 0]}>
        <Dome r={0.55} seg={12} color={BRASS} />
        <Cyl position={[0, 0.6, 0]} r={0.05} h={0.14} seg={6} color={BRASS} />
        <Ball position={[0, 0.7, 0]} r={0.09} detail={0} color={BRASS} />
      </Wobble>
      <Box position={[0.75, 2.9, 0]} size={[0.06, 0.6, 0.06]} color={METAL} sharp />
      <Box position={[0.75, 2.85, 0.45]} size={[0.5, 0.5, 0.06]} color={CLERK_PURPLE} />
      <Badge of="auth:clerk" position={[0.75, 2.85, 0.5]} size={0.3} />
    </Frame>
  );
}

const GLASS_OFFICE = "#5b6b8f";
const COOL_LIGHT = "#cfe3ff";

/** WorkOS: a stepped glass office block with bands of cool light and a helipad on top. */
function Office({ stage, theme }: BuildingProps) {
  const tiers = [
    { y: 0.72, w: 2.3, h: 1.2, d: 1.7, bands: true },
    { y: 1.82, w: 1.7, h: 1.0, d: 1.3, bands: true },
    { y: 2.72, w: 1.1, h: 0.8, d: 0.9, bands: false },
  ];
  return (
    <Frame stage={stage} theme={theme}>
      <Plinth w={2.6} d={2.0} />
      {tiers.map((tier) => (
        <group key={tier.y}>
          <Box position={[0, tier.y, 0]} size={[tier.w, tier.h, tier.d]} color={GLASS_OFFICE} />
          {tier.bands
            ? [0.15, -0.2].map((dy) => (
                <Box
                  key={dy}
                  position={[0, tier.y + dy, tier.d / 2 + 0.01]}
                  size={[tier.w * 0.86, 0.14, 0.03]}
                  color={COOL_LIGHT}
                  glow={0.9}
                  sharp
                  shadow={false}
                />
              ))
            : null}
        </group>
      ))}
      <Badge of="auth:workos" position={[0, 2.72, 0.47]} size={0.34} />
      <Cyl position={[0, 3.16, 0]} r={0.4} h={0.06} seg={10} color={INK} />
      <Box position={[0, 3.2, 0]} size={[0.06, 0.02, 0.3]} color={WHITE} sharp />
      <Box position={[0, 3.2, 0]} size={[0.25, 0.02, 0.06]} color={WHITE} sharp />
      <Box position={[0, 1.36, 0.86]} size={[2.3, 0.06, 0.02]} color={theme.accent} sharp />
      <Door position={[0, 0.12, 0.86]} w={0.5} h={0.32} color={theme.accent} />
      {[-0.4, 0.4].map((x) => (
        <Blinker key={x} position={[x, 3.22, -0.3]} color="#ff6b6b" size={0.07} phase={x} />
      ))}
    </Frame>
  );
}

const KEY_GOLD = "#f3b01c";

/** Convex Auth: a tall round keep under an orange cone roof, a big key swinging on it. */
function KeyTower({ stage, theme }: BuildingProps) {
  return (
    <Frame stage={stage} theme={theme}>
      <Cyl position={[0, 0.06, 0]} r={1.05} h={0.12} seg={10} color={theme.base} />
      <Cyl position={[0, 1.17, 0]} r={0.72} h={2.1} seg={10} color={theme.base} />
      <Cone position={[0, 2.67, 0]} r={0.9} h={0.9} seg={10} color="#ee6d3a" />
      <Cyl position={[0, 3.3, 0]} r={0.025} h={0.45} seg={4} color={METAL} />
      <Wobble kind="sway" axis="y" amount={0.4} speed={2} position={[0, 3.43, 0]}>
        <Box position={[0.13, 0, 0]} size={[0.24, 0.16, 0.02]} color={theme.accent} sharp />
      </Wobble>
      <Badge
        of="auth:convex-auth-v2"
        position={[-0.2, 1.95, 0.71]}
        rotation={[0, -0.28, 0]}
        size={0.34}
      />
      <Wobble
        kind="sway"
        amount={0.12}
        speed={1.6}
        position={[0.36, 1.75, 0.68]}
        rotation={[0, 0.48, 0]}
      >
        <Ring
          position={[0, -0.2, 0]}
          rotation={[0, 0, 0]}
          r={0.2}
          tube={0.06}
          seg={12}
          color={KEY_GOLD}
          glow={0.3}
        />
        <Box position={[0, -0.75, 0]} size={[0.08, 0.72, 0.08]} color={KEY_GOLD} glow={0.3} />
        <Box position={[0.1, -0.98, 0]} size={[0.16, 0.07, 0.08]} color={KEY_GOLD} glow={0.3} />
        <Box position={[0.1, -0.84, 0]} size={[0.12, 0.07, 0.08]} color={KEY_GOLD} glow={0.3} />
      </Wobble>
      <Door position={[-0.25, 0.12, 0.7]} rotation={[0, -0.35, 0]} h={0.68} />
      <Win position={[0.5, 2.25, 0.5]} rotation={[0, 0.78, 0]} w={0.16} h={0.32} />
    </Frame>
  );
}

const PAYLOAD_DARK = "#2b2d33";

/** Payload auth: a badge office, a giant ID badge with the Payload logo swinging over it. */
function BadgeOffice({ stage, theme }: BuildingProps) {
  return (
    <Frame stage={stage} theme={theme}>
      <Plinth w={2.2} d={1.9} />
      <Box position={[0, 0.82, 0]} size={[1.7, 1.4, 1.4]} color={theme.base} />
      <Box position={[0, 1.58, 0]} size={[1.8, 0.12, 1.5]} color={PAYLOAD_DARK} />
      <Cyl position={[0, 2.35, 0.3]} r={0.03} h={1.4} seg={4} color={METAL} />
      <Wobble kind="sway" amount={0.1} speed={1.3} position={[0, 2.9, 0.38]}>
        <Ring
          position={[0, -0.28, 0]}
          rotation={[0, 0, 0]}
          r={0.28}
          tube={0.03}
          arc={Math.PI}
          color={theme.accent}
        />
        <Box position={[0, -0.6, 0]} size={[1.0, 0.68, 0.08]} color={WHITE} />
        <Badge of="auth:payload" position={[-0.25, -0.6, 0.05]} size={0.26} />
        <Box position={[0.2, -0.5, 0.05]} size={[0.36, 0.06, 0.02]} color={theme.accent} sharp />
        <Box position={[0.2, -0.65, 0.05]} size={[0.3, 0.06, 0.02]} color={STONE} sharp />
        <Box position={[0.2, -0.78, 0.05]} size={[0.22, 0.06, 0.02]} color={STONE} sharp />
      </Wobble>
      <Win position={[0.35, 0.9, 0.71]} w={0.6} h={0.38} />
      <Box position={[0.35, 0.67, 0.8]} size={[0.7, 0.06, 0.2]} color={PAYLOAD_DARK} />
      <Door position={[-0.45, 0.12, 0.71]} h={0.66} />
    </Frame>
  );
}

export const AUTH = {
  none: OpenGate,
  "better-auth": Vault,
  clerk: Hotel,
  workos: Office,
  "convex-auth-v2": KeyTower,
  payload: BadgeOffice,
};
