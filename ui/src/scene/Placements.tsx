// Everything the answers put in the town: a building per block, the entrance sign, the
// props for extras and sign-in methods, the paint fountain, and "not needed" markers.
// Each drops in when its answer arrives and shows its label on hover. Buildings face
// their block's front street (+z); the ones on a block stand on its sidewalk.
import type { ThreeEvent } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Box3, Vector3, type Group, type Object3D } from "three";

import { SLOTS, slotById, type SlotDef, type SlotId } from "../../../src/town/catalog.ts";
import type { Placement, TownState } from "../../../src/town/protocol.ts";
import { LogoSign, logoSignHeight } from "../buildings/Badge.tsx";
import { Drop } from "../buildings/Drop.tsx";
import { NotNeeded } from "../buildings/Generic.tsx";
import { Ball, Box, Cyl, Frame } from "../buildings/kit.tsx";
import { logoFor } from "../buildings/logos.ts";
import { buildingFor, propFor } from "../buildings/registry.ts";
import {
  hoverText,
  lotPosition,
  modelKindFor,
  projectNameFrom,
  propSpot,
  themeFor,
  type Stage,
  type Theme,
} from "../logic.ts";
import { blockCentre, GRID } from "../streets.ts";
import { clearHover, setHover } from "./Hover.tsx";
import { NameSign } from "./NameSign.tsx";
import { PaintFountain } from "./Props.tsx";
import { BLOCK_TOP } from "./Streets.tsx";

/** Every placed model shows as `placed` for now; the build progress adds its stages. */
const STAGE: Stage = "placed";
const AUTO_FLAG = "#7fe9ff";
/** Models are drawn a little larger than their lot units, to read well from afar. */
const MODEL_SCALE = 1.15;

/** Width of a prop's logo sign: sign-in methods share a lot, so theirs are smaller. */
export function propLogoSize(slot: SlotId): number {
  return slot === "authMethods" ? 0.5 : 0.7;
}

/** How high a model of `slot` stands at (x, z): on the sidewalk of the slot's own block
 * (which rises when the slot is placed), else on the grass. */
function groundAt(slot: SlotId, [x, z]: readonly [x: number, z: number]): number {
  const cell = slotById(slot).block;
  if (!cell) return 0;
  const [cx, cz] = blockCentre(cell);
  return Math.max(Math.abs(x - cx), Math.abs(z - cz)) < GRID.block / 2 ? BLOCK_TOP : 0;
}

/** The entrance sign turns to face the starting view; everything else faces +z. */
function facing(slot: SlotId): number {
  return slot === "name" ? Math.PI / 4 : 0;
}

/** Height of the solid parts of `object` above its own origin, in its own units. Glows and beams that don't
 * cast shadows (lamps, light beams) are left out, so a flag sits on the roof. */
function solidHeight(object: Object3D): number {
  object.updateWorldMatrix(true, true);
  const box = new Box3();
  object.traverse((child) => {
    if (child.castShadow) box.expandByObject(child, false);
  });
  const base = new Vector3().setFromMatrixPosition(object.matrixWorld).y;
  const scale = object.getWorldScale(new Vector3()).y;
  return box.isEmpty() ? 1 : Math.max((box.max.y - base) / scale, 0.4);
}

/** The small "auto" pennant on the roof of an answer the agent settled by itself. */
function AutoFlag({ y }: { y: number }) {
  return (
    <group position={[0, y, 0]}>
      <Cyl position={[0, 0.3, 0]} r={0.025} h={0.6} seg={4} color="#d8dbe5" />
      <Box position={[0.17, 0.48, 0]} size={[0.3, 0.18, 0.02]} color={AUTO_FLAG} glow={0.9} sharp />
      <Ball position={[0, 0.62, 0]} r={0.04} detail={0} color={AUTO_FLAG} glow={1} />
    </group>
  );
}

interface SignedProps {
  stage: Stage;
  theme: Theme;
  auto: boolean;
  /** The logo for the sign on its roof, if it has one. */
  logo?: `${SlotId}:${string}`;
  /** Width of that logo, in model units. */
  logoSize?: number;
  /** Called once with the model's measured height and whether it got a logo sign. */
  onMeasure?: (height: number, hasSign: boolean) => void;
  onPointerOver?: (event: ThreeEvent<PointerEvent>) => void;
  onPointerOut?: (event: ThreeEvent<PointerEvent>) => void;
  children: ReactNode;
}

/** A model with its logo sign (or the "auto" flag) on its roof. The whole of it, sign
 * included, is drawn in `stage`'s look: the stage provider wraps the sign too. */
export function Signed(props: SignedProps) {
  const { stage, theme, auto, logo, logoSize = 0.95, onMeasure } = props;
  const content = useRef<Group>(null);
  const [height, setHeight] = useState<number | null>(null);
  const [slot, optionId] = logo?.split(":") ?? [];
  const hasSign = slot !== undefined && logoFor(slot as SlotId, optionId ?? "") !== null;
  useLayoutEffect(() => {
    if (!content.current) return;
    const measured = solidHeight(content.current);
    setHeight(measured);
    onMeasure?.(measured, hasSign);
    // Measured once: a new answer remounts the model.
  }, []);
  return (
    <Frame stage={stage} theme={theme}>
      <group ref={content} onPointerOver={props.onPointerOver} onPointerOut={props.onPointerOut}>
        {props.children}
        {logo && hasSign && height !== null ? (
          <LogoSign of={logo} position={[0, height - 0.05, 0]} size={logoSize} auto={auto} />
        ) : null}
      </group>
      {auto && !hasSign && height !== null ? <AutoFlag y={height} /> : null}
    </Frame>
  );
}

