// Which model stands for which answer. Keys are `${slot}:${optionId}`; an option the town
// has no model for gets the generic building (or prop) with its label on it.
import type { ComponentType } from "react";

import type { SlotId } from "../../../src/town/catalog.ts";
import { AUTH_METHODS, EXTRAS, GenericProp } from "../scene/Props.tsx";
import { API } from "./api.tsx";
import { AUTH } from "./auth.tsx";
import { DATA } from "./data.tsx";
import { DATABASE } from "./database.tsx";
import { DB_HOST } from "./db-host.tsx";
import { DEPLOY } from "./deploy.tsx";
import { FRONTEND } from "./frontend.tsx";
import { Generic } from "./Generic.tsx";
import type { BuildingProps } from "./kit.tsx";
import { PACKAGE_MANAGER } from "./package-manager.tsx";
import { STRUCTURE } from "./structure.tsx";
import { TOOLCHAIN } from "./toolchain.tsx";

export type { BuildingProps } from "./kit.tsx";

type Models = Record<string, ComponentType<BuildingProps>>;

function keyed(bySlot: Partial<Record<SlotId, Models>>): Models {
  const models: Models = {};
  for (const [slot, options] of Object.entries(bySlot))
    for (const [id, model] of Object.entries(options)) models[`${slot}:${id}`] = model;
  return models;
}

/** One building per option of every `building`-kind slot. */
export const BUILDINGS: Readonly<Models> = keyed({
  structure: STRUCTURE,
  toolchain: TOOLCHAIN,
  packageManager: PACKAGE_MANAGER,
  frontend: FRONTEND,
  data: DATA,
  api: API,
  database: DATABASE,
  deploy: DEPLOY,
  dbHost: DB_HOST,
  auth: AUTH,
});

/** One prop per option of every `props`-kind slot (extras, sign-in methods). */
export const PROPS: Readonly<Models> = keyed({ extras: EXTRAS, authMethods: AUTH_METHODS });

function find(models: Readonly<Models>, slot: SlotId, optionId: string) {
  const key = `${slot}:${optionId}`;
  return Object.hasOwn(models, key) ? models[key] : undefined;
}

export function buildingFor(slot: SlotId, optionId: string): ComponentType<BuildingProps> {
  return find(BUILDINGS, slot, optionId) ?? Generic;
}

export function propFor(slot: SlotId, optionId: string): ComponentType<BuildingProps> {
  return find(PROPS, slot, optionId) ?? GenericProp;
}
