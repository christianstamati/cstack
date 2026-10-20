// Structure: one cosy house for a single app, a row of townhouses for a monorepo.
import { Badge } from "./Badge.tsx";
import { Box, Door, Frame, Gable, Plinth, Smoke, Win, type BuildingProps } from "./kit.tsx";

const TERRACOTTA = "#c4553f";
const BRICK = "#8d4a3a";
const FLOWERS = "#ff8fb1";

/** Single app: one house with a red pitched roof, flower boxes and a smoking chimney. */
function House({ stage, theme }: BuildingProps) {
  return (
    <Frame stage={stage} theme={theme}>
      <Plinth w={2.5} d={2.3} />
      <Box position={[0, 0.82, 0]} size={[1.8, 1.4, 1.6]} color={theme.base} />
      <Gable position={[0, 1.52, 0]} w={2.2} h={1.0} d={1.9} color={TERRACOTTA} />
      <Box position={[0.5, 2.1, -0.25]} size={[0.3, 0.8, 0.3]} color={BRICK} />
      <Smoke position={[0.5, 2.55, -0.25]} />
      <Badge of="structure:single" position={[0, 1.88, 0.96]} size={0.32} />
      <Door position={[0, 0.12, 0.81]} />
      <Box position={[0, 0.8, 0.95]} size={[0.6, 0.06, 0.3]} color={theme.accent} />
      {[-0.55, 0.55].map((x) => (
        <group key={x}>
          <Win position={[x, 0.95, 0.81]} />
          <Box position={[x, 0.71, 0.86]} size={[0.4, 0.1, 0.12]} color={theme.accent} />
          <Box position={[x, 0.78, 0.86]} size={[0.34, 0.06, 0.08]} color={FLOWERS} sharp />
        </group>
      ))}
      <Win position={[0.91, 0.95, 0]} rotation={[0, Math.PI / 2, 0]} />
      <Win position={[-0.91, 0.95, 0]} rotation={[0, Math.PI / 2, 0]} />
      {[0.95, 1.12].map((z) => (
        <Box key={z} position={[0, 0.13, z]} size={[0.3, 0.03, 0.12]} color="#b9b4a6" />
      ))}
    </Frame>
  );
}

const ROW = [
  { x: -0.9, h: 1.3, roof: "#5b7fc7", chimney: true },
  { x: 0, h: 1.85, roof: TERRACOTTA, chimney: false },
  { x: 0.9, h: 1.1, roof: "#6aa35f", chimney: true },
] as const;

/** Monorepo: three townhouses of different heights on one shared plinth and awning. */
function Terrace({ stage, theme }: BuildingProps) {
  return (
    <Frame stage={stage} theme={theme}>
      <Plinth w={2.8} d={1.9} />
      {ROW.map((house) => (
        <group key={house.x} position={[house.x, 0.12, 0]}>
          <Box position={[0, house.h / 2, 0]} size={[0.86, house.h, 1.4]} color={theme.base} />
          <Gable position={[0, house.h, 0]} w={0.96} h={0.55} d={1.55} color={house.roof} />
          {house.chimney ? (
            <>
              <Box
                position={[0.22, house.h + 0.45, -0.3]}
                size={[0.16, 0.45, 0.16]}
                color={BRICK}
              />
              <Smoke position={[0.22, house.h + 0.7, -0.3]} />
            </>
          ) : null}
          <Door position={[0, 0, 0.71]} w={0.32} h={0.5} />
          <Win position={[-0.2, house.h - 0.35, 0.71]} w={0.2} h={0.28} />
          <Win position={[0.2, house.h - 0.35, 0.71]} w={0.2} h={0.28} />
        </group>
      ))}
      <Box position={[0, 0.8, 0.92]} size={[2.7, 0.06, 0.34]} color={theme.accent} />
      <Badge of="structure:monorepo" position={[0, 1.15, 0.72]} size={0.28} />
    </Frame>
  );
}

export const STRUCTURE = { single: House, monorepo: Terrace };
