// The parts every building is made of: flat-shaded boxes, cylinders, roofs and glowing
// windows. Geometry and materials are declared as JSX, so R3F disposes them when a
// building unmounts (re-answering a question swaps the building).
//
// Colours are softened towards a warm white as they are drawn, so every building sits in the
// town's pastel daylight; windows are glass by day and lit at night (see `useNight`).
//
// A building wraps its parts in <Frame stage theme>. Every material (parts, logos, painted
// text, smoke, blinking lights) takes its stage styling from `stageLook`, the one place a
// stage's look is decided: `preview` is translucent, `blueprint` a glowing see-through
// wireframe, `constructing` gets scaffolding and a little bounce, `failed` turns sooty with
// smoke and a red flag; `placed` and `solid` are the building as it is.
import { extend, useFrame, type ThreeElement } from "@react-three/fiber";
import { createContext, useContext, useMemo, useRef, type ReactNode } from "react";
import {
  Color,
  Shape,
  SRGBColorSpace,
  type Group,
  type Mesh,
  type MeshStandardMaterial,
} from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

import { DEFAULT_THEME, type Stage, type Theme } from "../logic.ts";
import { useNight } from "../scene/daylight.ts";
import { useLightsUp } from "../scene/finale.ts";

declare module "@react-three/fiber" {
  interface ThreeElements {
    roundedBoxGeometry: ThreeElement<typeof RoundedBoxGeometry>;
  }
}
extend({ RoundedBoxGeometry });

export interface BuildingProps {
  /** The option's label, e.g. "Vercel". */
  label: string;
  stage: Stage;
  theme: Theme;
}

export type Vec3 = [x: number, y: number, z: number];

/** Shared colours: the warm lamp light in windows, and a few materials. */
export const LAMP = "#ffd98a";
export const WOOD = "#9a6b45";
export const DARK_WOOD = "#6b4a35";
export const STONE = "#a7a3b5";
export const METAL = "#8f97a8";
export const INK = "#22232b";
export const WHITE = "#f4f1ea";

interface KitValue {
  stage: Stage;
  theme: Theme;
}

const Kit = createContext<KitValue>({ stage: "placed", theme: DEFAULT_THEME });

export function useKit(): KitValue {
  return useContext(Kit);
}

export interface StageLook {
  opacity: number;
  transparent: boolean;
  depthWrite: boolean;
  /** Extra self-light added to every surface. */
  glow: number;
  /** Surfaces are drawn as a wireframe glowing in this colour (a blueprint), or null. */
  wire: string | null;
  /** How far colours fade towards soot (0 to 1). */
  soot: number;
  /** Scaffolding round the building, which bounces a little: it is being built. */
  scaffold: boolean;
  /** Smoke from the roof and a red flag: its build step failed. */
  failed: boolean;
}

/** The blueprint's glowing blue lines. */
const BLUEPRINT = "#8fd8ff";

/** How `stage` changes a material whose own opacity is `opacity`. */
export function stageLook(stage: Stage, opacity = 1): StageLook {
  const stageOpacity = stage === "preview" ? 0.45 : stage === "blueprint" ? 0.7 : 1;
  const alpha = opacity * stageOpacity;
  return {
    opacity: alpha,
    transparent: alpha < 1,
    depthWrite: alpha >= 1,
    glow: stage === "blueprint" ? 0.9 : 0,
    wire: stage === "blueprint" ? BLUEPRINT : null,
    soot: stage === "failed" ? 0.4 : 0,
    scaffold: stage === "constructing",
    failed: stage === "failed",
  };
}

/** Remounts a material when the stage changes how it is drawn (see three's needsUpdate). */
export function lookKey(look: StageLook): string {
  return `${look.transparent}:${look.wire !== null}`;
}

/** The root of every building: hands the stage and theme to its parts. */
export function Frame(props: { stage: Stage; theme: Theme; children: ReactNode }) {
  const { stage, theme } = props;
  const value = useMemo(() => ({ stage, theme }), [stage, theme]);
  return (
    <Kit.Provider value={value}>
      <group>{props.children}</group>
    </Kit.Provider>
  );
}

