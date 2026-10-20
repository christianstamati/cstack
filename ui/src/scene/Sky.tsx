// Day and night: the lights follow the browser's clock (or `?time=HH:MM`) through `skyAt`,
// re-read every minute and eased towards so nothing pops. The sky behind the town is an
// HTML backdrop (a gradient, stars and the moon) whose colours the frame loop sets.
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  Object3D,
  SRGBColorSpace,
  type AmbientLight,
  type DirectionalLight,
  type HemisphereLight,
} from "three";

import { clockAt, parseTimeOverride, skyAt, type RGB, type Sky as SkyLook } from "../sky.ts";
import { SLAB } from "../streets.ts";
import { setNight } from "./daylight.ts";

const CENTRE = [(SLAB.minX + SLAB.maxX) / 2, 0, (SLAB.minZ + SLAB.maxZ) / 2] as const;
/** How far from the town the key light stands (for its shadows). */
const LIGHT_DISTANCE = 45;
const SHADOW_REACH = 25;
/** Seconds to ease most of the way to a new look. */
const EASE = 1.2;

// The backdrop element, styled by the frame loop without re-rendering React.
let backdrop: HTMLDivElement | null = null;

/** Behind the canvas: the sky's gradient, its stars and the moon. */
export function SkyBackdrop() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    backdrop = ref.current;
    return () => {
      backdrop = null;
    };
  }, []);
  return (
    <div ref={ref} className="sky" aria-hidden="true">
      <div className="sky-stars" />
      <div className="sky-moon" />
    </div>
  );
}

const mix = (a: number, b: number, t: number) => a + (b - a) * t;

function easeRGB(current: RGB, target: RGB, t: number): void {
  for (let i = 0; i < 3; i++) current[i] = mix(current[i]!, target[i]!, t);
}

/** Moves every number of `current` a fraction `t` of the way to `target`, in place. */
function ease(current: SkyLook, target: SkyLook, t: number): void {
  easeRGB(current.light.color, target.light.color, t);
  current.light.intensity = mix(current.light.intensity, target.light.intensity, t);
  const direction = current.light.direction;
  for (let i = 0; i < 3; i++) direction[i] = mix(direction[i]!, target.light.direction[i]!, t);
  const length = Math.hypot(...direction);
  // Across the horizon the light swaps from sun to moon while it is all but out.
  if (length > 1e-3) for (let i = 0; i < 3; i++) direction[i] = direction[i]! / length;
  else current.light.direction = [...target.light.direction];
  easeRGB(current.ambient.color, target.ambient.color, t);
  current.ambient.intensity = mix(current.ambient.intensity, target.ambient.intensity, t);
  easeRGB(current.hemisphere.sky, target.hemisphere.sky, t);
  easeRGB(current.hemisphere.ground, target.hemisphere.ground, t);
  current.hemisphere.intensity = mix(current.hemisphere.intensity, target.hemisphere.intensity, t);
  easeRGB(current.top, target.top, t);
  easeRGB(current.bottom, target.bottom, t);
  current.daylight = mix(current.daylight, target.daylight, t);
  current.dusk = mix(current.dusk, target.dusk, t);
}

const css = ([r, g, b]: RGB) =>
  `rgb(${Math.round(r * 255)} ${Math.round(g * 255)} ${Math.round(b * 255)})`;

function smoothstep(from: number, to: number, x: number): number {
  const t = Math.min(Math.max((x - from) / (to - from), 0), 1);
  return t * t * (3 - 2 * t);
}

export function Sky() {
  const override = useMemo(() => parseTimeOverride(window.location.search), []);
  const target = useRef<SkyLook>(skyAt(clockAt(new Date(), override)));
  // Starts at the target: the first frame shows the right hour, no fade from noon.
  const current = useRef<SkyLook>(structuredClone(target.current));
  const sun = useRef<DirectionalLight>(null);
  const ambient = useRef<AmbientLight>(null);
  const hemisphere = useRef<HemisphereLight>(null);
  const aim = useMemo(() => {
    const object = new Object3D();
    object.position.set(...CENTRE);
    return object;
  }, []);
  const written = useRef({ top: "", bottom: "", stars: "", moon: "" });

  useEffect(() => {
    const id = window.setInterval(() => {
      target.current = skyAt(clockAt(new Date(), override));
    }, 60_000);
    return () => window.clearInterval(id);
  }, [override]);

  useFrame((_, delta) => {
    const look = current.current;
    ease(look, target.current, 1 - Math.exp(-delta / EASE));
    const light = sun.current;
    if (light) {
      light.color.setRGB(...look.light.color, SRGBColorSpace);
      light.intensity = look.light.intensity;
      const [dx, dy, dz] = look.light.direction;
      light.position.set(
        CENTRE[0] + dx * LIGHT_DISTANCE,
        CENTRE[1] + dy * LIGHT_DISTANCE,
        CENTRE[2] + dz * LIGHT_DISTANCE,
      );
    }
    if (ambient.current) {
      ambient.current.color.setRGB(...look.ambient.color, SRGBColorSpace);
      ambient.current.intensity = look.ambient.intensity;
    }
    if (hemisphere.current) {
      hemisphere.current.color.setRGB(...look.hemisphere.sky, SRGBColorSpace);
      hemisphere.current.groundColor.setRGB(...look.hemisphere.ground, SRGBColorSpace);
      hemisphere.current.intensity = look.hemisphere.intensity;
    }
    setNight(1 - look.daylight);

    const element = backdrop;
    if (!element) return;
    const values = {
      top: css(look.top),
      bottom: css(look.bottom),
      stars: (1 - smoothstep(0.05, 0.4, look.daylight)).toFixed(2),
      moon: (1 - smoothstep(0.1, 0.55, look.daylight)).toFixed(2),
    };
    const last = written.current;
    for (const key of ["top", "bottom", "stars", "moon"] as const) {
      if (values[key] === last[key]) continue;
      element.style.setProperty(`--sky-${key}`, values[key]);
      last[key] = values[key];
    }
  });

  return (
    <>
      <ambientLight ref={ambient} />
      <hemisphereLight ref={hemisphere} />
      <primitive object={aim} />
      <directionalLight
        ref={sun}
        target={aim}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-SHADOW_REACH}
        shadow-camera-right={SHADOW_REACH}
        shadow-camera-top={SHADOW_REACH}
        shadow-camera-bottom={-SHADOW_REACH}
        shadow-camera-near={1}
        shadow-camera-far={LIGHT_DISTANCE * 2}
        shadow-bias={-0.0006}
        shadow-normalBias={0.02}
        shadow-radius={3}
      />
    </>
  );
}
