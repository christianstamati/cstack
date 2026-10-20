// Small props: the extras around the town (a lighthouse for CI, a watchtower for tests,
// ...), the sign-in methods on their lot, and the paint fountain the styling answer puts
// in the town square.
import { Badge } from "../buildings/Badge.tsx";
import {
  Ball,
  Blinker,
  Box,
  Cone,
  Cyl,
  Door,
  Frame,
  Gable,
  INK,
  LAMP,
  METAL,
  Ring,
  Spin,
  STONE,
  WHITE,
  WOOD,
  Win,
  Wobble,
  type BuildingProps,
} from "../buildings/kit.tsx";

const DARK = "#3a3f4d";
const LIGHTHOUSE_RED = "#d94b3d";

/** Example feature: a little kiosk with a pinboard of colourful notes. */
function NotesKiosk({ stage, theme }: BuildingProps) {
  const notes = [
    { x: -0.18, y: 1.08, color: "#ffe27a", turn: 0.1 },
    { x: 0.16, y: 1.12, color: "#ff9fc4", turn: -0.12 },
    { x: -0.02, y: 0.86, color: "#9fd8ff", turn: 0.05 },
  ];
  return (
    <Frame stage={stage} theme={theme}>
      <Box position={[0, 0.45, -0.1]} size={[0.9, 0.9, 0.5]} color={theme.base} />
      <Gable position={[0, 0.9, -0.1]} w={1.05} h={0.35} d={0.65} color={theme.accent} />
      <Box position={[0, 1.0, 0.18]} size={[0.75, 0.55, 0.05]} color={WOOD} />
      {notes.map((note, i) => (
        <Wobble
          key={note.x}
          kind="sway"
          amount={0.08}
          speed={2}
          phase={i}
          position={[note.x, note.y, 0.21]}
        >
          <Box rotation={[0, 0, note.turn]} size={[0.2, 0.2, 0.02]} color={note.color} sharp />
        </Wobble>
      ))}
      <Win position={[-0.2, 0.45, 0.16]} w={0.3} h={0.25} />
      <Badge of="extras:example" position={[0.24, 0.45, 0.17]} size={0.18} />
      <Box position={[0.75, 0.2, 0.2]} size={[0.5, 0.06, 0.2]} color={WOOD} />
      <Box position={[0.75, 0.1, 0.2]} size={[0.06, 0.2, 0.18]} color={DARK} />
    </Frame>
  );
}

/** CI: a striped lighthouse on a rock, its beam sweeping round. */
function Lighthouse({ stage, theme }: BuildingProps) {
  return (
    <Frame stage={stage} theme={theme}>
      <Ball position={[0, 0.1, 0]} scale={[1, 0.4, 1]} r={0.9} detail={0} color={STONE} />
      <Cyl position={[0, 1.55, 0]} r={0.5} top={0.34} h={2.7} seg={10} color={WHITE} />
      <Cyl position={[0, 1.0, 0]} r={0.47} top={0.44} h={0.35} seg={10} color={LIGHTHOUSE_RED} />
      <Cyl position={[0, 2.05, 0]} r={0.41} top={0.38} h={0.35} seg={10} color={LIGHTHOUSE_RED} />
      <Badge of="extras:ci" position={[0, 1.5, 0.45]} size={0.3} />
      <Cyl position={[0, 2.95, 0]} r={0.42} h={0.08} seg={10} color={INK} />
      <Cyl position={[0, 3.2, 0]} r={0.3} h={0.42} seg={8} color={LAMP} glow={1.6} shadow={false} />
      <Cone position={[0, 3.62, 0]} r={0.42} h={0.42} seg={10} color={LIGHTHOUSE_RED} />
      <Door position={[0, 0.3, 0.47]} w={0.26} h={0.45} />
      <Spin speed={0.9} position={[0, 3.2, 0]}>
        <Cone
          position={[1.7, 0, 0]}
          rotation={[0, 0, Math.PI / 2]}
          r={0.45}
          h={3.2}
          seg={10}
          color={LAMP}
          glow={1}
          opacity={0.16}
          shadow={false}
        />
      </Spin>
    </Frame>
  );
}

