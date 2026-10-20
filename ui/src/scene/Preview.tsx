// What an answer would build: while the pointer is on an option of the billboard (or a
// multi-select option is ticked), its building floats translucent over its lot, logo sign
// and all, so the user sees what they're about to drop into the town.
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, useSyncExternalStore, type ReactNode } from "react";
import type { Group } from "three";

import { slotById, type SlotId } from "../../../src/town/catalog.ts";
import type { TownState } from "../../../src/town/protocol.ts";
import { buildingFor, propFor } from "../buildings/registry.ts";
import { propSpot, spotFor, themeFor } from "../logic.ts";
import { OnSpot, propLogoSize, Signed } from "./Placements.tsx";

export interface PreviewTarget {
  slot: SlotId;
  /** The hovered option and the ticked ones, in the question's order (the order the
   * answer sends them in, which decides where props stand). */
  options: { id: string; label: string }[];
}

let current: PreviewTarget | null = null;
const listeners = new Set<() => void>();

/** Set by the billboard; null clears the preview. */
export function setPreview(target: PreviewTarget | null): void {
  if (target?.options.length === 0) target = null;
  if (current === null && target === null) return;
  current = target;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** How high a preview floats: just over an empty lot, above the building on a taken one. */
const FLOAT_EMPTY = 1.1;
const FLOAT_TAKEN = 3.6;

/** Bobs gently and turns a little, so it reads as "not placed yet". */
function Float(props: { y: number; children: ReactNode }) {
  const group = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (!group.current) return;
    const t = clock.elapsedTime;
    group.current.position.y = props.y + Math.sin(t * 2.2) * 0.15;
    group.current.rotation.y = Math.sin(t * 0.9) * 0.18;
  });
  return (
    <group ref={group} position-y={props.y}>
      {props.children}
    </group>
  );
}

export function Preview({ state }: { state: TownState }) {
  const target = useSyncExternalStore(subscribe, () => current);
  const { base, accent, roundness } = themeFor(state.placements.ui);
  const theme = useMemo(() => ({ base, accent, roundness }), [base, accent, roundness]);
  if (!target) return null;
  const slot = slotById(target.slot);
  const taken = (state.placements[target.slot]?.optionIds.length ?? 0) > 0;
  if (slot.kind === "building") {
    const option = target.options.at(-1)!;
    const Model = buildingFor(slot.id, option.id);
    return (
      // Keyed by option: a new option is a new model, measured afresh for its logo sign.
      // An unplaced building floats over the block it would take.
      <OnSpot
        key={option.id}
        slot={slot.id}
        at={spotFor(slot.id, state.placements)}
        placements={state.placements}
      >
        <Float y={taken ? FLOAT_TAKEN : FLOAT_EMPTY}>
          <Signed stage="preview" theme={theme} auto={false} logo={`${slot.id}:${option.id}`}>
            <Model label={option.label} stage="preview" theme={theme} />
          </Signed>
        </Float>
      </OnSpot>
    );
  }
  if (slot.kind === "props") {
    return (
      <>
        {target.options.map((option, index) => {
          const Model = propFor(slot.id, option.id);
          return (
            <OnSpot
              key={option.id}
              slot={slot.id}
              at={propSpot(slot.id, option.id, index, state.placements)}
              placements={state.placements}
            >
              <Float y={FLOAT_EMPTY}>
                <Signed
                  stage="preview"
                  theme={theme}
                  auto={false}
                  logo={`${slot.id}:${option.id}`}
                  logoSize={propLogoSize(slot.id)}
                >
                  <Model label={option.label} stage="preview" theme={theme} />
                </Signed>
              </Float>
            </OnSpot>
          );
        })}
      </>
    );
  }
  // The name sign and the paint have no options to preview.
  return null;
}
