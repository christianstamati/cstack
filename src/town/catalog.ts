// The slots of the town and the options each one offers. Option ids are the
// `config.json` values from .github/BOOTSTRAP.md. Imported by the server and the
// browser page, so no Node imports here.

export type SlotId =
  | "name"
  | "structure"
  | "toolchain"
  | "packageManager"
  | "frontend"
  | "data"
  | "api"
  | "database"
  | "deploy"
  | "dbHost"
  | "auth"
  | "authMethods"
  | "ui"
  | "extras";

export interface SlotDef {
  readonly id: SlotId;
  readonly label: string;
  readonly kind: "building" | "sign" | "paint" | "props";
  readonly options: ReadonlyArray<{ readonly id: string; readonly label: string }>;
}

export const SLOTS: ReadonlyArray<SlotDef> = [
  { id: "name", label: "Project name", kind: "sign", options: [] },
  {
    id: "structure",
    label: "Structure",
    kind: "building",

    options: [
      { id: "single", label: "Single app" },
      { id: "monorepo", label: "Monorepo" },
    ],
  },
  {
    id: "toolchain",
    label: "Toolchain",
    kind: "building",

    options: [
      { id: "vite-plus", label: "Vite+" },
      { id: "biome-lefthook", label: "Biome + Lefthook" },
    ],
  },
  {
    id: "packageManager",
    label: "Package manager",
    kind: "building",

    options: [
      { id: "pnpm", label: "pnpm" },
      { id: "bun", label: "Bun" },
      { id: "npm", label: "npm" },
      { id: "yarn", label: "Yarn" },
    ],
  },
  {
    id: "frontend",
    label: "Frontend",
    kind: "building",

    options: [
      { id: "nextjs", label: "Next.js" },
      { id: "tanstack-start", label: "TanStack Start" },
    ],
  },
  {
    id: "data",
    label: "Backend / data",
    kind: "building",

    options: [
      { id: "none", label: "None" },
      { id: "convex", label: "Convex" },
      { id: "payload", label: "Payload" },
      { id: "drizzle", label: "Drizzle" },
    ],
  },
  {
    id: "api",
    label: "API layer",
    kind: "building",

    options: [
      { id: "builtin", label: "Built-in" },
      { id: "orpc", label: "oRPC" },
      { id: "trpc", label: "tRPC" },
      { id: "hono", label: "Hono" },
      { id: "elysia", label: "Elysia" },
      { id: "nestjs", label: "NestJS" },
    ],
  },
  {
    id: "database",
    label: "Database",
    kind: "building",

    options: [
      { id: "postgres", label: "Postgres" },
      { id: "mysql", label: "MySQL" },
      { id: "sqlite", label: "SQLite" },
      { id: "mongodb", label: "MongoDB" },
    ],
  },
  {
    id: "deploy",
    label: "Deployment",
    kind: "building",

    options: [
      { id: "vercel", label: "Vercel" },
      { id: "sst", label: "SST" },
      { id: "none", label: "None" },
    ],
  },
  {
    id: "dbHost",
    label: "Database hosting",
    kind: "building",

    options: [
      { id: "neon", label: "Neon" },
      { id: "supabase", label: "Supabase" },
      { id: "aws", label: "AWS" },
      { id: "planetscale", label: "PlanetScale" },
      { id: "turso", label: "Turso" },
      { id: "atlas", label: "Atlas" },
      { id: "local", label: "Local" },
    ],
  },
  {
    id: "auth",
    label: "Authentication",
    kind: "building",

    options: [
      { id: "none", label: "None" },
      { id: "better-auth", label: "Better Auth" },
      { id: "clerk", label: "Clerk" },
      { id: "workos", label: "WorkOS" },
      { id: "convex-auth-v2", label: "Convex Auth" },
      { id: "payload", label: "Payload auth" },
    ],
  },
  {
    id: "authMethods",
    label: "Sign-in methods",
    kind: "props",

    options: [
      { id: "google", label: "Google" },
      { id: "github", label: "GitHub" },
      { id: "password", label: "Password" },
      { id: "magic-link", label: "Magic link" },
    ],
  },
  { id: "ui", label: "UI styling", kind: "paint", options: [] },
  {
    id: "extras",
    label: "Extras",
    kind: "props",

    options: [
      { id: "example", label: "Example feature" },
      { id: "ci", label: "CI" },
      { id: "env", label: "Env validation" },
      { id: "tests", label: "Tests" },
      { id: "agent-docs", label: "Agent docs" },
    ],
  },
];

export function slotById(id: SlotId): SlotDef {
  const slot = SLOTS.find((s) => s.id === id);
  if (!slot) throw new Error(`Unknown slot ${id}`);
  return slot;
}

/** Does an answer with these option ids put a building (or props) on a block of its own?
 * The name is the entrance sign, the paint has no block, and "not needed" builds nothing. */
export function takesLot(slot: SlotId, optionIds: readonly string[]): boolean {
  const kind = slotById(slot).kind;
  return optionIds.length > 0 && (kind === "building" || kind === "props");
}