/** Tests: a wooden watchtower, a lookout's lamp sweeping from its platform. */
function Watchtower({ stage, theme }: BuildingProps) {
  const legs = [
    [-0.42, -0.42],
    [0.42, -0.42],
    [-0.42, 0.42],
    [0.42, 0.42],
  ] as const;
  return (
    <Frame stage={stage} theme={theme}>
      {legs.map(([x, z]) => (
        <Cyl
          key={`${x},${z}`}
          position={[x, 1.1, z]}
          rotation={[z * 0.12, 0, -x * 0.12]}
          r={0.06}
          h={2.2}
          seg={5}
          color={WOOD}
        />
      ))}
      <Box
        position={[0, 0.9, 0.44]}
        rotation={[0, 0, 0.75]}
        size={[1.2, 0.05, 0.05]}
        color={WOOD}
        sharp
      />
      <Box position={[0, 2.2, 0]} size={[1.1, 0.12, 1.1]} color={WOOD} />
      {[-0.52, 0.52].map((offset) => (
        <group key={offset}>
          <Box position={[0, 2.45, offset]} size={[1.1, 0.06, 0.05]} color="#7a5230" sharp />
          <Box position={[offset, 2.45, 0]} size={[0.05, 0.06, 1.1]} color="#7a5230" sharp />
        </group>
      ))}
      {legs.map(([x, z]) => (
        <Cyl
          key={`${x},${z}`}
          position={[x * 1.15, 2.6, z * 1.15]}
          r={0.03}
          h={0.75}
          seg={4}
          color={WOOD}
        />
      ))}
      <Badge of="extras:tests" position={[0, 2.42, 0.58]} size={0.28} />
      <Cone
        position={[0, 3.2, 0]}
        rotation={[0, Math.PI / 4, 0]}
        r={0.9}
        h={0.55}
        seg={4}
        color={theme.accent}
      />
      <Spin speed={1.1} position={[0, 2.5, 0]}>
        <Ball r={0.1} detail={0} color={LAMP} glow={1.4} shadow={false} />
        <Cone
          position={[0.9, 0, 0]}
          rotation={[0, 0, Math.PI / 2]}
          r={0.25}
          h={1.6}
          seg={8}
          color={LAMP}
          glow={1}
          opacity={0.12}
          shadow={false}
        />
      </Spin>
    </Frame>
  );
}

/** Env validation: a checkpoint booth with a striped barrier that lifts now and then. */
function Checkpoint({ stage, theme }: BuildingProps) {
  return (
    <Frame stage={stage} theme={theme}>
      <Box position={[-0.55, 0.5, 0]} size={[0.6, 1.0, 0.6]} color={theme.base} />
      <Box position={[-0.55, 1.06, 0]} size={[0.72, 0.12, 0.72]} color={theme.accent} />
      <Win position={[-0.55, 0.62, 0.31]} w={0.36} h={0.3} />
      <Badge of="extras:env" position={[-0.55, 1.32, 0.15]} size={0.22} />
      <Cyl position={[0, 0.35, 0]} r={0.08} h={0.7} seg={6} color={DARK} />
      <Wobble kind="sway" amount={0.25} speed={0.8} position={[0, 0.62, 0]}>
        {[0, 1, 2, 3, 4].map((i) => (
          <Box
            key={i}
            position={[0.15 + i * 0.25, 0.12, 0]}
            size={[0.25, 0.09, 0.09]}
            color={i % 2 === 0 ? LIGHTHOUSE_RED : WHITE}
            sharp
          />
        ))}
      </Wobble>
      <Blinker position={[0, 0.78, 0]} color="#ff6b6b" size={0.1} />
    </Frame>
  );
}

