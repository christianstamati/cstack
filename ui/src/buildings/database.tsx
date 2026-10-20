// Databases: stacked blue drums (Postgres), an aquarium with a fin (MySQL), a big filing
// cabinet (SQLite) and a hut under a big leaf (MongoDB).
import { Badge } from "./Badge.tsx";
import {
  Ball,
  Box,
  Cone,
  Cyl,
  Dome,
  Door,
  Frame,
  INK,
  LAMP,
  Plinth,
  WHITE,
  WOOD,
  Win,
  Wobble,
  type BuildingProps,
} from "./kit.tsx";

const PG_BLUE = "#336791";
const PG_LIGHT = "#6b9bc9";

/** Postgres: three blue drums stacked into the classic database shape, a ladder up the side. */
function Drums({ stage, theme }: BuildingProps) {
  const drums = [0.44, 1.12, 1.8];
  return (
    <Frame stage={stage} theme={theme}>
      <Plinth w={2.4} d={2.4} />
      {drums.map((y) => (
        <Cyl key={y} position={[0, y, 0]} r={0.95} h={0.6} seg={14} color={PG_BLUE} />
      ))}
      {[0.78, 1.46].map((y) => (
        <Cyl key={y} position={[0, y, 0]} r={0.9} h={0.08} seg={14} color={PG_LIGHT} />
      ))}
      <Cyl position={[0, 2.14, 0]} r={0.85} h={0.08} seg={14} color={PG_LIGHT} />
      <Win position={[0, 0.44, 0.95]} w={0.5} h={0.12} />
      <Win position={[0, 1.8, 0.95]} w={0.5} h={0.12} />
      <Badge of="database:postgres" position={[0, 1.12, 0.98]} size={0.42} />
      <Cyl position={[-0.3, 2.45, 0.2]} r={0.08} h={0.55} seg={6} color={PG_LIGHT} />
      <Cyl
        position={[-0.3, 2.75, 0.2]}
        rotation={[0, 0, Math.PI / 2]}
        r={0.08}
        h={0.35}
        seg={6}
        color={PG_LIGHT}
      />
      <group position={[1.0, 0, 0]}>
        <Box position={[0, 1.15, -0.16]} size={[0.04, 2.1, 0.04]} color={theme.accent} sharp />
        <Box position={[0, 1.15, 0.16]} size={[0.04, 2.1, 0.04]} color={theme.accent} sharp />
        {[0.4, 0.75, 1.1, 1.45, 1.8].map((y) => (
          <Box key={y} position={[0, y, 0]} size={[0.04, 0.04, 0.32]} color={theme.accent} sharp />
        ))}
      </group>
    </Frame>
  );
}

const MYSQL_ORANGE = "#e48e00";
const WATER = "#3fa7c9";

/** MySQL: a glass aquarium, a dolphin's fin cruising back and forth through it. */
function Aquarium({ stage, theme }: BuildingProps) {
  return (
    <Frame stage={stage} theme={theme}>
      <Box position={[0, 0.1, 0]} size={[2.4, 0.2, 1.8]} color={MYSQL_ORANGE} />
      <Box
        position={[0, 0.9, 0]}
        size={[2.2, 1.4, 1.6]}
        color={WATER}
        glow={0.3}
        opacity={0.6}
        sharp
      />
      <Box position={[0, 1.65, 0]} size={[2.35, 0.1, 1.75]} color={MYSQL_ORANGE} />
      <Cone position={[-0.6, 0.45, -0.3]} r={0.14} h={0.5} seg={5} color="#3f9a55" />
      <Cone position={[0.7, 0.4, 0.2]} r={0.12} h={0.4} seg={5} color="#3f9a55" />
      <Wobble kind="bob" amount={0.15} speed={2}>
        <Ball position={[0.2, 0.8, 0.3]} r={0.06} detail={0} color={WHITE} opacity={0.8} />
        <Ball position={[0.3, 1.1, 0.25]} r={0.05} detail={0} color={WHITE} opacity={0.8} />
      </Wobble>
      <Wobble kind="bob" axis="x" amount={0.55} speed={0.6} position={[0, 1.7, 0]}>
        <group rotation={[0, Math.PI / 2, 0]}>
          <Box
            position={[0, 0.25, 0]}
            rotation={[0, 0, -0.35]}
            size={[0.5, 0.55, 0.08]}
            color="#00758f"
          />
          <Box position={[0.18, 0.08, 0]} size={[0.5, 0.18, 0.08]} color="#00758f" />
        </group>
      </Wobble>
      <Box position={[0.75, 1.95, 0.7]} size={[0.06, 0.5, 0.06]} color={MYSQL_ORANGE} sharp />
      <Badge of="database:mysql" position={[0.75, 2.2, 0.75]} size={0.36} />
    </Frame>
  );
}

