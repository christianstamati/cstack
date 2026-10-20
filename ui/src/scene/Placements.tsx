// Everything the answers put in the town: a building on the block each answer was given,
// the entrance sign, the props for extras and sign-in methods, and the paint fountain.
// Each drops in when its answer arrives and shows its label on hover. Buildings face
// their block's front street (+z) and stand on its sidewalk. A "not needed" answer puts
// nothing in the town. Through the build each one shows its stage (see `stageFor`); the
// entrance sign never changes. In "Change something" every model can be clicked.
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { Box3, Vector3, type Group, type Object3D } from "three";

import { SLOTS, type SlotDef, type SlotId } from "../../../src/town/catalog.ts";
import type { Placement, TownState } from "../../../src/town/protocol.ts";
import { LogoSign, logoSignHeight } from "../buildings/Badge.tsx";
import { Drop, prefersReducedMotion } from "../buildings/Drop.tsx";
import { Ball, Box, Cyl, Frame, Smoke, stageLook, WOOD, Wobble } from "../buildings/kit.tsx";
import { logoFor } from "../buildings/logos.ts";
import { buildingFor, propFor } from "../buildings/registry.ts";
import {
  buildNote,
  hoverText,
  modelKindFor,
  projectNameFrom,
  propSpot,
  spotFor,
  stageFor,
  themeFor,
  type Stage,
  type Theme,
} from "../logic.ts";
import { assignBlocks, blockCentre, GRID } from "../streets.ts";
import { clearHover, setHover } from "./Hover.tsx";
import { NameSign } from "./NameSign.tsx";
import { PickRing, usePicker } from "./Pick.tsx";
import { PaintFountain } from "./Props.tsx";
import { BLOCK_TOP } from "./Streets.tsx";

const AUTO_FLAG = "#7fe9ff";
/** Models are drawn a little larger than their lot units, to read well from afar. */
const MODEL_SCALE = 1.15;

/** Width of a prop's logo sign: sign-in methods share a lot, so theirs are smaller. */
export function propLogoSize(slot: SlotId): number {
  return slot === "authMethods" ? 0.5 : 0.7;
}

type Placements = TownState["placements"];

/** How high a model of `slot` stands at (x, z): on the sidewalk of the block the slot was
 * given, else on the grass. */
function groundAt(slot: SlotId, [x, z]: readonly [x: number, z: number], placements: Placements) {
  const cell = assignBlocks(placements)[slot];
  if (!cell) return 0;
  const [cx, cz] = blockCentre(cell);
  return Math.max(Math.abs(x - cx), Math.abs(z - cz)) < GRID.block / 2 ? BLOCK_TOP : 0;
}

/** The entrance sign turns to face the starting view, the fountain to fit its square;
 * everything else faces +z. */
function facing(slot: SlotId): number {
  if (slot === "name") return Math.PI / 4;
  return slot === "ui" ? Math.PI / 2 : 0;
}

/** The solid parts of a model (glows and beams that cast no shadow, such as lamps and light
 * beams, are left out, so a flag sits on the roof), in its own units: how tall they stand
 * above its origin and how far they reach across it. */
