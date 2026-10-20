// Hover labels: an HTML pill that follows the building under the pointer. Buildings set
// what is hovered; `HoverTracker` (inside the canvas) projects its anchor to the screen
// every frame and moves the pill there without re-rendering React.
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { Vector3 } from "three";

export interface HoverInfo {
  id: string;
  title: string;
  detail: string | null;
  /** World position the label points at, usually just above the roof. */
  anchor: [x: number, y: number, z: number];
}

let current: HoverInfo | null = null;
const listeners = new Set<() => void>();
let labelElement: HTMLDivElement | null = null;

function emit(): void {
  for (const listener of listeners) listener();
}

export function setHover(info: HoverInfo): void {
  current = info;
  emit();
}

/** Clears the label if `id` is what is hovered (pointer left it, or it unmounted). */
export function clearHover(id: string): void {
  if (current?.id !== id) return;
  current = null;
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Inside the canvas: keeps the label over its anchor as the camera moves. */
export function HoverTracker() {
  const point = useMemo(() => new Vector3(), []);
  useFrame(({ camera, size }) => {
    const element = labelElement;
    if (!element) return;
    if (!current) {
      element.style.visibility = "hidden";
      return;
    }
    point.set(...current.anchor).project(camera);
    const x = ((point.x + 1) / 2) * size.width;
    const y = ((1 - point.y) / 2) * size.height;
    element.style.transform = `translate(${x}px, ${y}px)`;
    element.style.visibility = point.z < 1 ? "visible" : "hidden";
  });
  return null;
}

/** Outside the canvas: the pill itself. */
export function HoverLabel() {
  const info = useSyncExternalStore(subscribe, () => current);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    labelElement = ref.current;
    return () => {
      labelElement = null;
    };
  }, []);
  return (
    <div ref={ref} className="hover-label" aria-hidden="true">
      {info ? (
        <span className="hover-pill">
          <span className="hover-title">{info.title}</span>
          {info.detail ? <span className="hover-detail">{info.detail}</span> : null}
        </span>
      ) : null}
    </div>
  );
}