const SQLITE_BLUE = "#4aa3d9";

/** SQLite: one big filing cabinet with a reading lamp. A whole database in one file. */
function Cabinet({ stage, theme }: BuildingProps) {
  return (
    <Frame stage={stage} theme={theme}>
      <Plinth w={2.1} d={1.7} />
      <Box position={[0, 1.12, 0]} size={[1.5, 2.0, 1.1]} color={SQLITE_BLUE} />
      {[0.5, 1.12, 1.74].map((y) => (
        <group key={y}>
          <Box position={[0, y, 0.56]} size={[1.32, 0.52, 0.05]} color="#8fd0f2" />
          <Box position={[0, y + 0.08, 0.6]} size={[0.36, 0.06, 0.05]} color={INK} sharp />
          <Box position={[0, y - 0.1, 0.6]} size={[0.3, 0.14, 0.02]} color={WHITE} sharp />
        </group>
      ))}
      <Box
        position={[0.1, 2.16, 0]}
        rotation={[0, 0.2, 0]}
        size={[0.6, 0.05, 0.45]}
        color={WHITE}
        sharp
      />
      <Box
        position={[0.1, 2.21, 0]}
        rotation={[0, -0.1, 0]}
        size={[0.6, 0.05, 0.45]}
        color={WHITE}
        sharp
      />
      <Badge of="database:sqlite" position={[-0.35, 2.45, 0.25]} size={0.36} />
      <Cyl position={[0.95, 0.75, 0.5]} r={0.03} h={1.5} seg={5} color="#3a3f4d" />
      <Cone position={[0.95, 1.55, 0.5]} r={0.16} h={0.16} seg={6} color={theme.accent} />
      <Ball
        position={[0.95, 1.44, 0.5]}
        r={0.07}
        detail={0}
        color={LAMP}
        glow={1.2}
        shadow={false}
      />
    </Frame>
  );
}

const MONGO_GREEN = "#47a248";

/** MongoDB: a round hut under one tall leaf, swaying in the breeze. */
function LeafHut({ stage, theme }: BuildingProps) {
  return (
    <Frame stage={stage} theme={theme}>
      <Cyl position={[0, 0.06, 0]} r={1.25} h={0.12} seg={10} color={theme.base} />
      <Cyl position={[0, 0.62, 0]} r={0.95} h={1.0} seg={10} color={theme.base} />
      <Dome position={[0, 1.12, 0]} r={0.97} seg={10} color="#116149" />
      <Wobble kind="sway" amount={0.08} speed={1.3} position={[0, 2.0, 0]}>
        <Cyl position={[0, 0.15, 0]} r={0.05} h={0.3} seg={5} color={WOOD} />
        <Ball
          position={[0, 1.0, 0]}
          scale={[0.5, 1.7, 0.22]}
          r={0.6}
          detail={0}
          color={MONGO_GREEN}
          glow={0.15}
        />
      </Wobble>
      <Door position={[0, 0.12, 0.95]} h={0.62} />
      <Win position={[0.66, 0.7, 0.68]} rotation={[0, 0.78, 0]} />
      <Win position={[-0.66, 0.7, 0.68]} rotation={[0, -0.78, 0]} />
      <Cyl position={[0.9, 0.4, 1.1]} r={0.035} h={0.8} seg={5} color={WOOD} />
      <Badge of="database:mongodb" position={[0.9, 0.86, 1.14]} size={0.32} />
    </Frame>
  );
}

export const DATABASE = { postgres: Drums, mysql: Aquarium, sqlite: Cabinet, mongodb: LeafHut };
