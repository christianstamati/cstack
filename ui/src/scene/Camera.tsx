// An isometric-style view of the whole city: an orthographic camera looking down at the
// town from the entrance corner, zoomed so every block fits beside the billboard. The user
// can drag to turn and tilt within limits (never under the slab) and zoom in and out.
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { Vector3, type OrthographicCamera } from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import { lotPosition } from "../logic.ts";
import { GRID, PITCH, SLAB } from "../streets.ts";

/** What the camera looks at: the middle of the slab, a little above the ground. */
const TARGET = new Vector3((SLAB.minX + SLAB.maxX) / 2, 0.8, (SLAB.minZ + SLAB.maxZ) / 2);
/** From the entrance corner (+x, +z), about 35° above the horizon. */
const AZIMUTH = Math.PI / 4;
const POLAR = 0.96;
const DISTANCE = 80;

export const CAMERA_START: [x: number, y: number, z: number] = [
  TARGET.x + DISTANCE * Math.sin(POLAR) * Math.sin(AZIMUTH),
  TARGET.y + DISTANCE * Math.cos(POLAR),
  TARGET.z + DISTANCE * Math.sin(POLAR) * Math.cos(AZIMUTH),
];

/** Room the billboard takes on the right (see .billboard in styles.css), and the HUD's
 * strips at the top and bottom of the page. */
function reserved(width: number): { right: number; top: number; bottom: number } {
  const right = width >= 900 ? Math.min(390, width - 60) + 30 + 16 : 0;
  return { right, top: 64, bottom: 44 };
}

/** The corners of what must show: every block up to rooftop height, the entrance, and
 * the floating slab (its very corners may tuck under the page's edges). */
const FRAME: Vector3[] = (() => {
  const low = GRID.min * PITCH - GRID.block / 2;
  const high = GRID.max * PITCH + GRID.block / 2;
  const [nx, , nz] = lotPosition("name");
  const points: Vector3[] = [new Vector3(nx, 2.6, nz), new Vector3(nx, 0, nz)];
  for (const x of [low, high])
    for (const z of [low, high]) for (const y of [0, 5.5]) points.push(new Vector3(x, y, z));
  const inset = 1.2;
  for (const x of [SLAB.minX + inset, SLAB.maxX - inset])
    for (const z of [SLAB.minZ + inset, SLAB.maxZ - inset]) points.push(new Vector3(x, -1, z));
  return points;
})();

/** The zoom (pixels per world unit) that fits FRAME into the free part of the page, seen
 * from the starting view. */
function fitZoom(width: number, height: number): number {
  const forward = new Vector3(...CAMERA_START).sub(TARGET).negate().normalize();
  const right = new Vector3().crossVectors(forward, new Vector3(0, 1, 0)).normalize();
  const up = new Vector3().crossVectors(right, forward);
  let halfX = 0;
  let halfY = 0;
  const offset = new Vector3();
  for (const point of FRAME) {
    offset.subVectors(point, TARGET);
    halfX = Math.max(halfX, Math.abs(offset.dot(right)));
    halfY = Math.max(halfY, Math.abs(offset.dot(up)));
  }
  const room = reserved(width);
  const free = Math.max(width - room.right, 320);
  const tall = Math.max(height - room.top - room.bottom, 240);
  return Math.min(free / (2 * halfX + 1.5), tall / (2 * halfY + 1.5));
}

export function Camera() {
  const camera = useThree((state) => state.camera) as OrthographicCamera;
  const element = useThree((state) => state.gl.domElement);
  const size = useThree((state) => state.size);
  const controls = useRef<OrbitControls | null>(null);
  /** The fitted zoom, to keep the user's own zoom factor across resizes. */
  const fitted = useRef<number | null>(null);
  // Created and disposed in the same effect, so StrictMode's mount, unmount, mount in
  // development ends with live controls (a disposed instance has no listeners left).
  useEffect(() => {
    const c = new OrbitControls(camera, element);
    c.enablePan = false;
    c.enableDamping = true;
    c.dampingFactor = 0.08;
    c.minPolarAngle = 0.55;
    c.maxPolarAngle = 1.2;
    c.minAzimuthAngle = AZIMUTH - 0.9;
    c.maxAzimuthAngle = AZIMUTH + 0.9;
    c.target.copy(TARGET);
    controls.current = c;
    return () => {
      c.dispose();
      controls.current = null;
    };
  }, [camera, element]);
  // Fit the city on screen; the free part of the page is left of the billboard, so the
  // view shifts left by half the billboard's room.
  useEffect(() => {
    const fit = fitZoom(size.width, size.height);
    const factor = fitted.current === null ? 1 : camera.zoom / fitted.current;
    fitted.current = fit;
    camera.zoom = fit * factor;
    const room = reserved(size.width);
    camera.setViewOffset(
      size.width,
      size.height,
      room.right / 2,
      (room.bottom - room.top) / 2,
      size.width,
      size.height,
    );
    camera.updateProjectionMatrix();
    const c = controls.current;
    if (c) {
      c.minZoom = fit * 0.8;
      c.maxZoom = fit * 3.5;
    }
  }, [camera, size.width, size.height]);
  useFrame((_, delta) => controls.current?.update(delta));
  return null;
}
