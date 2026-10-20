import { expect, test } from "vite-plus/test";

import { SLOTS } from "../../../src/town/catalog.ts";
import { GenericProp } from "../scene/Props.tsx";
import { Generic } from "./Generic.tsx";
import { BUILDINGS, buildingFor, PROPS, propFor } from "./registry.ts";

const buildingSlots = SLOTS.filter((s) => s.kind === "building");
const propSlots = SLOTS.filter((s) => s.kind === "props");

test("every building option in the catalog has its own building", () => {
  for (const slot of buildingSlots)
    for (const option of slot.options) expect(BUILDINGS[`${slot.id}:${option.id}`]).toBeDefined();
});

test("no two options share a building", () => {
  const keys = buildingSlots.flatMap((s) => s.options.map((o) => `${s.id}:${o.id}`));
  expect(new Set(keys.map((k) => BUILDINGS[k])).size).toBe(keys.length);
  expect(Object.values(BUILDINGS)).not.toContain(Generic);
});

test("unknown options get the generic building", () => {
  expect(buildingFor("frontend", "solid-start")).toBe(Generic);
  expect(buildingFor("frontend", "nextjs")).toBe(BUILDINGS["frontend:nextjs"]);
});

test("every extra and sign-in method has its own prop", () => {
  const keys = propSlots.flatMap((s) => s.options.map((o) => `${s.id}:${o.id}`));
  for (const key of keys) expect(PROPS[key]).toBeDefined();
  expect(new Set(keys.map((k) => PROPS[k])).size).toBe(keys.length);
  expect(propFor("extras", "storybook")).toBe(GenericProp);
  expect(propFor("extras", "ci")).toBe(PROPS["extras:ci"]);
});
