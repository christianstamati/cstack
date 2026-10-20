// A tool's logo on its building: the simple-icons mark extruded into a shallow 3D shape on
// a plate, or a monogram painted on a coloured plate when there is no icon.
import { extend, type ThreeElement } from "@react-three/fiber";
import { DoubleSide, ExtrudeGeometry } from "three";
import { SVGLoader } from "three/addons/loaders/SVGLoader.js";

import type { SlotId } from "../../../src/town/catalog.ts";
import { Box, PaintedText, useKit, type Vec3 } from "./kit.tsx";
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
}

export function Badge({ of, position, rotation, size = 0.6 }: BadgeProps) {
  const { stage } = useKit();
  const [slot, optionId] = of.split(":") as [SlotId, string];
  const logo = logoFor(slot, optionId);
  if (!logo) return null;
  const plate = size * 1.3;
  if (logo.kind === "monogram") {
    return (
      <group position={position} rotation={rotation}>
        <Box size={[plate * 1.2, plate, 0.06]} color={logo.color} />
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
      <Box size={[plate, plate, 0.06]} color={plateFor(logo.hex)} />
      <mesh position={[0, 0, 0.03]}>
        <iconGeometry args={[logo.path, size, 0.04]} />
        <meshStandardMaterial
          color={logo.hex}
          emissive={logo.hex}
          emissiveIntensity={0.35}
          flatShading
          roughness={0.7}
          side={DoubleSide}
          transparent={stage === "preview"}
          opacity={stage === "preview" ? 0.45 : 1}
        />
      </mesh>
    </group>
  );
}
