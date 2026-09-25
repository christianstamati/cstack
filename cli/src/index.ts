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
import { copyTemplate } from "./template"
import { runLatestIfStale } from "./update"

const HELP = `Usage: create-cstack-app <name> [options]

Run it with \`bunx github:christianstamati/cstack <name>\`. It always
uses the latest commit on main unless you pin one with \`#<tag or sha>\`.

Scaffolds a project from the cstack template with a local Convex backend (no
Convex account needed) and a local git repo with the first commit.

Options:
  -y, --yes       Don't ask for Google credentials or confirmation
  -h, --help      Show this help

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

  p.note(
    [
      `Directory   ${root}`,
      "Convex      local deployment, no account needed",
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
  await copyTemplate(root, name)
  await run(["git", "init", "--quiet", "--initial-branch=main"], { cwd: root })
  spinner.message("Installing dependencies")
  await run(["bun", "install"], { cwd: root })
  spinner.stop("Project files ready")

  // Create the deployment first, so its URL is known when asking for Google
  // credentials: Google needs the redirect URI.
  spinner.start("Creating a local Convex deployment")
  await createLocalDeployment(backendDir)
  spinner.stop("Local Convex deployment created")
  const redirectUri = `${siteUrlFrom(await readLocalEnv(backendDir))}/oauth/google/callback`

  const google = await askGoogle(redirectUri, values.yes)

  spinner.start("Configuring the deployment")
  await setEnv(
    backendDir,
    await deploymentEnv({ siteUrl: DEV_SITE_URL, google })
  )
  spinner.message("Pushing the backend")
  await push(backendDir)
  spinner.stop("Deployment configured")

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
      "Backend    runs locally inside `bun dev`, data in packages/backend/.convex",
      "",
      "To push to GitHub, add a remote:",
      "git remote add origin git@github.com:<you>/<repo>.git",
      "git push -u origin main",
    ].join("\n"),
    "Next steps"
  )
  if (google) {
    p.log.info(
      `Make sure your Google OAuth client lists this redirect URI:\n${redirectUri}`
    )
  } else {
    p.log.warn(
      [
        "Set up Google sign-in: create an OAuth client (Web application) at",
        "https://console.cloud.google.com/apis/credentials with this redirect URI:",
        `  ${redirectUri}`,
        "then run these in packages/backend (each one asks for the value):",
        "  bunx convex env set AUTH_GOOGLE_CLIENT_ID",
        "  bunx convex env set AUTH_GOOGLE_CLIENT_SECRET",
      ].join("\n")
    )
  }
  p.outro(`${name} is ready.`)
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
