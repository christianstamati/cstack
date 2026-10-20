// The fallback: a plain building for an option the town has no model for.
import {
  Box,
  Cyl,
  Door,
  Frame,
  INK,
  LabelBoard,
  Plinth,
  WHITE,
  WOOD,
  Win,
  type BuildingProps,
} from "./kit.tsx";

/** An option the town doesn't know (a tool added to the prompt later): a plain flat-roofed
 * building with the option's label on a board in front. */
export function Generic({ label, stage, theme }: BuildingProps) {
  return (
    <Frame stage={stage} theme={theme}>
      <Plinth w={2.3} d={2.1} />
      <Box position={[0, 0.82, -0.25]} size={[1.7, 1.4, 1.3]} color={theme.base} />
      <Box position={[0, 1.58, -0.25]} size={[1.8, 0.12, 1.4]} color={theme.accent} />
      <Door position={[0, 0.12, 0.41]} />
      <Win position={[-0.55, 0.95, 0.41]} />
      <Win position={[0.55, 0.95, 0.41]} />
      <Cyl position={[-0.75, 0.45, 0.85]} r={0.04} h={0.9} seg={5} color={WOOD} />
      <Cyl position={[0.75, 0.45, 0.85]} r={0.04} h={0.9} seg={5} color={WOOD} />
      <LabelBoard
        position={[0, 0.78, 0.85]}
        text={label}
        w={1.7}
        h={0.42}
        color={WHITE}
        ink={INK}
      />
    </Frame>
  );
}
