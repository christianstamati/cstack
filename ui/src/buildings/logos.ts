// The logo on each building: the tool's own mark from simple-icons (CC0 icon data; the
// marks remain their owners' trademarks and only identify the tool), or a monogram badge
// for options simple-icons doesn't have. Icons are imported one by one so the bundle
// keeps only these.
import {
  siBetterauth,
  siBiome,
  siBun,
  siClerk,
  siConvex,
  siDrizzle,
  siGithub,
  siGithubactions,
  siGoogle,
  siHono,
  siMarkdown,
  siMongodb,
  siMysql,
  siNeon,
  siNestjs,
  siNextdotjs,
  siNpm,
  siPayloadcms,
  siPlanetscale,
  siPnpm,
  siPostgresql,
  siSqlite,
  siSst,
  siSupabase,
  siTanstack,
  siTrpc,
  siTurso,
  siVercel,
  siVite,
  siVitest,
  siYarn,
  type SimpleIcon,
} from "simple-icons";

import type { SlotId } from "../../../src/town/catalog.ts";

export type Logo =
  | { kind: "icon"; title: string; slug: string; hex: string; path: string }
  | { kind: "monogram"; text: string; color: string };

function icon(si: SimpleIcon): Logo {
  return {
    kind: "icon",
    title: si.title,
    slug: si.slug,
    hex: `#${si.hex.toLowerCase()}`,
    path: si.path,
  };
}

function monogram(text: string, color: string): Logo {
  return { kind: "monogram", text, color };
}

/** Keyed `${slot}:${optionId}`, like the buildings. */
const LOGOS: Readonly<Record<string, Logo>> = {
  "structure:single": monogram("1", "#c4553f"),
  "structure:monorepo": monogram("1+1", "#5b7fc7"),
  "toolchain:vite-plus": icon(siVite),
  "toolchain:biome-lefthook": icon(siBiome),
  "packageManager:pnpm": icon(siPnpm),
  "packageManager:bun": icon(siBun),
  "packageManager:npm": icon(siNpm),
  "packageManager:yarn": icon(siYarn),
  "frontend:nextjs": icon(siNextdotjs),
  "frontend:tanstack-start": icon(siTanstack),
  "data:none": monogram("∅", "#7d7f8c"),
  "data:convex": icon(siConvex),
  "data:payload": icon(siPayloadcms),
  "data:drizzle": icon(siDrizzle),
  "api:builtin": monogram("fn", "#5b6b8f"),
  "api:orpc": monogram("oRPC", "#3d63dd"),
  "api:trpc": icon(siTrpc),
  "api:hono": icon(siHono),
  "api:elysia": monogram("E", "#a35bd6"),
  "api:nestjs": icon(siNestjs),
  "database:postgres": icon(siPostgresql),
  "database:mysql": icon(siMysql),
  "database:sqlite": icon(siSqlite),
  "database:mongodb": icon(siMongodb),
  "deploy:vercel": icon(siVercel),
  "deploy:sst": icon(siSst),
  "deploy:none": monogram("∅", "#7d7f8c"),
  "dbHost:neon": icon(siNeon),
  "dbHost:supabase": icon(siSupabase),
  "dbHost:aws": monogram("AWS", "#232f3e"),
  "dbHost:planetscale": icon(siPlanetscale),
  "dbHost:turso": icon(siTurso),
  // Atlas is MongoDB's own hosting.
  "dbHost:atlas": icon(siMongodb),
  "dbHost:local": monogram("~/", "#6b4a35"),
  "auth:none": monogram("∅", "#7d7f8c"),
  "auth:better-auth": icon(siBetterauth),
  "auth:clerk": icon(siClerk),
  "auth:workos": monogram("W", "#6363f1"),
  "auth:convex-auth-v2": icon(siConvex),
  "auth:payload": icon(siPayloadcms),
  "authMethods:google": icon(siGoogle),
  "authMethods:github": icon(siGithub),
  "authMethods:password": monogram("***", "#b08a2e"),
  "authMethods:magic-link": monogram("✦", "#8a5cd6"),
  "extras:example": monogram("ex", "#e8833a"),
  "extras:ci": icon(siGithubactions),
  "extras:env": monogram(".env", "#3d8a5c"),
  "extras:tests": icon(siVitest),
  "extras:agent-docs": icon(siMarkdown),
};

export function logoFor(slot: SlotId, optionId: string): Logo | null {
  const key = `${slot}:${optionId}`;
  return Object.hasOwn(LOGOS, key) ? LOGOS[key]! : null;
}

const LIGHT_PLATE = "#f7f4ee";
const DARK_PLATE = "#1d1f27";

/** A plate colour behind a logo of colour `hex`: light behind dark and mid logos, dark
 * behind very light ones (white, cream, lime). */
export function plateFor(hex: string): string {
  const channel = (offset: number) => {
    const c = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  return luminance > 0.45 ? DARK_PLATE : LIGHT_PLATE;
}
