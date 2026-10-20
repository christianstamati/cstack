// The finale, once the report is in. It follows the clock: at night the town dims for a
// moment and its windows and street lamps come on from the centre outward, then a few
// fireworks burst over the roofs; by day confetti pops over the town and balloons float up.
// Either way it lasts a few seconds, and then the billboard says the project is ready. With
// reduced motion there is no show: the lights simply come on at night.
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useState } from "react";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DoubleSide,
  InstancedMesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Points,
  PointsMaterial,
  SphereGeometry,
} from "three";

import type { TownState } from "../../../src/town/protocol.ts";
import { prefersReducedMotion } from "../buildings/Drop.tsx";
import { FINALE_SECONDS, finaleKind, NAME_SPOT, seededRandom, type FinaleKind } from "../logic.ts";
import { assignBlocks, blockCentre, type Point } from "../streets.ts";
import { currentNight } from "./daylight.ts";
import { startFinale, tickFinale } from "./finale.ts";

const now = () => performance.now() / 1000;

/** Where the show happens: over the blocks built, else over the entrance. */
function showSpots(state: TownState): Point[] {
  const cells = Object.values(assignBlocks(state.placements));
  return cells.length > 0 ? cells.map(blockCentre) : [NAME_SPOT];
}

/** `entered`: the entry screen is gone, so the show is seen. */
export function LightsUp({ state, entered }: { state: TownState; entered: boolean }) {
  const finished = state.phase === "done" && state.report !== null && entered;
  const [show, setShow] = useState<{ kind: FinaleKind; start: number } | null>(null);
  useEffect(() => {
    if (!finished || show) return;
    const night = currentNight();
    const kind = finaleKind(night, prefersReducedMotion());
    const start = now();
    startFinale(kind, night >= 0.5, start);
    setShow({ kind, start });
  }, [finished, show]);
  const [playing, setPlaying] = useState(true);
  useFrame(() => {
    // A still finale is over at once: nothing to tick.
    if (!show || !playing || show.kind === "still") return;
    if (tickFinale(now()) >= FINALE_SECONDS) setPlaying(false);
  });
  const spots = useMemo(() => showSpots(state), [finished]);
  if (!show || !playing) return null;
  if (show.kind === "night") return <Fireworks start={show.start} spots={spots} />;
  if (show.kind === "day") return <Celebration start={show.start} spots={spots} />;
  return null;
}

/** A soft round dot, for the sparks. */
function dotTexture(): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 32;
  const context = canvas.getContext("2d");
  if (context) {
    const glow = context.createRadialGradient(16, 16, 0, 16, 16, 16);
    glow.addColorStop(0, "rgba(255,255,255,1)");
    glow.addColorStop(0.35, "rgba(255,255,255,0.8)");
    glow.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = glow;
    context.fillRect(0, 0, 32, 32);
  }
  return new CanvasTexture(canvas);
}

const FIREWORK_COLORS = ["#ff8fb8", "#8fe3ff", "#ffe08a", "#b9a2ff", "#9cf5b5", "#ffb27a"];
/** When each rocket goes up, in seconds into the show (after the lights have come on). */
const LAUNCHES = [1.3, 1.75, 2.15, 2.5, 2.8, 3.05];
const RISE = 0.6;
const SPARK_LIFE = 1.3;
const SPARKS = 70;

interface Burst {
  launch: number;
  from: [number, number, number];
  to: [number, number, number];
  color: Color;
  directions: Float32Array;
}

/** Rockets rise from the blocks and burst into sparks that drift down and fade. Every spark
 * is a point of one cloud, moved each frame: one draw call. */
