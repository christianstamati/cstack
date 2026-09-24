import { readFile } from "node:fs/promises"
import { userInfo } from "node:os"
import { join } from "node:path"
import { generateAuthKeys } from "./auth-keys"
import { CommandError, run, runInteractive, stripAnsi } from "./exec"

const convex = ["bunx", "convex"]

export type ConvexEnv = Record<string, string>

/**
 * Creates a Convex cloud project with a personal dev deployment (selected in
 * packages/backend/.env.local) and a default production deployment.
 */
export async function createCloudProject(
  backendDir: string,
  name: string,
  team: string | undefined
) {
  // Interactive so Convex can ask which team to use when there are several.
  const output = await runInteractive(
    [...convex, "project", "create", name, ...(team ? ["--team", team] : [])],
    { cwd: backendDir }
  )
  const created = output.match(/Created project (\S+) in team (\S+?),/)
  if (!created?.[1] || !created[2]) {
    throw new Error(`Could not read the new project from:\n${output}`)
  }
  const [, projectSlug, teamSlug] = created

  // "dev" is reserved as an alias, so personal dev deployments get their own
  // reference, like dev/chris.
  const devRef = `dev/${userInfo()
    .username.toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")}`
  await run(
    [
      ...convex,
      "deployment",
      "create",
      `${teamSlug}:${projectSlug}:${devRef}`,
      "--type",
      "dev",
      "--default",
      "--select",
    ],
    { cwd: backendDir }
  )

  const prod = await run(
    [...convex, "deployment", "create", "--type", "prod", "--default"],
    { cwd: backendDir }
  )
  const prodUrl = `${prod.stdout}\n${prod.stderr}`.match(
    /https:\/\/[\w.-]+\.convex\.cloud/
  )?.[0]
  if (!prodUrl) {
    throw new Error("Could not read the production deployment URL")
  }

  return {
    teamSlug,
    projectSlug,
    dashboardUrl: `https://dashboard.convex.dev/t/${teamSlug}/${projectSlug}`,
    prodSiteUrl: prodUrl.replace(/\.convex\.cloud$/, ".convex.site"),
  }
}

/**
 * A local deployment that needs no Convex account. The first push fails until
 * the required env vars exist, but it has created the deployment by then.
 */
export async function createLocalDeployment(backendDir: string) {
  await run([...convex, "dev", "--once"], {
    cwd: backendDir,
    env: { CONVEX_AGENT_MODE: "anonymous" },
  }).catch((error: unknown) => {
    if (!(error instanceof CommandError)) throw error
    if (!error.output.includes("MissingEnvironmentVariables")) throw error
  })
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

/** Sets env vars on a deployment, passing values over stdin, not argv. */
export async function setEnv(
  backendDir: string,
  vars: ConvexEnv,
  options: { prod?: boolean; local?: boolean } = {}
) {
  const set = (args: string[], input: string) =>
    run(
      [...convex, "env", "set", ...args, ...(options.prod ? ["--prod"] : [])],
      {
        cwd: backendDir,
        input,
        env: options.local ? { CONVEX_AGENT_MODE: "anonymous" } : undefined,
      }
    )

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
  resendApiKey: string | undefined
  emailFrom: string | undefined
}): Promise<ConvexEnv> {
  return {
    ...(await generateAuthKeys()),
    SITE_URL: options.siteUrl,
    // Required by convex.config.ts. Placeholders keep deploys working until
    // real credentials are set; Google rejects them at sign-in.
    AUTH_GOOGLE_CLIENT_ID: options.google?.clientId ?? "not-configured",
    AUTH_GOOGLE_CLIENT_SECRET: options.google?.clientSecret ?? "not-configured",
    ...(options.resendApiKey && { RESEND_API_KEY: options.resendApiKey }),
    ...(options.emailFrom && { EMAIL_FROM: options.emailFrom }),
  }
}

/** Pushes functions to the selected dev deployment and regenerates types. */
export async function push(backendDir: string, options: { local?: boolean }) {
  await run([...convex, "dev", "--once"], {
    cwd: backendDir,
    env: options.local ? { CONVEX_AGENT_MODE: "anonymous" } : undefined,
  })
}

/** A production deploy key, for Vercel's CONVEX_DEPLOY_KEY. */
export async function createProdDeployKey(backendDir: string, name: string) {
  const { stdout } = await run(
    [...convex, "deployment", "token", "create", name, "--prod"],
    { cwd: backendDir }
  )
  const key = stripAnsi(stdout)
    .split("\n")
    .map((line) => line.trim())
    .findLast((line) => line.includes("|"))
  if (!key) {
    throw new Error("Could not read the deploy key from the Convex CLI")
  }
  return key
}
