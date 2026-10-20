// The town's entrance: a wooden sign with the project name between two lantern posts.
import {
  Ball,
  Box,
  Cyl,
  DARK_WOOD,
  Frame,
  LabelBoard,
  LAMP,
  WOOD,
  type BuildingProps,
} from "../buildings/kit.tsx";

/** `label` is the project name. */
export function NameSign({ label, stage, theme }: BuildingProps) {
  return (
    <Frame stage={stage} theme={theme}>
      {[-1.6, 1.6].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <Cyl position={[0, 1.05, 0]} r={0.1} h={2.1} seg={6} color={WOOD} />
          <Box position={[0, 2.15, 0]} size={[0.28, 0.1, 0.28]} color={DARK_WOOD} />
          <Ball position={[0, 2.32, 0]} r={0.14} color={LAMP} glow={1.4} shadow={false} />
        </group>
      ))}
      <Box position={[0, 1.95, 0]} size={[3.3, 0.1, 0.12]} color={DARK_WOOD} />
      <LabelBoard
        position={[0, 1.45, 0]}
        text={label}
        w={3.0}
        h={0.75}
        color={theme.accent}
        ink="#fff8e8"
      />
      <Cyl position={[-1.0, 1.88, 0]} r={0.015} h={0.12} seg={4} color={DARK_WOOD} />
      <Cyl position={[1.0, 1.88, 0]} r={0.015} h={0.12} seg={4} color={DARK_WOOD} />
    </Frame>
  );
}