/** How much every part lights itself, so shadowed sides keep their toy colours. */
const SELF_LIGHT = 0.07;

/** How far colours are softened towards a warm white. */
const PASTEL = 0.14;
const pastels = new Map<string, string>();

const SOOT = [74, 70, 72];
const sooted = new Map<string, string>();

/** `color` (a #rrggbb hex) faded `amount` of the way to soot, as after a fire. */
export function soot(color: string, amount: number): string {
  if (amount <= 0 || !/^#[0-9a-f]{6}$/i.test(color)) return color;
  const key = `${color}:${amount}`;
  let dark = sooted.get(key);
  if (dark === undefined) {
    const n = Number.parseInt(color.slice(1), 16);
    const channels = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c, i) =>
      Math.round(c + (SOOT[i]! - c) * amount),
    );
    dark = `#${channels.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
    sooted.set(key, dark);
  }
  return dark;
}

/** `color` (a #rrggbb hex) softened into the town's pastel palette. */
export function pastel(color: string): string {
  let soft = pastels.get(color);
  if (soft === undefined) {
    soft = color;
    if (/^#[0-9a-f]{6}$/i.test(color)) {
      const n = Number.parseInt(color.slice(1), 16);
      const white = [255, 248, 238];
      const channels = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c, i) =>
        Math.round(c + (white[i]! - c) * PASTEL),
      );
      soft = `#${channels.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
    }
    pastels.set(color, soft);
  }
  return soft;
}

interface MatProps {
  color: string;
  /** Lights the surface up in its own colour (windows, neon); a number sets the strength. */
  glow?: boolean | number;
  opacity?: number;
}

/** The flat-shaded material of every part, adjusted for the stage. */
export function Mat({ color, glow = false, opacity = 1 }: MatProps) {
  const look = stageLook(useKit().stage, opacity);
  // Every part glows a little in its own colour, so shadowed sides keep their toy colours;
  // lamps and neon glow fully.
  const strength = glow === true ? 1 : glow === false ? SELF_LIGHT : Math.max(glow, SELF_LIGHT);
  const soft = look.wire ?? soot(pastel(color), look.soot);
  return (
    <meshStandardMaterial
      key={lookKey(look)}
      color={soft}
      flatShading
      roughness={0.85}
      metalness={0}
      emissive={soft}
      emissiveIntensity={look.wire ? look.glow : strength + look.glow}
      wireframe={look.wire !== null}
      transparent={look.transparent}
      opacity={look.opacity}
      depthWrite={look.depthWrite}
    />
  );
}

interface Placed {
  position?: Vec3;
  rotation?: Vec3;
  scale?: Vec3 | number;
}

type PartProps = Placed & MatProps & { shadow?: boolean };

function Part(props: PartProps & { children: ReactNode }) {
  const { position, rotation, scale, color, glow, opacity, shadow = true } = props;
  return (
    <mesh
      position={position}
      rotation={rotation}
      scale={scale}
      castShadow={shadow}
      receiveShadow={shadow}
    >
      {props.children}
      <Mat color={color} glow={glow} opacity={opacity} />
    </mesh>
  );
}

/** A box, rounded as much as the theme's radius asks unless `sharp`. */
export function Box(props: PartProps & { size: Vec3; sharp?: boolean }) {
  const { roundness } = useKit().theme;
  const [w, h, d] = props.size;
  const radius = props.sharp ? 0 : Math.min(roundness * Math.min(w, h, d) * 0.3, 0.22);
  return (
    <Part {...props}>
      {radius < 0.005 ? (
        <boxGeometry args={[w, h, d]} />
      ) : (
        <roundedBoxGeometry key={radius} args={[w, h, d, 2, radius]} />
      )}
    </Part>
  );
}

