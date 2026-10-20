// Toolchain: a purple workshop with a lightning bolt for Vite+, a greenhouse with a crane
// hook for Biome + Lefthook.
import { Badge } from "./Badge.tsx";
import {
  Ball,
  Box,
  Cyl,
  Door,
  Extruded,
  Frame,
  Gable,
  METAL,
  Plinth,
  Ring,
  Spin,
  Win,
  Wobble,
  WOOD,
  type BuildingProps,
} from "./kit.tsx";

const BOLT = "#ffc62e";
const VITE_PURPLE = "#9135ff";
/** A lightning bolt, about 1.4 high, standing on its tip. */
const BOLT_SHAPE = [
  [0.05, 1.4],
  [-0.3, 0.6],
  [-0.04, 0.6],
  [-0.2, 0],
  [0.32, 0.8],
  [0.06, 0.8],
  [0.25, 1.4],
] as const;

/** A cog: a disc with square teeth, facing +z. */
function Cog(props: { r: number; color: string }) {
  return (
    <group>
      <Cyl rotation={[Math.PI / 2, 0, 0]} r={props.r} h={0.08} seg={10} color={props.color} />
      {[0, 1, 2].map((i) => (
        <Box
          key={i}
          rotation={[0, 0, (i * Math.PI) / 3]}
          size={[props.r * 2.5, props.r * 0.4, 0.08]}
          color={props.color}
          sharp
        />
      ))}
    </group>
  );
}

/** Vite+: a sawtooth-roofed workshop, a lightning bolt on the roof and a turning cog. */
function Workshop({ stage, theme }: BuildingProps) {
  return (
    <Frame stage={stage} theme={theme}>
      <Plinth w={2.6} d={2.1} />
      <Box position={[0, 0.77, 0]} size={[2.2, 1.3, 1.6]} color={theme.base} />
      <Gable position={[-0.55, 1.42, 0]} w={1.1} h={0.55} d={1.7} color={VITE_PURPLE} />
      <Gable position={[0.55, 1.42, 0]} w={1.1} h={0.55} d={1.7} color="#6f2bd6" />
      <Wobble kind="sway" amount={0.06} speed={2.2} position={[0.1, 1.9, 0]}>
        <Extruded points={BOLT_SHAPE} depth={0.12} color={BOLT} glow={0.8} />
      </Wobble>
      <Door position={[-0.5, 0.12, 0.81]} w={0.8} h={0.85} />
      {[0.42, 0.62, 0.82].map((y) => (
        <Box
          key={y}
          position={[-0.5, y, 0.85]}
          size={[0.8, 0.03, 0.02]}
          color="#3a3f4d"
          sharp
          shadow={false}
        />
      ))}
      <Badge of="toolchain:vite-plus" position={[0.55, 1.0, 0.84]} size={0.4} />
      <Box position={[0.55, 0.42, 0.84]} size={[0.3, 0.08, 0.04]} color={BOLT} glow={0.6} sharp />
      <Box position={[0.55, 0.42, 0.84]} size={[0.08, 0.3, 0.04]} color={BOLT} glow={0.6} sharp />
      <Spin axis="z" speed={1.2} position={[1.15, 1.0, 0.45]} rotation={[0, Math.PI / 2, 0]}>
        <Cog r={0.18} color={METAL} />
      </Spin>
      <Win position={[1.11, 0.8, -0.3]} rotation={[0, Math.PI / 2, 0]} />
    </Frame>
  );
}

const GLASS = "#9ff0b8";

/** Biome + Lefthook: a greenhouse full of plants, a crane hook swinging on its left. */
function Greenhouse({ stage, theme }: BuildingProps) {
  return (
    <Frame stage={stage} theme={theme}>
      <Plinth w={2.7} d={2.0} />
      <Box position={[0.25, 0.32, 0]} size={[2.0, 0.4, 1.5]} color={theme.base} />
      <Box
        position={[0.25, 0.92, 0]}
        size={[1.96, 0.8, 1.46]}
        color={GLASS}
        glow={0.3}
        opacity={0.5}
        sharp
      />
      <Gable
        position={[0.25, 1.32, 0]}
        w={1.96}
        h={0.65}
        d={1.46}
        color={GLASS}
        glow={0.3}
        opacity={0.5}
      />
      <Ball position={[-0.25, 0.78, 0.1]} r={0.32} color="#3f9a55" />
      <Ball position={[0.4, 0.82, -0.2]} r={0.38} color="#4cae5f" />
      <Ball position={[0.85, 0.74, 0.3]} r={0.26} color="#2f8a4a" />
      <Ball position={[0.4, 1.25, -0.2]} r={0.1} detail={0} color="#ff8fb1" glow={0.3} />
      <Box position={[0.25, 0.65, 0.74]} size={[0.5, 0.66, 0.05]} color={theme.accent} sharp />
      <Cyl position={[0.95, 0.4, 1.0]} r={0.035} h={0.8} seg={5} color={WOOD} />
      <Badge of="toolchain:biome-lefthook" position={[0.95, 0.85, 1.0]} size={0.34} />
      <Cyl position={[-1.1, 1.2, 0]} r={0.07} h={2.4} seg={6} color={METAL} />
      <Box position={[-0.78, 2.36, 0]} size={[0.75, 0.08, 0.08]} color={METAL} sharp />
      <Wobble kind="sway" amount={0.18} speed={1.4} position={[-0.48, 2.34, 0]}>
        <Cyl position={[0, -0.3, 0]} r={0.02} h={0.6} seg={4} color="#d9d4c4" />
        <Ring
          position={[0, -0.72, 0]}
          rotation={[0, 0, Math.PI * 1.05]}
          r={0.14}
          tube={0.045}
          arc={Math.PI * 1.4}
          color="#ff1e1e"
        />
      </Wobble>
    </Frame>
  );
}

export const TOOLCHAIN = { "vite-plus": Workshop, "biome-lefthook": Greenhouse };
