// A tool's logo on its building: the simple-icons mark extruded into a shallow 3D shape on
// a plate, or a monogram painted on a coloured plate when there is no icon.
import { extend, useFrame, type ThreeElement } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { DoubleSide, ExtrudeGeometry, Vector3, type Group } from "three";
import { SVGLoader } from "three/addons/loaders/SVGLoader.js";

import type { SlotId } from "../../../src/town/catalog.ts";
import { Box, Cyl, lookKey, PaintedText, soot, stageLook, useKit, type Vec3 } from "./kit.tsx";
import { logoFor, plateFor } from "./logos.ts";

/** A 24×24 simple-icons path, extruded `depth` deep and scaled to `size` wide, centred on
 * the origin and facing +z. A geometry class, so R3F builds it from JSX and disposes it. */
class IconGeometry extends ExtrudeGeometry {
  constructor(path: string, size: number, depth: number) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="${path}"/></svg>`;
    const shapes = new SVGLoader().parse(svg).paths.flatMap((p) => p.toShapes());
    const scale = size / 24;
    super(shapes, { depth: depth / scale, bevelEnabled: false, curveSegments: 5 });
    // SVG's y runs down: flip it (the material is double-sided for the flipped winding).
    this.translate(-12, -12, 0);
    this.scale(scale, -scale, scale);
  }
}

declare module "@react-three/fiber" {
  interface ThreeElements {
    iconGeometry: ThreeElement<typeof IconGeometry>;
  }
}
extend({ IconGeometry });

interface BadgeProps {
  /** `${slot}:${optionId}`, as in the building registry. */
  of: `${SlotId}:${string}`;
  position?: Vec3;
  rotation?: Vec3;
  /** Width of the logo; the plate is a little larger. */
  size?: number;
  /** Light the plate up like a sign at night. */
  lit?: boolean;
}

export function Badge({ of, position, rotation, size = 0.6, lit = false }: BadgeProps) {
  const look = stageLook(useKit().stage);
  const [slot, optionId] = of.split(":") as [SlotId, string];
  const logo = logoFor(slot, optionId);
  if (!logo) return null;
  const plate = size * 1.3;
  if (logo.kind === "monogram") {
    return (
      <group position={position} rotation={rotation}>
        <Box size={[plate * 1.2, plate, 0.06]} color={logo.color} glow={lit ? 0.45 : false} />
        <PaintedText
          position={[0, 0, 0.032]}
          text={logo.text}
          w={plate * 1.1}
          h={plate * 0.8}
          ink="#fff8e8"
        />
      </group>
    );
  }
  return (
    <group position={position} rotation={rotation}>
      <Box size={[plate, plate, 0.06]} color={plateFor(logo.hex)} glow={lit ? 0.45 : false} />
      <mesh position={[0, 0, 0.03]}>
        <iconGeometry args={[logo.path, size, 0.04]} />
        <meshStandardMaterial
          key={lookKey(look)}
          color={look.wire ?? soot(logo.hex, look.soot)}
          emissive={look.wire ?? soot(logo.hex, look.soot)}
          emissiveIntensity={(lit ? 0.6 : 0.35) + look.glow}
          wireframe={look.wire !== null}
          flatShading
          roughness={0.7}
          side={DoubleSide}
          transparent={look.transparent}
          opacity={look.opacity}
          depthWrite={look.depthWrite}
        />
      </mesh>
    </group>
  );
}

/** Height of a `LogoSign` above where it stands, for a logo of width `size`. */
export function logoSignHeight(size: number): number {
  return SIGN_POLE + size * 1.3;
}

const SIGN_POLE = 0.45;
const AUTO_TAG = "#7fe9ff";

/** A lit logo sign on a short pole that turns round the vertical axis to face the camera,
 * so every building's logo reads from wherever the camera is. `auto` adds a small cyan
 * pennant to the pole: the agent settled this answer by itself. */
export function LogoSign(props: {
  of: BadgeProps["of"];
  position: Vec3;
  size: number;
  auto: boolean;
}) {
  const turn = useRef<Group>(null);
  const world = useMemo(() => new Vector3(), []);
  const forward = useMemo(() => new Vector3(), []);
  useFrame(({ camera }) => {
    const group = turn.current;
    const parent = group?.parent;
    if (!group || !parent) return;
    parent.getWorldPosition(world);
    forward.set(0, 0, 1).transformDirection(parent.matrixWorld);
    const toCamera = Math.atan2(camera.position.x - world.x, camera.position.z - world.z);
    group.rotation.y = toCamera - Math.atan2(forward.x, forward.z);
  });
  const [slot, optionId] = props.of.split(":") as [SlotId, string];
  if (!logoFor(slot, optionId)) return null;
  const plate = props.size * 1.3;
  return (
    <group position={props.position}>
      <group ref={turn}>
        <Cyl position={[0, SIGN_POLE / 2, 0]} r={0.035} h={SIGN_POLE} seg={5} color="#3a3f4d" />
        {props.auto ? (
          <Box
            position={[0.13, SIGN_POLE * 0.55, 0]}
            size={[0.22, 0.14, 0.02]}
            color={AUTO_TAG}
            glow={0.9}
            sharp
          />
        ) : null}
        <Badge of={props.of} position={[0, SIGN_POLE + plate / 2, 0]} size={props.size} lit />
      </group>
    </group>
  );
}