interface PlacedProps {
  /** Unique per model, for the hover label. */
  id: string;
  slot: SlotId;
  at: readonly [x: number, z: number];
  placement: Placement;
  theme: Theme;
  auto: boolean;
  logo?: `${SlotId}:${string}`;
  logoSize?: number;
  children: ReactNode;
}

/** Puts a model of `slot` on its spot, facing its street, at the town's scale. */
export function OnSpot(props: {
  slot: SlotId;
  at: readonly [x: number, z: number];
  children: ReactNode;
}) {
  const [x, z] = props.at;
  return (
    <group
      position={[x, groundAt(props.slot, props.at), z]}
      rotation={[0, facing(props.slot), 0]}
      scale={MODEL_SCALE}
    >
      {props.children}
    </group>
  );
}

/** Drops a model onto its spot and anchors the hover label above its roof. */
function Placed(props: PlacedProps) {
  const { id, slot, at, placement, theme, auto, logo, logoSize = 0.95, children } = props;
  const [x, z] = at;
  const y = groundAt(slot, at);
  const top = useRef(2);
  useEffect(() => () => clearHover(id), [id]);
  const text = hoverText(placement);
  const over = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    setHover({ id, ...text, anchor: [x, y + top.current * MODEL_SCALE, z] });
  };
  const out = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    clearHover(id);
  };
  return (
    <OnSpot slot={slot} at={at}>
      <Drop>
        <Signed
          stage={STAGE}
          theme={theme}
          auto={auto}
          logo={logo}
          logoSize={logoSize}
          onMeasure={(height, hasSign) => {
            top.current = height + (hasSign ? logoSignHeight(logoSize) : auto ? 0.65 : 0) + 0.3;
          }}
          onPointerOver={over}
          onPointerOut={out}
        >
          {children}
        </Signed>
      </Drop>
    </OnSpot>
  );
}

function SlotPlacement(props: {
  slot: SlotDef;
  placement: Placement;
  theme: Theme;
  projectName: string;
}) {
  const { slot, placement, theme } = props;
  const [lx, , lz] = lotPosition(slot.id);
  const lot = [lx, lz] as const;
  const kind = modelKindFor(slot, placement);
  switch (kind) {
    case "notNeeded":
      return (
        <Placed
          slot={slot.id}
          theme={theme}
          key="not-needed"
          id={`${slot.id}:not-needed`}
          at={lot}
          placement={placement}
          auto={false}
        >
          <NotNeeded stage={STAGE} theme={theme} />
        </Placed>
      );
    case "building":
    case "generic": {
      const optionId = placement.optionIds[0]!;
      const Model = buildingFor(slot.id, optionId);
      return (
        <Placed
          slot={slot.id}
          theme={theme}
          key={optionId}
          id={`${slot.id}:${optionId}`}
          at={lot}
          placement={placement}
          auto={placement.auto}
          logo={`${slot.id}:${optionId}`}
        >
          <Model label={placement.labels[0] ?? optionId} stage={STAGE} theme={theme} />
        </Placed>
      );
    }
    case "sign": {
      const name = projectNameFrom(placement, props.projectName);
      return (
        <Placed
          slot={slot.id}
          theme={theme}
          key={name}
          id={`${slot.id}:${name}`}
          at={lot}
          placement={{ ...placement, labels: [name] }}
          auto={false}
        >
          <NameSign label={name} stage={STAGE} theme={theme} />
        </Placed>
      );
    }
    case "paint":
      // Always the agent's `decide` (see TOWN.md), so no "auto" flag.
      return (
        <Placed
          slot={slot.id}
          theme={theme}
          id={slot.id}
          at={lot}
          placement={placement}
          auto={false}
        >
          <PaintFountain stage={STAGE} theme={theme} />
        </Placed>
      );
    case "props":
      return (
        <>
          {placement.optionIds.map((optionId, index) => {
            const Model = propFor(slot.id, optionId);
            const label = placement.labels[index] ?? optionId;
            return (
              <Placed
                slot={slot.id}
                theme={theme}
                key={optionId}
                id={`${slot.id}:${optionId}`}
                at={propSpot(slot.id, optionId, index)}
                placement={{ ...placement, optionIds: [optionId], labels: [label] }}
                auto={placement.auto}
                logo={`${slot.id}:${optionId}`}
                logoSize={propLogoSize(slot.id)}
              >
                <Model label={label} stage={STAGE} theme={theme} />
              </Placed>
            );
          })}
        </>
      );
  }
}

export function Placements({ state }: { state: TownState }) {
  const { base, accent, roundness } = themeFor(state.placements.ui);
  // A new object only when the paint changes, so the models don't re-render on every update.
  const theme = useMemo(() => ({ base, accent, roundness }), [base, accent, roundness]);
  return (
    <>
      {SLOTS.map((slot) => {
        const placement = state.placements[slot.id];
        return placement ? (
          <SlotPlacement
            key={slot.id}
            slot={slot}
            placement={placement}
            theme={theme}
            projectName={state.projectName}
          />
        ) : null;
      })}
    </>
  );
}
