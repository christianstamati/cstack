#!/usr/bin/env bun
import { existsSync, readdirSync } from "node:fs"
import { join, relative, resolve } from "node:path"
import { parseArgs } from "node:util"

import * as p from "@clack/prompts"

import {
  createLocalDeployment,
  deploymentEnv,
  push,
  readLocalEnv,
  setEnv,
} from "./convex"
import { run } from "./exec"
import {
  BACKENDS,
  type Backend,
  DEFAULT_STACK,
  FRONTENDS,
  type Frontend,
  isBackend,
  isFrontend,
  type Stack,
} from "./stack"
import { copyTemplate } from "./template"
import { runLatestIfStale } from "./update"

const HELP = `Usage: create-cstack-app <name> [options]

Run it with \`bunx github:christianstamati/cstack <name>\`. It always
uses the latest commit on main unless you pin one with \`#<tag or sha>\`.

Scaffolds a project from the cstack template and makes the first commit in a
local git repo. With the Convex backend it also creates a local deployment
(no Convex account needed).

Options:
  --frontend <name>  tanstack-start (default) or nextjs
  --backend <name>   none (default) or convex
  -y, --yes          Use the defaults for anything not passed, and don't ask
                     for Google credentials or confirmation
  -h, --help         Show this help

Environment variables (both skip the Google prompt):
  CSTACK_GOOGLE_CLIENT_ID, CSTACK_GOOGLE_CLIENT_SECRET`

const NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/
const DEV_SITE_URL = "http://localhost:3000"

type Google = { clientId: string; clientSecret: string }