function Fireworks({ start, spots }: { start: number; spots: Point[] }) {
  const pixelRatio = useThree((three) => three.gl.getPixelRatio());
  const { points, bursts } = useMemo(() => {
    const random = seededRandom(31);
    const bursts: Burst[] = LAUNCHES.map((launch, i) => {
      const [x, z] = spots[Math.floor(random() * spots.length)]!;
      const [dx, dz] = [(random() - 0.5) * 2.5, (random() - 0.5) * 2.5];
      const directions = new Float32Array(SPARKS * 3);
      for (let k = 0; k < SPARKS; k++) {
        // Evenly round a sphere (a Fibonacci spiral), each spark a little faster or slower.
        const y = 1 - (2 * (k + 0.5)) / SPARKS;
        const ring = Math.sqrt(1 - y * y);
        const angle = k * 2.399963 + i;
        const speed = 3.6 + random() * 1.2;
        directions.set(
          [Math.cos(angle) * ring * speed, y * speed, Math.sin(angle) * ring * speed],
          k * 3,
        );
      }
      return {
        launch,
        from: [x + dx, 1, z + dz],
        to: [x + dx * 0.6, 5.2 + random() * 1.8, z + dz * 0.6],
        color: new Color(FIREWORK_COLORS[i % FIREWORK_COLORS.length]!),
        directions,
      };
    });
    const count = bursts.length * (SPARKS + 1);
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(new Float32Array(count * 3), 3));
    geometry.setAttribute("color", new BufferAttribute(new Float32Array(count * 3), 3));
    const material = new PointsMaterial({
      size: 9,
      sizeAttenuation: false,
      vertexColors: true,
      map: dotTexture(),
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      toneMapped: false,
    });
    const points = new Points(geometry, material);
    points.frustumCulled = false;
    return { points, bursts };
  }, [spots]);
  useEffect(
    () => () => {
      points.geometry.dispose();
      const material = points.material as PointsMaterial;
      material.map?.dispose();
      material.dispose();
    },
    [points],
  );
  useEffect(() => {
    (points.material as PointsMaterial).size = 9 * pixelRatio;
  }, [points, pixelRatio]);

  useFrame(() => {
    const t = now() - start;
    const position = points.geometry.getAttribute("position") as BufferAttribute;
    const color = points.geometry.getAttribute("color") as BufferAttribute;
    const p = position.array as Float32Array;
    const c = color.array as Float32Array;
    bursts.forEach((burst, b) => {
      const base = b * (SPARKS + 1);
      const since = t - burst.launch;
      const [fx, fy, fz] = burst.from;
      const [tx, ty, tz] = burst.to;
      // The rocket: a bright point climbing, slowing as it goes.
      const rising = since >= 0 && since < RISE;
      const u = rising ? 1 - (1 - since / RISE) ** 2 : 0;
      p.set([fx + (tx - fx) * u, fy + (ty - fy) * u, fz + (tz - fz) * u], base * 3);
      const glow = rising ? 0.9 : 0;
      c.set([glow, glow * 0.85, glow * 0.6], base * 3);
      // The sparks: thrown out, slowed by the air, pulled down, fading.
      const s = since - RISE;
      const alive = s >= 0 && s < SPARK_LIFE;
      const spread = alive ? (1 - Math.exp(-s * 2.4)) / 2.4 : 0;
      const fade = alive ? (1 - s / SPARK_LIFE) ** 1.6 : 0;
      for (let k = 0; k < SPARKS; k++) {
        const i = (base + 1 + k) * 3;
        const d = k * 3;
        p[i] = tx + burst.directions[d]! * spread;
        p[i + 1] = ty + burst.directions[d + 1]! * spread - 0.9 * s * s * (alive ? 1 : 0);
        p[i + 2] = tz + burst.directions[d + 2]! * spread;
        const twinkle = fade * (0.75 + 0.25 * Math.sin(t * 40 + k));
        c[i] = burst.color.r * twinkle;
        c[i + 1] = burst.color.g * twinkle;
        c[i + 2] = burst.color.b * twinkle;
      }
    });
    position.needsUpdate = true;
    color.needsUpdate = true;
  });
  return <primitive object={points} />;
}

const PARTY_COLORS = ["#ff8fb8", "#7fd3ff", "#ffd56b", "#a98bff", "#7fe0a0", "#ff9f6b"];
const CONFETTI = 220;
const BALLOONS = 14;

interface Piece {
  from: [number, number, number];
  velocity: [number, number, number];
  delay: number;
  spin: [number, number];
  phase: number;
}

/** Confetti pops up over the town from a few spots and flutters down; balloons float up from
 * the blocks. Two instanced meshes for the confetti and the balloons, one for their strings. */