export interface Footprint {
  height: number;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

function measure(object: Object3D): Footprint {
  object.updateWorldMatrix(true, true);
  const box = new Box3();
  object.traverse((child) => {
    if (child.castShadow) box.expandByObject(child, false);
  });
  if (box.isEmpty()) return { height: 1, minX: -0.5, maxX: 0.5, minZ: -0.5, maxZ: 0.5 };
  const origin = new Vector3().setFromMatrixPosition(object.matrixWorld);
  const scale = object.getWorldScale(new Vector3());
  // Read off the world's axes: right for models that face +z. The fountain turns a quarter
  // but is round; the entrance sign turns an eighth but never gets scaffolding, only a ring.
  const [ax, az] = [Math.abs(scale.x), Math.abs(scale.z)];
  return {
    height: Math.max((box.max.y - origin.y) / scale.y, 0.4),
    minX: (box.min.x - origin.x) / ax,
    maxX: (box.max.x - origin.x) / ax,
    minZ: (box.min.z - origin.z) / az,
    maxZ: (box.max.z - origin.z) / az,
  };
}

/** How far a footprint reaches from the model's middle, for the ring round it. */
function reachOf({ minX, maxX, minZ, maxZ }: Footprint): number {
  return Math.min(Math.max(-minX, maxX, -minZ, maxZ), 2.2);
}

const SCAFFOLD = "#eaa43c";

/** Scaffolding round a building being built: poles at the corners, rails and planks at each
 * level, a brace across the front. */
function Scaffold({ size }: { size: Footprint }) {
  const pad = 0.14;
  const [x0, x1, z0, z1] = [size.minX - pad, size.maxX + pad, size.minZ - pad, size.maxZ + pad];
  const top = size.height + 0.15;
  const levels = Math.max(2, Math.round(top / 0.75));
  const step = top / levels;
  const [w, d] = [x1 - x0, z1 - z0];
  const brace = Math.hypot(w, step);
  return (
    <group>
      {[x0, x1].flatMap((x) =>
        [z0, z1].map((z) => (
          <Cyl
            key={`${x}:${z}`}
            position={[x, top / 2, z]}
            r={0.035}
            h={top}
            seg={5}
            color={SCAFFOLD}
          />
        )),
      )}
      {Array.from({ length: levels }, (_, i) => {
        const y = (i + 1) * step;
        return (
          <group key={i}>
            <Box position={[(x0 + x1) / 2, y, z0]} size={[w, 0.04, 0.04]} color={SCAFFOLD} sharp />
            <Box position={[(x0 + x1) / 2, y, z1]} size={[w, 0.04, 0.04]} color={SCAFFOLD} sharp />
            <Box position={[x0, y, (z0 + z1) / 2]} size={[0.04, 0.04, d]} color={SCAFFOLD} sharp />
            <Box position={[x1, y, (z0 + z1) / 2]} size={[0.04, 0.04, d]} color={SCAFFOLD} sharp />
            <Box
              position={[(x0 + x1) / 2, y - 0.03, z1 + 0.1]}
              size={[w, 0.03, 0.2]}
              color={WOOD}
            />
            <Box
              position={[(x0 + x1) / 2, y - step / 2, z1 + 0.02]}
              rotation={[0, 0, (i % 2 === 0 ? 1 : -1) * Math.atan2(step, w)]}
              size={[brace, 0.03, 0.03]}
              color={SCAFFOLD}
              sharp
            />
          </group>
        );
      })}
    </group>
  );
}

const FAIL_RED = "#e5484d";

/** A failed step: dark smoke from the roof and a red flag on its corner. */
function FailedMarks({ size }: { size: Footprint }) {
  return (
    <group>
      <Smoke
        position={[(size.minX + size.maxX) / 4, size.height, (size.minZ + size.maxZ) / 2]}
        color="#55545e"
        size={1.9}
      />
      <group position={[size.maxX - 0.15, size.height - 0.02, size.maxZ - 0.15]}>
        <Cyl position={[0, 0.42, 0]} r={0.025} h={0.84} seg={4} color="#d8dbe5" />
        <Wobble kind="sway" axis="y" amount={0.3} speed={3.2} position={[0, 0.72, 0]}>
          <Box
            position={[0.19, 0, 0]}
            size={[0.36, 0.24, 0.02]}
            color={FAIL_RED}
            glow={0.6}
            sharp
          />
        </Wobble>
      </group>
    </group>
  );
}

/** A small bounce, over and over, while `on` (a building being built). */
function useBounce(group: RefObject<Group | null>, on: boolean): void {
  const still = useMemo(prefersReducedMotion, []);
  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    if (!on || still) {
      if (g.position.y !== 0 || g.scale.y !== 1) {
        g.position.y = 0;
        g.scale.set(1, 1, 1);
      }
      return;
    }
    const hop = Math.abs(Math.sin((clock.elapsedTime * Math.PI) / 0.8));
    g.position.y = 0.09 * hop;
    g.scale.set(1 - 0.015 * hop, 1 + 0.03 * hop, 1 - 0.015 * hop);
  });
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
  /** Called once with the model's measured size and whether it got a logo sign. */
  onMeasure?: (size: Footprint, hasSign: boolean) => void;
  onPointerOver?: (event: ThreeEvent<PointerEvent>) => void;
  onPointerOut?: (event: ThreeEvent<PointerEvent>) => void;
  onClick?: (event: ThreeEvent<MouseEvent>) => void;
  children: ReactNode;
}