/** A cylinder; `top` defaults to `r`. Few segments keep it low-poly. */
export function Cyl(
  props: PartProps & {
    r: number;
    top?: number;
    h: number;
    seg?: number;
    from?: number;
    arc?: number;
  },
) {
  const { r, h } = props;
  return (
    <Part {...props}>
      <cylinderGeometry
        args={[
          props.top ?? r,
          r,
          h,
          props.seg ?? 10,
          1,
          false,
          props.from ?? 0,
          props.arc ?? Math.PI * 2,
        ]}
      />
    </Part>
  );
}

export function Cone(props: PartProps & { r: number; h: number; seg?: number }) {
  return (
    <Part {...props}>
      <coneGeometry args={[props.r, props.h, props.seg ?? 8]} />
    </Part>
  );
}

/** A faceted ball. */
export function Ball(props: PartProps & { r: number; detail?: number }) {
  return (
    <Part {...props}>
      <icosahedronGeometry args={[props.r, props.detail ?? 1]} />
    </Part>
  );
}

/** The top half of a sphere, sitting on its flat side. */
export function Dome(props: PartProps & { r: number; seg?: number }) {
  const seg = props.seg ?? 12;
  return (
    <Part {...props}>
      <sphereGeometry args={[props.r, seg, Math.ceil(seg / 3), 0, Math.PI * 2, 0, Math.PI / 2]} />
    </Part>
  );
}

/** A ring lying flat (rotate it to stand it up). */
export function Ring(props: PartProps & { r: number; tube: number; seg?: number; arc?: number }) {
  return (
    <Part {...props} rotation={props.rotation ?? [Math.PI / 2, 0, 0]}>
      <torusGeometry args={[props.r, props.tube, 6, props.seg ?? 16, props.arc ?? Math.PI * 2]} />
    </Part>
  );
}

/** A flat shape (`points` in x, y) given `depth` along z, centred on z. Pass a constant or
 * memoised `points` array: a new array rebuilds the geometry. */
export function Extruded(
  props: PartProps & { points: ReadonlyArray<readonly [x: number, y: number]>; depth: number },
) {
  const { points, depth } = props;
  const args = useMemo(() => {
    const shape = new Shape();
    points.forEach(([x, y], i) => (i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y)));
    shape.closePath();
    return [shape, { depth, bevelEnabled: false }] as const;
  }, [points, depth]);
  return (
    <group position={props.position} rotation={props.rotation} scale={props.scale}>
      <Part {...props} position={[0, 0, -depth / 2]} rotation={undefined} scale={undefined}>
        <extrudeGeometry args={args} />
      </Part>
    </group>
  );
}

/** A pitched roof: a triangle `w` wide and `h` high, running `d` deep along z. Its
 * base sits at the given position. */
export function Gable(props: PartProps & { w: number; h: number; d: number }) {
  const { w, h, d } = props;
  const points = useMemo(
    () =>
      [
        [-w / 2, 0],
        [w / 2, 0],
        [0, h],
      ] as const,
    [w, h],
  );
  return <Extruded {...props} points={points} depth={d} />;
}

/** Window glass by day. */
const GLASS = "#bfe0ee";

/** A window: a thin pane of glass by day that lights up warm at night (or in its own
 * `color`, softened by day). Faces +z unless rotated. */
