/**
 * The choices a generated project is made from. This repo is the TanStack
 * Start + Convex project; every other combination is derived from it by
 * removing the parts that don't apply and copying variant files from
 * cli/template/variants over the result.
 */
export const FRONTENDS = {
  "tanstack-start": { label: "TanStack Start" },
  nextjs: { label: "Next.js" },
} as const

export const BACKENDS = {
  none: { label: "None" },
  convex: { label: "Convex", hint: "local deployment, no account needed" },
} as const

export type Frontend = keyof typeof FRONTENDS
export type Backend = keyof typeof BACKENDS
export type Stack = { frontend: Frontend; backend: Backend }

export const DEFAULT_STACK: Stack = {
  frontend: "tanstack-start",
  backend: "none",
}

export function isFrontend(value: string): value is Frontend {
  return Object.hasOwn(FRONTENDS, value)
}

export function isBackend(value: string): value is Backend {
  return Object.hasOwn(BACKENDS, value)
}

/** How to turn this repo into `stack`. Paths are relative to the repo root. */
export type Recipe = {
  /** Repo files under these paths are left out… */
  remove: string[]
  /** …unless they're under one of these. */
  keep: string[]
  /** Changes to package.json files, by path. */
  packages: Record<string, PackageEdit>
  /** Directories in cli/template/variants copied over the result, in order. */
  overlays: string[]
}

export type PackageEdit = {
  dropDependencies?: string[]
  /** Scripts to set; `null` removes one. */
  scripts?: Record<string, string | null>
}

/** Without a backend nothing has tests, and `vp run -r test` fails on that. */
const NO_TESTS: Record<string, PackageEdit> = {
  "package.json": { scripts: { test: null, ci: "vp check" } },
}

/** The web app's Convex code that doesn't depend on the router. */
const CONVEX_UI = [
  "apps/web/src/components/auth/SignInCard.tsx",
  "apps/web/src/components/auth/UserMenu.tsx",
  "apps/web/src/components/layout/AppShell.tsx",
  "apps/web/src/components/layout/LoadingScreen.tsx",
  "apps/web/src/components/tasks/",
  "apps/web/src/lib/errors.ts",
]

export function recipe({ frontend, backend }: Stack): Recipe {
  const convex = backend === "convex"

  if (frontend === "nextjs") {
    return {
      // The Next.js app replaces apps/web, reusing only what isn't tied to
      // TanStack Start.
      remove: ["apps/web/", ...(convex ? [] : ["packages/backend/"])],
      keep: ["apps/web/public/", ...(convex ? CONVEX_UI : [])],
      packages: convex ? {} : NO_TESTS,
      overlays: ["nextjs/base", ...(convex ? ["nextjs/convex"] : [])],
    }
  }

  if (convex) {
    return { remove: [], keep: [], packages: {}, overlays: [] }
  }
  return {
    remove: [
      "packages/backend/",
      "apps/web/vercel.json",
      "apps/web/src/components/auth/",
      "apps/web/src/components/tasks/",
      "apps/web/src/components/layout/AppHeader.tsx",
      "apps/web/src/components/layout/AppShell.tsx",
      "apps/web/src/components/layout/LoadingScreen.tsx",
      "apps/web/src/lib/errors.ts",
      "apps/web/src/routes/_authed.tsx",
      "apps/web/src/routes/_authed/",
      "apps/web/src/routes/sign-in.tsx",
      "apps/web/src/vite-env.d.ts",
    ],
    keep: [],
    packages: {
      ...NO_TESTS,
      "apps/web/package.json": {
        dropDependencies: [
          "@convex-dev/auth",
          "@convex-dev/react-query",
          "@workspace/backend",
          "convex",
        ],
      },
    },
    overlays: ["tanstack-start/none"],
  }
}

/** Whether `<!-- cstack:if name=value -->` blocks apply to `stack`. */
export function matches(stack: Stack, condition: string) {
  const [name, value] = condition.split("=")
  if (name === "frontend") return stack.frontend === value
  if (name === "backend") return stack.backend === value
  // `repo` marks text about this template repo itself.
  if (name === "repo") return false
  throw new Error(`Unknown template condition: ${condition}`)
}
