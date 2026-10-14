import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { parseEnv } from "node:util"

import type { NextConfig } from "next"

// `convex dev` writes VITE_CONVEX_URL to packages/backend/.env.local. Reuse it
// so there is one source of truth. On Vercel, `convex deploy` injects
// NEXT_PUBLIC_CONVEX_URL, which takes precedence. Next runs from apps/web.
const backendEnv = join(process.cwd(), "../../packages/backend/.env.local")
const convexEnv = existsSync(backendEnv)
  ? parseEnv(readFileSync(backendEnv, "utf8"))
  : {}
const convexUrl =
  process.env.NEXT_PUBLIC_CONVEX_URL ?? convexEnv.VITE_CONVEX_URL

const nextConfig: NextConfig = {
  env: convexUrl ? { NEXT_PUBLIC_CONVEX_URL: convexUrl } : {},
  // The shared UI package ships TypeScript source, and Convex Auth's alpha
  // needs transpiling too.
  transpilePackages: ["@workspace/ui", "@convex-dev/auth"],
  // `vp check` type-checks the app with TypeScript 7. Next's own check needs
  // the TypeScript JS API, which TypeScript 7 doesn't have.
  typescript: { ignoreBuildErrors: true },
}

export default nextConfig
