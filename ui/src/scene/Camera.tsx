// An isometric-style view of the town: an orthographic camera looking down from the
// entrance corner. It frames what's built so far (see framing.ts), close on the entrance on
// bare land and easing out as the city grows, in the room left of the billboard. The user
// can drag to turn and tilt within limits (never under the slab) and zoom; once they do, the
// camera stops framing by itself until the next answer comes in.
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { Vector3, type OrthographicCamera } from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import type { TownState } from "../../../src/town/protocol.ts";
import { framePoints, frameFor, SLAB_FRAME, VIEW, zoomFor } from "../framing.ts";
import { nextLot } from "../logic.ts";

const DISTANCE = 80;
/** Seconds to ease most of the way to a new frame. */
const EASE = 0.9;

/** Where the camera starts, before the first frame is known: over the entrance. */
const START = frameFor(framePoints({}, null));
export const CAMERA_START: [x: number, y: number, z: number] = [
  START.target[0] + VIEW.back[0] * DISTANCE,
  START.target[1] + VIEW.back[1] * DISTANCE,
  START.target[2] + VIEW.back[2] * DISTANCE,
];

export function Camera({ state }: { state: TownState | null }) {
  const camera = useThree((three) => three.camera) as OrthographicCamera;
  const element = useThree((three) => three.gl.domElement);
  const size = useThree((three) => three.size);
  const controls = useRef<OrbitControls | null>(null);
  /** Framing by itself; off once the user turns or zooms, on again with the next answer. */
  const auto = useRef(true);
  const first = useRef(true);
  const step = useMemo(() => new Vector3(), []);

  const placements = state?.placements;
  const next = state ? nextLot(state) : null;
  const frame = useMemo(
    () => frameFor(framePoints(placements ?? {}, next)),
    // The frame only depends on what is built and where the crane works next.
    [JSON.stringify(placements), next?.join(",")],
  );
  const zoom = zoomFor(frame, size);
  // A new answer: frame the town again, even after the user looked around.
  useEffect(() => {
    auto.current = true;
  }, [frame]);
  // The town as it stands when the page opens is framed at once, not glided to.
  const known = placements !== undefined;
  useEffect(() => {
    if (known) first.current = true;
  }, [known]);

  // Created and disposed in the same effect, so StrictMode's mount, unmount, mount in
  // development ends with live controls (a disposed instance has no listeners left).
  useEffect(() => {
    const c = new OrbitControls(camera, element);
    c.enablePan = false;
    c.enableDamping = true;
    c.dampingFactor = 0.08;
    c.minPolarAngle = 0.55;
    c.maxPolarAngle = 1.2;
    c.minAzimuthAngle = VIEW.azimuth - 0.9;
    c.maxAzimuthAngle = VIEW.azimuth + 0.9;
    c.target.set(...START.target);
    const stop = () => {
      auto.current = false;
    };
    c.addEventListener("start", stop);
    controls.current = c;
    return () => {
      c.removeEventListener("start", stop);
      c.dispose();
      controls.current = null;
    };
  }, [camera, element]);

  // The free part of the page is left of the billboard and between the HUD's strips: the
  // view shifts so its middle is there.
  useEffect(() => {
    const right = VIEW.billboard(size.width);
    camera.setViewOffset(
      size.width,
      size.height,
      right / 2,
      (VIEW.bottom - VIEW.top) / 2,
      size.width,
      size.height,
    );
    camera.updateProjectionMatrix();
    const c = controls.current;
    if (c) {
      c.minZoom = zoomFor(SLAB_FRAME, size) * 0.8;
      c.maxZoom = zoomFor(START, size) * 2.5;
    }
  }, [camera, size]);

  useFrame((_, delta) => {
    const c = controls.current;
    if (!c) return;
    if (auto.current) {
      // Glide there: move the target and the camera together, so the angle stays the user's.
      const t = first.current ? 1 : 1 - Math.exp(-delta / EASE);
      first.current = false;
      step
        .set(...frame.target)
        .sub(c.target)
        .multiplyScalar(t);
      c.target.add(step);
      camera.position.add(step);
      const goal = Math.min(Math.max(zoom, c.minZoom), c.maxZoom);
      if (Math.abs(camera.zoom - goal) > 1e-3) {
        camera.zoom += (goal - camera.zoom) * t;
        camera.updateProjectionMatrix();
      }
    }
    c.update(delta);
  });
  return null;
}