function Celebration({ start, spots }: { start: number; spots: Point[] }) {
  const parts = useMemo(() => {
    const random = seededRandom(53);
    const poppers = [0, 1, 2, 3].map((i) => spots[(i * 3) % spots.length]!);
    const pieces: Piece[] = Array.from({ length: CONFETTI }, (_, i) => {
      const [x, z] = poppers[i % poppers.length]!;
      const angle = random() * Math.PI * 2;
      const out = 1.5 + random() * 3;
      return {
        from: [x, 1.2, z],
        velocity: [Math.cos(angle) * out, 8 + random() * 4, Math.sin(angle) * out],
        delay: Math.floor((i * 3) / CONFETTI) * 0.35 + random() * 0.1,
        spin: [2 + random() * 5, 2 + random() * 5],
        phase: random() * Math.PI * 2,
      };
    });
    const balloons = Array.from({ length: BALLOONS }, (_, i) => {
      const [x, z] = spots[i % spots.length]!;
      return {
        x: x + (random() - 0.5) * 3,
        z: z + (random() - 0.5) * 3,
        delay: 0.15 + random() * 1.1,
        speed: 1.6 + random() * 0.8,
        phase: random() * Math.PI * 2,
      };
    });
    const confetti = new InstancedMesh(
      new PlaneGeometry(0.3, 0.45),
      new MeshBasicMaterial({ side: DoubleSide, toneMapped: false }),
      CONFETTI,
    );
    const balloon = new InstancedMesh(
      new SphereGeometry(0.6, 12, 9),
      new MeshStandardMaterial({ flatShading: true, roughness: 0.4 }),
      BALLOONS,
    );
    const strings = new InstancedMesh(
      new CylinderGeometry(0.015, 0.015, 1.5, 3).translate(0, -0.75, 0),
      new MeshBasicMaterial({ color: "#f4f1ea" }),
      BALLOONS,
    );
    const color = new Color();
    for (let i = 0; i < CONFETTI; i++)
      confetti.setColorAt(i, color.set(PARTY_COLORS[i % PARTY_COLORS.length]!));
    for (let i = 0; i < BALLOONS; i++)
      balloon.setColorAt(i, color.set(PARTY_COLORS[(i * 2) % PARTY_COLORS.length]!));
    for (const mesh of [confetti, balloon, strings]) mesh.frustumCulled = false;
    return { pieces, balloons, confetti, balloon, strings };
  }, [spots]);
  useEffect(
    () => () => {
      for (const mesh of [parts.confetti, parts.balloon, parts.strings]) {
        mesh.geometry.dispose();
        (mesh.material as MeshBasicMaterial).dispose();
        mesh.dispose();
      }
    },
    [parts],
  );
  const dummy = useMemo(() => new Object3D(), []);

  useFrame(() => {
    const t = now() - start;
    // Everything shrinks away over the last half second.
    const end = Math.min(Math.max((FINALE_SECONDS - t) / 0.5, 0), 1);
    parts.pieces.forEach((piece, i) => {
      const s = t - piece.delay;
      if (s < 0) {
        dummy.scale.setScalar(0.0001);
      } else {
        // Thrown up, slowed hard by the air: it drifts down at a gentle flutter.
        const slow = (1 - Math.exp(-s * 1.8)) / 1.8;
        const [vx, vy, vz] = piece.velocity;
        const sway = Math.sin(s * 3 + piece.phase) * 0.25;
        const y = Math.max(piece.from[1] + vy * slow - 1.15 * s, 0.15);
        dummy.position.set(piece.from[0] + vx * slow + sway, y, piece.from[2] + vz * slow);
        dummy.rotation.set(s * piece.spin[0], s * piece.spin[1], piece.phase);
        dummy.scale.setScalar(Math.max(end, 0.0001));
      }
      dummy.updateMatrix();
      parts.confetti.setMatrixAt(i, dummy.matrix);
    });
    parts.confetti.instanceMatrix.needsUpdate = true;
    parts.balloons.forEach((b, i) => {
      const s = Math.max(t - b.delay, 0);
      const up = s > 0 ? Math.min(s / 0.4, 1) : 0;
      const x = b.x + Math.sin(s * 1.4 + b.phase) * 0.18;
      const y = 1.2 + b.speed * s;
      dummy.rotation.set(0, 0, Math.sin(s * 1.4 + b.phase) * 0.12);
      dummy.position.set(x, y, b.z);
      const grown = Math.max(up * end, 0.0001);
      dummy.scale.set(grown, 1.2 * grown, grown);
      dummy.updateMatrix();
      parts.balloon.setMatrixAt(i, dummy.matrix);
      dummy.position.set(x, y - 0.68 * grown, b.z);
      dummy.scale.setScalar(grown);
      dummy.updateMatrix();
      parts.strings.setMatrixAt(i, dummy.matrix);
    });
    parts.balloon.instanceMatrix.needsUpdate = true;
    parts.strings.instanceMatrix.needsUpdate = true;
  });
  return (
    <>
      <primitive object={parts.confetti} />
      <primitive object={parts.balloon} />
      <primitive object={parts.strings} />
    </>
  );
}
