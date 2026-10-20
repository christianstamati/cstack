// The surveyed plot: while the crane waits on the next lot, the lot is marked out with
// wooden stakes and a taut orange string, like a builder's plot. Only the crane's target is
// marked; the rest of the land stays bare until its answer comes.
import type { TownState } from "../../../src/town/protocol.ts";
import { isThinking, LOT_SIZE, lotPosition, nextLot } from "../logic.ts";
import { CITY } from "./palette.ts";

const STAKE_HEIGHT = 0.55;
const STRING_HEIGHT = 0.4;

export function SurveyPlot({ state }: { state: TownState }) {
  const target = isThinking(state) ? nextLot(state) : null;
  if (!target) return null;
  const [x, , z] = lotPosition(target);
  const half = LOT_SIZE / 2;
  const corners = [
    [-half, -half],
    [half, -half],
    [half, half],
    [-half, half],
  ] as const;
  return (
    <group key={target} position={[x, 0, z]}>
      {corners.map(([cx, cz]) => (
        <group key={`${cx},${cz}`} position={[cx, 0, cz]}>
          <mesh position={[0, STAKE_HEIGHT / 2, 0]} castShadow>
            <boxGeometry args={[0.08, STAKE_HEIGHT, 0.08]} />
            <meshStandardMaterial color={CITY.stake} flatShading />
          </mesh>
          <mesh position={[0, STAKE_HEIGHT + 0.03, 0]}>
            <boxGeometry args={[0.1, 0.06, 0.1]} />
            <meshStandardMaterial color={CITY.string} flatShading />
          </mesh>
        </group>
      ))}
      {corners.map(([cx, cz], i) => {
        const [nx, nz] = corners[(i + 1) % corners.length]!;
        const alongX = cz === nz;
        return (
          <mesh key={i} position={[(cx + nx) / 2, STRING_HEIGHT, (cz + nz) / 2]}>
            <boxGeometry args={[alongX ? LOT_SIZE : 0.025, 0.025, alongX ? 0.025 : LOT_SIZE]} />
            <meshStandardMaterial
              color={CITY.string}
              emissive={CITY.string}
              emissiveIntensity={0.3}
            />
          </mesh>
        );
      })}
    </group>
  );
}
