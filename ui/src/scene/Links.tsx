// How the stack's pieces depend on each other (see src/town/links.ts), drawn as glowing
// traffic on the streets: each link is a thin light trail along the street route from one
// block's kerb to the other's, with pulses of light running from the first to the second.
// Trails that share a street keep to different lanes, each lane in its own colour.
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { BufferAttribute, BufferGeometry, Color, ShaderMaterial } from "three";

import { activeLinks } from "../../../src/town/links.ts";
import type { TownState } from "../../../src/town/protocol.ts";
import { routePieces, streetRoute, trailLanes, type Point } from "../streets.ts";
import { pavedTime } from "./Streets.tsx";

/** Lane colours, by lane across the street. */
const COLORS: Readonly<Record<number, string>> = { [-1]: "#ff7fcf", 0: "#3fd8ff", 1: "#8cf26f" };
/** How far from the centre-line each lane runs. */
const LANE_OFFSET = 0.42;
const WIDTH = 0.17;
const HEIGHT = 0.05;
const FADE_IN = 1.0;

/** A flat ribbon along `route`, `offset` across the street (towards +z on legs along x,
 * towards +x on legs along z, so a lane is the same side whichever way a trail runs). Each
 * vertex knows how far along the route it is, and which side of the ribbon it's on. */
function ribbon(route: Point[], offset: number): BufferGeometry {
  const positions: number[] = [];
  const along: number[] = [];
  const side: number[] = [];
  const index: number[] = [];
  // Every point shifts across both its legs (one leg at the ends).
  const shifted = route.map(([x, z], i): Point => {
    const legs = [route[i - 1], route[i + 1]].filter((p): p is Point => p !== undefined);
    const alongX = legs.some((p) => p[1] === z);
    const alongZ = legs.some((p) => p[0] === x);
    return [x + (alongZ ? offset : 0), z + (alongX ? offset : 0)];
  });
  let distance = 0;
  for (let i = 1; i < shifted.length; i++) {
    const [p, q] = [shifted[i - 1]!, shifted[i]!];
    const length = Math.abs(q[0] - p[0]) + Math.abs(q[1] - p[1]);
    const dx = (q[0] - p[0]) / length;
    const dz = (q[1] - p[1]) / length;
    // Run on over the corners by half the width, so the legs join up.
    const before = i > 1 ? WIDTH / 2 : 0;
    const after = i < shifted.length - 1 ? WIDTH / 2 : 0;
    const start: Point = [p[0] - dx * before, p[1] - dz * before];
    const end: Point = [q[0] + dx * after, q[1] + dz * after];
    const [nx, nz] = [-dz * (WIDTH / 2), dx * (WIDTH / 2)];
    const base = positions.length / 3;
    positions.push(
      start[0] + nx,
      HEIGHT,
      start[1] + nz,
      start[0] - nx,
      HEIGHT,
      start[1] - nz,
      end[0] + nx,
      HEIGHT,
      end[1] + nz,
      end[0] - nx,
      HEIGHT,
      end[1] - nz,
    );
    along.push(
      distance - before,
      distance - before,
      distance + length + after,
      distance + length + after,
    );
    side.push(1, -1, 1, -1);
    index.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
    distance += length;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute("aAlong", new BufferAttribute(new Float32Array(along), 1));
  geometry.setAttribute("aSide", new BufferAttribute(new Float32Array(side), 1));
  geometry.setIndex(index);
  geometry.computeBoundingSphere();
  return geometry;
}

const VERTEX = /* glsl */ `
  attribute float aAlong;
  attribute float aSide;
  varying float vAlong;
  varying float vSide;
  void main() {
    vAlong = aAlong;
    vSide = aSide;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uFade;
  uniform float uPhase;
  uniform vec3 uColor;
  varying float vAlong;
  varying float vSide;
  void main() {
    float edge = 1.0 - smoothstep(0.45, 1.0, abs(vSide));
    float phase = fract(vAlong * 0.3 - uTime * 0.55 + uPhase);
    float pulse = smoothstep(0.75, 0.96, phase) * (1.0 - smoothstep(0.96, 1.0, phase));
    vec3 color = mix(uColor, vec3(1.0), pulse * 0.8);
    gl_FragColor = vec4(color, (0.5 + 0.5 * pulse) * edge * uFade);
    #include <colorspace_fragment>
  }
`;

function Trail({ route, lane, phase }: { route: Point[]; lane: number; phase: number }) {
  const geometry = useMemo(() => ribbon(route, lane * LANE_OFFSET), [route, lane]);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        uniforms: {
          uTime: { value: 0 },
          uFade: { value: 0 },
          uPhase: { value: phase },
          uColor: { value: new Color(COLORS[lane] ?? COLORS[0]) },
        },
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      }),
    [lane, phase],
  );
  // Lit once its whole way is paved.
  const ready = useMemo(() => {
    const times = routePieces(route).map((key) => pavedTime(key) ?? 0);
    return Math.max(performance.now() / 1000, ...times);
  }, [route]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);
  useFrame(({ clock }) => {
    material.uniforms.uTime!.value = clock.elapsedTime;
    const age = performance.now() / 1000 - ready;
    material.uniforms.uFade!.value = Math.min(Math.max(age / FADE_IN, 0), 1);
  });
  return <mesh geometry={geometry} material={material} renderOrder={1} />;
}

export function Links({ state }: { state: TownState }) {
  const placements = state.placements;
  // The same way keeps the same route array, so its trail isn't rebuilt on every update.
  const known = useRef(new Map<string, Point[]>());
  const trails = useMemo(() => {
    const links = activeLinks(placements);
    const routes = links.map(([a, b]) => streetRoute(a, b, placements));
    const lanes = trailLanes(routes);
    return links.flatMap(([a, b], i) => {
      const route = routes[i]!;
      if (route.length < 2) return [];
      const key = `${a}-${b}:${lanes[i]}:${route.map((p) => p.join(",")).join(";")}`;
      if (!known.current.has(key)) known.current.set(key, route);
      // Each link's pulses start at their own place along it.
      const name = `${a}${b}`;
      let sum = 0;
      for (let c = 0; c < name.length; c++) sum += name.charCodeAt(c);
      const phase = (sum * 0.137) % 1;
      return [{ key, route: known.current.get(key)!, lane: lanes[i]!, phase }];
    });
  }, [placements]);
  return (
    <>
      {trails.map((trail) => (
        <Trail key={trail.key} route={trail.route} lane={trail.lane} phase={trail.phase} />
      ))}
    </>
  );
}