/** Agent docs: a little library with a giant open book on its roof. */
function Library({ stage, theme }: BuildingProps) {
  return (
    <Frame stage={stage} theme={theme}>
      <Box position={[0, 0.45, 0]} size={[1.1, 0.9, 0.85]} color={theme.base} />
      <Door position={[0, 0, 0.43]} w={0.3} h={0.45} />
      <Win position={[-0.35, 0.55, 0.43]} w={0.2} h={0.3} />
      <Win position={[0.35, 0.55, 0.43]} w={0.2} h={0.3} />
      <Badge of="extras:agent-docs" position={[0, 0.72, 0.45]} size={0.18} />
      <Box position={[0, 0.95, 0]} size={[1.2, 0.1, 0.95]} color={theme.accent} />
      <Wobble kind="bob" amount={0.05} speed={1.4} position={[0, 1.15, 0]}>
        <Box
          position={[-0.27, 0, 0]}
          rotation={[0, 0, 0.22]}
          size={[0.56, 0.06, 0.7]}
          color="#7a4fd0"
        />
        <Box
          position={[0.27, 0, 0]}
          rotation={[0, 0, -0.22]}
          size={[0.56, 0.06, 0.7]}
          color="#7a4fd0"
        />
        <Box
          position={[-0.26, 0.05, 0]}
          rotation={[0, 0, 0.22]}
          size={[0.5, 0.04, 0.62]}
          color={WHITE}
          glow={0.25}
          sharp
        />
        <Box
          position={[0.26, 0.05, 0]}
          rotation={[0, 0, -0.22]}
          size={[0.5, 0.04, 0.62]}
          color={WHITE}
          glow={0.25}
          sharp
        />
      </Wobble>
    </Frame>
  );
}

/** Google sign-in: a pennant in four bright stripes, the logo on its post. */
function Pennant({ stage, theme }: BuildingProps) {
  const stripes = ["#4285f4", "#ea4335", "#fbbc05", "#34a853"];
  return (
    <Frame stage={stage} theme={theme}>
      <Cyl position={[0, 0.03, 0]} r={0.25} h={0.06} seg={8} color={STONE} />
      <Cyl position={[0, 0.65, 0]} r={0.03} h={1.3} seg={5} color={METAL} />
      <Wobble kind="sway" axis="y" amount={0.3} speed={2.5} position={[0, 1.18, 0]}>
        {stripes.map((color, i) => (
          <Box
            key={color}
            position={[0.24, -i * 0.09, 0]}
            size={[0.42, 0.09, 0.03]}
            color={color}
            sharp
          />
        ))}
      </Wobble>
      <Badge of="authMethods:google" position={[0, 0.55, 0.05]} size={0.24} />
    </Frame>
  );
}

/** GitHub sign-in: a dark signpost with the logo. */
function GitSign({ stage, theme }: BuildingProps) {
  return (
    <Frame stage={stage} theme={theme}>
      <Cyl position={[0, 0.4, 0]} r={0.04} h={0.8} seg={5} color={INK} />
      <Box position={[0, 0.95, 0]} size={[0.55, 0.5, 0.06]} color={INK} />
      <Badge of="authMethods:github" position={[0, 0.95, 0.04]} size={0.3} />
    </Frame>
  );
}

/** Password sign-in: a big brass padlock on a post. */
function Padlock({ stage, theme }: BuildingProps) {
  return (
    <Frame stage={stage} theme={theme}>
      <Cyl position={[0, 0.3, 0]} r={0.05} h={0.6} seg={5} color={DARK} />
      <Box position={[0, 0.78, 0]} size={[0.46, 0.38, 0.2]} color="#e2b33c" />
      <Ring
        position={[0, 0.97, 0]}
        rotation={[0, 0, 0]}
        r={0.15}
        tube={0.04}
        arc={Math.PI}
        color={METAL}
      />
      <Badge of="authMethods:password" position={[0, 0.76, 0.11]} size={0.2} />
    </Frame>
  );
}