async function main() {
  await runLatestIfStale()

  const { values, positionals } = parseArgs({
    args: Bun.argv.slice(2),
    allowPositionals: true,
    options: {
      frontend: { type: "string" },
      backend: { type: "string" },
      yes: { type: "boolean", short: "y", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
  })

  if (values.help || positionals.length > 1) {
    console.log(HELP)
    process.exit(values.help ? 0 : 1)
  }

  p.intro("cstack")

  const name =
    positionals[0] ??
    (await ask(
      p.text({
        message: "Project name",
        placeholder: "my-app",
        validate: (value) => validateName(value ?? ""),
      })
    ))
  const invalid = validateName(name)
  if (invalid) fail(invalid)

  const root = resolve(process.cwd(), name)
  if (existsSync(root) && readdirSync(root).length > 0) {
    fail(`${relative(process.cwd(), root)} already exists and isn't empty`)
  }
  const backendDir = join(root, "packages/backend")

  const stack: Stack = {
    frontend: await chooseFrontend(values.frontend, values.yes),
    backend: await chooseBackend(values.backend, values.yes),
  }
  const convex = stack.backend === "convex"

  p.note(
    [
      `Directory   ${root}`,
      `Frontend    ${FRONTENDS[stack.frontend].label}`,
      `Backend     ${convex ? "Convex, local deployment, no account needed" : "None"}`,
      "Git         local repo with the first commit, no remote",
    ].join("\n"),
    "Plan"
  )
  if (!values.yes && !(await ask(p.confirm({ message: "Continue?" })))) {
    p.cancel("Nothing was created.")
    process.exit(0)
  }

  const spinner = p.spinner()

  spinner.start("Copying the template")
  await copyTemplate(root, name, stack)
  await run(["git", "init", "--quiet", "--initial-branch=main"], { cwd: root })
  spinner.message("Installing dependencies")
  await run(["bun", "install"], { cwd: root })
  spinner.stop("Project files ready")

  const auth = convex ? await setUpConvex(backendDir, values.yes) : undefined

  spinner.start("Creating the first commit")
  await run(["git", "add", "-A"], { cwd: root })
  await run(["git", "commit", "--quiet", "-m", "Initial commit from cstack"], {
    cwd: root,
  })
  spinner.stop("Created the first commit")

  p.note(
    [
      `cd ${relative(process.cwd(), root) || "."}`,
      "bun dev",
      "",
      `App        ${DEV_SITE_URL}`,
      ...(convex
        ? [
            "Backend    runs locally inside `bun dev`, data in packages/backend/.convex",
          ]
        : []),
      "",
      "To push to GitHub, add a remote:",
      "git remote add origin git@github.com:<you>/<repo>.git",
      "git push -u origin main",
    ].join("\n"),
    "Next steps"
  )
  if (auth?.google) {
    p.log.info(
      `Make sure your Google OAuth client lists this redirect URI:\n${auth.redirectUri}`
    )
  } else if (auth) {
    p.log.warn(
      [
        "Set up Google sign-in: create an OAuth client (Web application) at",
        "https://console.cloud.google.com/apis/credentials with this redirect URI:",
        `  ${auth.redirectUri}`,
        "then run these in packages/backend (each one asks for the value):",
        "  bunx convex env set AUTH_GOOGLE_CLIENT_ID",
        "  bunx convex env set AUTH_GOOGLE_CLIENT_SECRET",
      ].join("\n")
    )
  }
  p.outro(`${name} is ready.`)
}

async function chooseFrontend(flag: string | undefined, yes: boolean) {
  if (flag !== undefined) {
    if (!isFrontend(flag)) fail(`Unknown frontend: ${flag}`)
    return flag
  }
  if (yes) return DEFAULT_STACK.frontend
  return ask(
    p.select<Frontend>({
      message: "Frontend",
      initialValue: DEFAULT_STACK.frontend,
      options: Object.entries(FRONTENDS).map(([value, { label }]) => ({
        value: value as Frontend,
        label,
      })),
    })
  )
}

async function chooseBackend(flag: string | undefined, yes: boolean) {
  if (flag !== undefined) {
    if (!isBackend(flag)) fail(`Unknown backend: ${flag}`)
    return flag
  }
  if (yes) return DEFAULT_STACK.backend
  return ask(
    p.select<Backend>({
      message: "Backend",
      initialValue: DEFAULT_STACK.backend,
      options: Object.entries(BACKENDS).map(([value, backend]) => ({
        value: value as Backend,
        label: backend.label,
        hint: "hint" in backend ? backend.hint : undefined,
      })),
    })
  )
}

/**
 * Creates the local deployment, sets its env vars and pushes the backend.
 * Returns the Google redirect URI and the Google credentials, if any.
 */
async function setUpConvex(backendDir: string, yes: boolean) {
  const spinner = p.spinner()

  // Create the deployment first, so its URL is known when asking for Google
  // credentials: Google needs the redirect URI.
  spinner.start("Creating a local Convex deployment")
  await createLocalDeployment(backendDir)
  spinner.stop("Local Convex deployment created")
  const redirectUri = `${siteUrlFrom(await readLocalEnv(backendDir))}/oauth/google/callback`

  const google = await askGoogle(redirectUri, yes)

  spinner.start("Configuring the deployment")
  await setEnv(
    backendDir,
    await deploymentEnv({ siteUrl: DEV_SITE_URL, google })
  )
  spinner.message("Pushing the backend")
  await push(backendDir)
  spinner.stop("Deployment configured")

  return { redirectUri, google }
}

function validateName(name: string) {
  if (!NAME_PATTERN.test(name)) {
    return "Use lowercase letters, numbers and dashes, like my-app"
  }
  return undefined
}

function siteUrlFrom(env: Record<string, string>) {
  const site = env.VITE_CONVEX_SITE_URL ?? env.CONVEX_SITE_URL
  if (!site) fail("Convex didn't write a deployment URL to .env.local")
  return site
}

async function askGoogle(redirectUri: string, yes: boolean) {
  const clientId = process.env.CSTACK_GOOGLE_CLIENT_ID
  const clientSecret = process.env.CSTACK_GOOGLE_CLIENT_SECRET
  if (clientId && clientSecret) return { clientId, clientSecret }
  if (yes) return undefined

  p.note(
    [
      "Google is the only sign-in method. Create an OAuth client",
      "(type: Web application) at",
      "https://console.cloud.google.com/apis/credentials",
      "and add this authorized redirect URI:",
      `  ${redirectUri}`,
    ].join("\n"),
    "Google sign-in"
  )
  const id = await ask(
    p.text({ message: "Google client ID (leave empty to set it up later)" })
  )
  if (!id?.trim()) return undefined
  const secret = await ask(p.password({ message: "Google client secret" }))
  return secret.trim()
    ? ({ clientId: id.trim(), clientSecret: secret.trim() } satisfies Google)
    : undefined
}

async function ask<T>(prompt: Promise<T>): Promise<Exclude<T, symbol>> {
  const value = await prompt
  if (p.isCancel(value)) {
    p.cancel("Cancelled.")
    process.exit(1)
  }
  return value as Exclude<T, symbol>
}

function fail(message: string): never {
  p.cancel(message)
  process.exit(1)
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

main().catch((error: unknown) => {
  p.log.error(errorText(error))
  p.cancel(
    "Setup failed. The project directory was left in place so you can inspect it."
  )
  process.exit(1)
})
