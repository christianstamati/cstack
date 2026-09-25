import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { generateAuthKeys } from "./auth-keys"
import { CommandError, run } from "./exec"

const convex = ["bunx", "convex"]

export type ConvexEnv = Record<string, string>

/**
 * Creates a local deployment for the project: the backend runs on this machine
 * as part of `convex dev`, with its data in packages/backend/.convex. It needs
 * no Convex account. Without a terminal attached, `convex dev` picks this mode
 * even when you're logged in.
 *
 * The first push fails until the required env vars exist, but it has created
 * the deployment and written packages/backend/.env.local by then.
 */
export async function createLocalDeployment(backendDir: string) {
  await run([...convex, "dev", "--once"], { cwd: backendDir }).catch(
    (error: unknown) => {
      if (!(error instanceof CommandError)) throw error
      if (!error.output.includes("MissingEnvironmentVariables")) throw error
    }
  )
}

/** The deployment `convex dev` selected, from packages/backend/.env.local. */
export async function readLocalEnv(backendDir: string) {
  const text = await readFile(join(backendDir, ".env.local"), "utf8")
  const env: Record<string, string> = {}
  for (const line of text.split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (match?.[1]) env[match[1]] = match[2] ?? ""
  }
  return env
}

/** Sets env vars on the deployment, passing values over stdin, not argv. */
export async function setEnv(backendDir: string, vars: ConvexEnv) {
  const set = (args: string[], input: string) =>
    run([...convex, "env", "set", ...args], { cwd: backendDir, input })

  // Values are sent as one single-quoted .env block (single quotes are
  // literal, so JSON is safe). Values containing a quote go one at a time.
  const entries = Object.entries(vars)
  const quotable = entries.filter(([, value]) => !value.includes("'"))
  if (quotable.length > 0) {
    const body = quotable.map(([key, value]) => `${key}='${value}'`)
    await set(["--force"], `${body.join("\n")}\n`)
  }
  for (const [key, value] of entries.filter(([, v]) => v.includes("'"))) {
    await set([key], value)
  }
}

/** Everything a deployment needs to accept a push and sign users in. */
export async function deploymentEnv(options: {
  siteUrl: string
  google: { clientId: string; clientSecret: string } | undefined
}): Promise<ConvexEnv> {
  return {
    ...(await generateAuthKeys()),
    SITE_URL: options.siteUrl,
    // Required by convex.config.ts. Placeholders keep pushes working until
    // real credentials are set; Google rejects them at sign-in.
    AUTH_GOOGLE_CLIENT_ID: options.google?.clientId ?? "not-configured",
    AUTH_GOOGLE_CLIENT_SECRET: options.google?.clientSecret ?? "not-configured",
  }
}

/** Pushes functions to the deployment and regenerates convex/_generated. */
export async function push(backendDir: string) {
  await run([...convex, "dev", "--once"], { cwd: backendDir })
}
