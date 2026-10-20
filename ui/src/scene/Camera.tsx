import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

/** A slow drift around the island; the user can drag to look around within limits. */
export function Camera() {
  const camera = useThree((state) => state.camera);
  const element = useThree((state) => state.gl.domElement);
  const controls = useRef<OrbitControls | null>(null);
  // Created and disposed in the same effect, so StrictMode's mount, unmount, mount in
  // development ends with live controls (a disposed instance has no listeners left).
  useEffect(() => {
    const c = new OrbitControls(camera, element);
    c.enablePan = false;
    c.enableDamping = true;
    c.dampingFactor = 0.06;
    c.minDistance = 30;
    c.maxDistance = 64;
    c.minPolarAngle = 0.7;
    c.maxPolarAngle = 1.3;
    c.autoRotate = true;
    c.autoRotateSpeed = 0.25;
    // Aim a little above the island so the sky and the moon fit in the view.
    c.target.set(0, 3, 0);
    controls.current = c;
    return () => {
      c.dispose();
      controls.current = null;
    };
  }, [camera, element]);
  useFrame((_, delta) => controls.current?.update(delta));
  return null;
}