/** Magic link sign-in: a mailbox with a sparkle spinning above it. */
function SparkleMailbox({ stage, theme }: BuildingProps) {
  return (
    <Frame stage={stage} theme={theme}>
      <Cyl position={[0, 0.3, 0]} r={0.04} h={0.6} seg={5} color={DARK} />
      <Box position={[0, 0.72, 0]} size={[0.3, 0.26, 0.42]} color={theme.accent} />
      <Cyl
        position={[0, 0.85, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        r={0.15}
        h={0.42}
        seg={8}
        from={Math.PI / 2}
        arc={Math.PI}
        color={theme.accent}
      />
      <Badge of="authMethods:magic-link" position={[0, 0.72, 0.22]} size={0.14} />
      <Box position={[0.17, 0.85, -0.1]} size={[0.03, 0.22, 0.06]} color={LIGHTHOUSE_RED} sharp />
      <Spin speed={1.5} position={[0, 1.35, 0]}>
        <Box
          rotation={[0, 0, Math.PI / 4]}
          size={[0.07, 0.3, 0.04]}
          color="#c48cff"
          glow={1.4}
          sharp
          shadow={false}
        />
        <Box
          rotation={[0, 0, -Math.PI / 4]}
          size={[0.07, 0.3, 0.04]}
          color="#c48cff"
          glow={1.4}
          sharp
          shadow={false}
        />
      </Spin>
    </Frame>
  );
}

/** An extra or sign-in method the town doesn't know: a crate with a little flag. */
export function GenericProp({ stage, theme }: BuildingProps) {
  return (
    <Frame stage={stage} theme={theme}>
      <Box position={[0, 0.25, 0]} size={[0.5, 0.5, 0.5]} color="#c98a4b" />
      <Cyl position={[0.15, 0.75, 0.15]} r={0.02} h={0.5} seg={4} color={METAL} />
      <Box position={[0.27, 0.92, 0.15]} size={[0.22, 0.14, 0.02]} color={theme.accent} sharp />
    </Frame>
  );
}

export const EXTRAS = {
  example: NotesKiosk,
  ci: Lighthouse,
  env: Checkpoint,
  tests: Watchtower,
  "agent-docs": Library,
};

export const AUTH_METHODS = {
  google: Pennant,
  github: GitSign,
  password: Padlock,
  "magic-link": SparkleMailbox,
};

/** The styling answer: a fountain in the town square, paint pouring from a tipped bucket
 * into a basin of the theme colour. */
export function PaintFountain({ stage, theme }: Omit<BuildingProps, "label">) {
  return (
    <Frame stage={stage} theme={theme}>
      <Cyl position={[0, 0.2, 0]} r={1.15} top={1.2} h={0.4} seg={12} color={theme.base} />
      <Cyl position={[0, 0.38, 0]} r={1.02} h={0.06} seg={12} color={theme.accent} glow={0.35} />
      <Cyl position={[0, 0.75, 0]} r={0.16} h={0.8} seg={8} color={theme.base} />
      <Wobble kind="sway" amount={0.08} speed={1.2} position={[0.05, 1.3, 0]}>
        <group rotation={[0, 0, 0.7]}>
          <Cyl r={0.24} top={0.3} h={0.38} seg={10} color={METAL} />
          <Cyl position={[0, 0.17, 0]} r={0.27} h={0.04} seg={10} color={theme.accent} glow={0.3} />
        </group>
      </Wobble>
      <Cyl position={[-0.32, 0.82, 0]} r={0.06} h={0.9} seg={6} color={theme.accent} glow={0.35} />
      <Box position={[0, 0.13, 1.45]} size={[0.9, 0.26, 0.3]} color={WOOD} />
      <Box position={[0, 0.13, -1.45]} size={[0.9, 0.26, 0.3]} color={WOOD} />
    </Frame>
  );
}