/** A model with its logo sign (or the "auto" flag) on its roof. The whole of it, sign
 * included, is drawn in `stage`'s look: the stage provider wraps the sign too, and the
 * look says whether it gets scaffolding and a bounce, or smoke and a red flag. */
export function Signed(props: SignedProps) {
  const { stage, theme, auto, logo, logoSize = 0.95, onMeasure } = props;
  const look = stageLook(stage);
  const content = useRef<Group>(null);
  const bouncing = useRef<Group>(null);
  const [size, setSize] = useState<Footprint | null>(null);
  const [slot, optionId] = logo?.split(":") ?? [];
  const hasSign = slot !== undefined && logoFor(slot as SlotId, optionId ?? "") !== null;
  useLayoutEffect(() => {
    if (!content.current) return;
    const measured = measure(content.current);
    setSize(measured);
    onMeasure?.(measured, hasSign);
    // Measured once: a new answer remounts the model.
  }, []);
  useBounce(bouncing, look.scaffold);
  const height = size?.height ?? null;
  return (
    <Frame stage={stage} theme={theme}>
      <group
        onPointerOver={props.onPointerOver}
        onPointerOut={props.onPointerOut}
        onClick={props.onClick}
      >
        <group ref={bouncing}>
          <group ref={content}>
            {props.children}
            {logo && hasSign && height !== null ? (
              <LogoSign of={logo} position={[0, height - 0.05, 0]} size={logoSize} auto={auto} />
            ) : null}
          </group>
          {auto && !hasSign && height !== null ? <AutoFlag y={height} /> : null}
        </group>
        {look.scaffold && size ? <Scaffold size={size} /> : null}
        {look.failed && size ? <FailedMarks size={size} /> : null}
      </group>
    </Frame>
  );
}

interface PlacedProps {
  /** Unique per model, for the hover label. */
  id: string;
  slot: SlotId;
  at: readonly [x: number, z: number];
  placements: Placements;
  placement: Placement;
  theme: Theme;
  stage: Stage;
  /** What the build says about it (see `buildNote`), for the hover label. */
  note: string | null;
  auto: boolean;
  logo?: `${SlotId}:${string}`;
  logoSize?: number;
  children: ReactNode;
}

/** Puts a model of `slot` on its spot, facing its street, at the town's scale. */
export function OnSpot(props: {
  slot: SlotId;
  at: readonly [x: number, z: number];
  placements: Placements;
  children: ReactNode;
}) {
  const [x, z] = props.at;
  return (
    <group
      position={[x, groundAt(props.slot, props.at, props.placements), z]}
      rotation={[0, facing(props.slot), 0]}
      scale={MODEL_SCALE}
    >
      {props.children}
    </group>
  );
}

/** How far the pointer may move between press and release for a click to count as a pick
 * (more is the user turning the view). */
const CLICK_SLOP = 6;

/** Drops a model onto its spot and anchors the hover label above its roof. In pick mode it
 * glows with a ring round its foot and a click on it picks its slot. */