export function Win(props: Placed & { w?: number; h?: number; color?: string }) {
  const look = stageLook(useKit().stage);
  const mesh = useRef<Mesh>(null);
  const material = useRef<MeshStandardMaterial>(null);
  const tint = props.color;
  const colors = useMemo(
    () => ({
      day: new Color(soot(tint ? pastel(tint) : GLASS, look.soot)),
      night: new Color(soot(tint ?? LAMP, look.soot)),
      wire: new Color(look.wire ?? GLASS),
    }),
    [tint, look.soot, look.wire],
  );
  const night = useRef(0);
  /** The finale's lights-up level (1 outside it). */
  const lit = useRef(1);
  const paint = () => {
    const m = material.current;
    if (!m) return;
    if (look.wire) {
      m.color.copy(colors.wire);
      m.emissive.copy(colors.wire);
      m.emissiveIntensity = look.glow;
      return;
    }
    const glow = night.current * lit.current;
    m.color.lerpColors(colors.day, colors.night, Math.min(glow, 1));
    m.emissive.copy(m.color);
    m.emissiveIntensity = (tint ? 0.45 : 0.12) + glow * 0.85 + look.glow;
  };
  useNight(
    (value) => {
      night.current = value;
      paint();
    },
    [colors, look.glow, look.wire],
  );
  useLightsUp(mesh, (level) => {
    lit.current = level;
    paint();
  });
  return (
    <mesh ref={mesh} position={props.position} rotation={props.rotation}>
      <boxGeometry args={[props.w ?? 0.32, props.h ?? 0.38, 0.05]} />
      <meshStandardMaterial
        key={lookKey(look)}
        ref={(m) => {
          material.current = m;
          // A new material (the stage changed): paint it at once.
          if (m) paint();
        }}
        flatShading
        roughness={0.3}
        metalness={0.05}
        wireframe={look.wire !== null}
        transparent={look.transparent}
        opacity={look.opacity}
        depthWrite={look.depthWrite}
      />
    </mesh>
  );
}

/** A door in the accent colour, standing on the ground. Faces +z unless rotated. */
export function Door(props: Placed & { w?: number; h?: number; color?: string }) {
  const { accent } = useKit().theme;
  const h = props.h ?? 0.62;
  const [x, y, z] = props.position ?? [0, 0, 0];
  return (
    <Box
      position={[x, y + h / 2, z]}
      rotation={props.rotation}
      size={[props.w ?? 0.4, h, 0.06]}
      color={props.color ?? accent}
      sharp
    />
  );
}

/** A low slab under a building, in the theme's wall colour. */
export function Plinth(props: { w: number; d: number; color?: string }) {
  const { base } = useKit().theme;
  return (
    <Box position={[0, 0.06, 0]} size={[props.w, 0.12, props.d]} color={props.color ?? base} />
  );
}

/** Draws `text` centred on a transparent canvas, shrinking it to fit. No font files:
 * the browser's own rounded or system font. */
function drawLabel(text: string, aspect: number, ink: string): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = Math.max(32, Math.round(512 / aspect));
  const context = canvas.getContext("2d");
  if (!context) return canvas;
  let size = canvas.height * 0.62;
  const font = (px: number) => `700 ${px}px ui-rounded, "SF Pro Rounded", system-ui, sans-serif`;
  context.font = font(size);
  while (size > 10 && context.measureText(text).width > canvas.width * 0.9) {
    size -= 2;
    context.font = font(size);
  }
  context.fillStyle = ink;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, canvas.width / 2, canvas.height / 2 + size * 0.04);
  return canvas;
}

/** Text painted on a plane facing +z (a canvas texture, not 3D text). Unlit, so the
 * letters keep their colour at night. */
export function PaintedText(props: Placed & { text: string; w: number; h: number; ink: string }) {
  const { w, h, text, ink } = props;
  const look = stageLook(useKit().stage);
  const canvas = useMemo(() => drawLabel(text, w / h, ink), [text, w, h, ink]);
  return (
    <mesh position={props.position} rotation={props.rotation} scale={props.scale}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial
        transparent
        opacity={look.opacity}
        depthWrite={false}
        color={look.wire ?? soot("#ffffff", look.soot)}
      >
        <canvasTexture attach="map" args={[canvas]} colorSpace={SRGBColorSpace} />
      </meshBasicMaterial>
    </mesh>
  );
}

/** A board with a painted label on both faces. */
export function LabelBoard(
  props: Placed & { text: string; w: number; h: number; color: string; ink: string },
) {
  const { w, h, text, ink } = props;
  return (
    <group position={props.position} rotation={props.rotation} scale={props.scale}>
      <Box size={[w, h, 0.1]} color={props.color} />
      <PaintedText position={[0, 0, 0.051]} text={text} w={w * 0.94} h={h * 0.86} ink={ink} />
      <PaintedText
        position={[0, 0, -0.051]}
        rotation={[0, Math.PI, 0]}
        text={text}
        w={w * 0.94}
        h={h * 0.86}
        ink={ink}
      />
    </group>
  );
}