function Placed(props: PlacedProps) {
  const { id, slot, at, placements, placement, theme, stage, note, auto, logo } = props;
  const logoSize = props.logoSize ?? 0.95;
  const [x, z] = at;
  const y = groundAt(slot, at, placements);
  const top = useRef(2);
  const [reach, setReach] = useState(1.2);
  const pick = usePicker();
  const [hot, setHot] = useState(false);
  useEffect(() => () => clearHover(id), [id]);
  // Pick mode over: nothing is hot any more.
  useEffect(() => {
    if (pick) return;
    setHot(false);
    document.body.style.cursor = "";
  }, [pick]);
  const text = hoverText(placement);
  const over = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    const detail = pick ? "Click to change this" : (note ?? text.detail);
    setHover({ id, title: text.title, detail, anchor: [x, y + top.current * MODEL_SCALE, z] });
    if (pick) {
      setHot(true);
      document.body.style.cursor = "pointer";
    }
  };
  const out = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    clearHover(id);
    setHot(false);
    if (pick) document.body.style.cursor = "";
  };
  const click = (event: ThreeEvent<MouseEvent>) => {
    if (!pick || event.delta > CLICK_SLOP) return;
    event.stopPropagation();
    clearHover(id);
    document.body.style.cursor = "";
    pick(slot);
  };
  return (
    <OnSpot slot={slot} at={at} placements={placements}>
      {pick ? <PickRing radius={reach + 0.12} hot={hot} /> : null}
      <Drop>
        <Signed
          stage={stage}
          theme={theme}
          auto={auto}
          logo={logo}
          logoSize={logoSize}
          onMeasure={(size, hasSign) => {
            top.current =
              size.height + (hasSign ? logoSignHeight(logoSize) : auto ? 0.65 : 0) + 0.3;
            setReach(reachOf(size));
          }}
          onPointerOver={over}
          onPointerOut={out}
          onClick={click}
        >
          {props.children}
        </Signed>
      </Drop>
    </OnSpot>
  );
}

function SlotPlacement(props: {
  slot: SlotDef;
  placement: Placement;
  placements: Placements;
  theme: Theme;
  projectName: string;
  stage: Stage;
  note: string | null;
}) {
  const { slot, placement, placements, theme, stage, note } = props;
  const lot = spotFor(slot.id, placements);
  const kind = modelKindFor(slot, placement);
  switch (kind) {
    case "notNeeded":
      // Takes no block: nothing to show.
      return null;
    case "building":
    case "generic": {
      const optionId = placement.optionIds[0]!;
      const Model = buildingFor(slot.id, optionId);
      return (
        <Placed
          slot={slot.id}
          placements={placements}
          theme={theme}
          key={optionId}
          id={`${slot.id}:${optionId}`}
          at={lot}
          placement={placement}
          stage={stage}
          note={note}
          auto={placement.auto}
          logo={`${slot.id}:${optionId}`}
        >
          <Model label={placement.labels[0] ?? optionId} stage={stage} theme={theme} />
        </Placed>
      );
    }
    case "sign": {
      const name = projectNameFrom(placement, props.projectName);
      return (
        <Placed
          slot={slot.id}
          placements={placements}
          theme={theme}
          key={name}
          id={`${slot.id}:${name}`}
          at={lot}
          placement={{ ...placement, labels: [name] }}
          // The entrance sign stays as it is through the build.
          stage="placed"
          note={null}
          auto={false}
        >
          <NameSign label={name} stage="placed" theme={theme} />
        </Placed>
      );
    }
    case "paint":
      // Always the agent's `decide` (see TOWN.md), so no "auto" flag.
      return (
        <Placed
          slot={slot.id}
          placements={placements}
          theme={theme}
          id={slot.id}
          at={lot}
          placement={placement}
          stage={stage}
          note={note}
          auto={false}
        >
          <PaintFountain stage={stage} theme={theme} />
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
                placements={placements}
                theme={theme}
                key={optionId}
                id={`${slot.id}:${optionId}`}
                at={propSpot(slot.id, optionId, index, placements)}
                placement={{ ...placement, optionIds: [optionId], labels: [label] }}
                stage={stage}
                note={note}
                auto={placement.auto}
                logo={`${slot.id}:${optionId}`}
                logoSize={propLogoSize(slot.id)}
              >
                <Model label={label} stage={stage} theme={theme} />
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
            placements={state.placements}
            theme={theme}
            projectName={state.projectName}
            stage={stageFor(slot.id, state)}
            note={buildNote(slot.id, state)}
          />
        ) : null;
      })}
    </>
  );
}