/** Turns its children round an axis, forever. */
export function Spin(
  props: Placed & { speed?: number; axis?: "x" | "y" | "z"; children: ReactNode },
) {
  const ref = useRef<Group>(null);
  const axis = props.axis ?? "y";
  const speed = props.speed ?? 1;
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation[axis] += delta * speed;
  });
  return (
    <group position={props.position} rotation={props.rotation}>
      <group ref={ref}>{props.children}</group>
    </group>
  );
}

/** Rocks its children back and forth: a bob along an axis, or a sway round one. */
export function Wobble(
  props: Placed & {
    kind: "bob" | "sway";
    axis?: "x" | "y" | "z";
    amount?: number;
    speed?: number;
    phase?: number;
    children: ReactNode;
  },
) {
  const ref = useRef<Group>(null);
  const { kind, amount = 0.1, speed = 1.5, phase = 0 } = props;
  const axis = props.axis ?? (kind === "bob" ? "y" : "z");
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const offset = Math.sin(clock.elapsedTime * speed + phase) * amount;
    if (kind === "bob") ref.current.position[axis] = offset;
    else ref.current.rotation[axis] = offset;
  });
  return (
    <group position={props.position} rotation={props.rotation}>
      <group ref={ref}>{props.children}</group>
    </group>
  );
}

/** Puffs of smoke rising from a chimney and fading; `color` and `size` for a bigger, darker
 * plume. */
export function Smoke(props: Placed & { color?: string; size?: number }) {
  const puffs = useRef<Array<Group | null>>([]);
  const materials = useRef<Array<MeshStandardMaterial | null>>([]);
  const look = stageLook(useKit().stage);
  useFrame(({ clock }) => {
    for (let i = 0; i < 3; i++) {
      const t = (clock.elapsedTime * 0.35 + i / 3) % 1;
      const puff = puffs.current[i];
      const material = materials.current[i];
      if (!puff || !material) continue;
      puff.position.set(Math.sin(t * 4 + i) * 0.08, t * 1.1, 0);
      puff.scale.setScalar((0.4 + t * 0.9) * (props.size ?? 1));
      material.opacity = 0.55 * look.opacity * (1 - t);
    }
  });
  return (
    <group position={props.position}>
      {[0, 1, 2].map((i) => (
        <group key={i} ref={(g) => void (puffs.current[i] = g)}>
          <mesh>
            <icosahedronGeometry args={[0.14, 0]} />
            <meshStandardMaterial
              ref={(m) => void (materials.current[i] = m)}
              color={props.color ?? "#d7dae6"}
              flatShading
              transparent
              depthWrite={false}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** A small light that blinks on and off. */
export function Blinker(
  props: Placed & { color: string; size?: number; period?: number; phase?: number },
) {
  const material = useRef<MeshStandardMaterial>(null);
  const look = stageLook(useKit().stage);
  const { period = 1.6, phase = 0 } = props;
  useFrame(({ clock }) => {
    if (material.current)
      material.current.emissiveIntensity =
        (((clock.elapsedTime + phase) % period) / period < 0.5 ? 1.6 : 0.15) + look.glow;
  });
  const size = props.size ?? 0.06;
  return (
    <mesh position={props.position} rotation={props.rotation}>
      <boxGeometry args={[size, size, size * 0.5]} />
      <meshStandardMaterial
        key={lookKey(look)}
        ref={material}
        color={look.wire ?? props.color}
        emissive={look.wire ?? props.color}
        wireframe={look.wire !== null}
        flatShading
        transparent={look.transparent}
        opacity={look.opacity}
        depthWrite={look.depthWrite}
      />
    </mesh>
  );
}
