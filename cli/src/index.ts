#!/usr/bin/env bun
import { existsSync, readdirSync } from "node:fs"
import { join, relative, resolve } from "node:path"
import { parseArgs } from "node:util"
import * as p from "@clack/prompts"
import {
  createCloudProject,
  createLocalDeployment,
  createProdDeployKey,
  deploymentEnv,
  push,
  readLocalEnv,
  setEnv,
} from "./convex"
import { hasCommand, run } from "./exec"
import { createGithubRepo, isGithubReady, pushMain } from "./github"
import { copyTemplate } from "./template"
import { runLatestIfStale } from "./update"
import { createVercelProject, isVercelReady } from "./vercel"

const HELP = `Usage: create-cstack-app <name> [options]

Run it with \`bunx github:christianstamati/cstack <name>\`. It always
uses the latest commit on main unless you pin one with \`#<tag or sha>\`.

Scaffolds a project from the cstack template, provisions its Convex backend,
and creates a GitHub repo and a Vercel project that deploys on every push.

Options:
  --team <slug>   Convex team to create the project in
  --local         Local Convex deployment only: no Convex account, GitHub or Vercel
  --no-github     Skip the GitHub repo (and therefore Vercel)
  --no-vercel     Skip the Vercel project
  --public        Make the GitHub repo public (default: private)
  -y, --yes       Don't ask for optional credentials or confirmation
  -h, --help      Show this help

Environment variables (each one skips its prompt):
  CSTACK_GOOGLE_CLIENT_ID, CSTACK_GOOGLE_CLIENT_SECRET   Google OAuth client
  CSTACK_RESEND_API_KEY                                  Resend API key
  CSTACK_EMAIL_FROM          Email sender, e.g. "My App <hi@example.com>"
  CSTACK_CONVEX_TEAM         Default for --team`

const NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/
const DEV_SITE_URL = "http://localhost:3000"

type Google = { clientId: string; clientSecret: string }

async function main() {
  await runLatestIfStale()

  const { values, positionals } = parseArgs({
    args: Bun.argv.slice(2),
    allowPositionals: true,
    options: {
      team: { type: "string" },
      local: { type: "boolean", default: false },
      "no-github": { type: "boolean", default: false },
      "no-vercel": { type: "boolean", default: false },
      public: { type: "boolean", default: false },
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

  // Decide what to provision before touching anything.
  const local = values.local
  let github = !local && !values["no-github"]
  let vercel = github && !values["no-vercel"]
  if (github && !(hasCommand("gh") && (await isGithubReady(process.cwd())))) {
    p.log.warn(
      "GitHub CLI isn't installed or logged in, skipping GitHub and Vercel."
    )
    github = false
    vercel = false
  }
  if (
    vercel &&
    !(hasCommand("vercel") && (await isVercelReady(process.cwd())))
  ) {
    p.log.warn("Vercel CLI isn't installed or logged in, skipping Vercel.")
    vercel = false
  }

  p.note(
    [
      `Directory   ${root}`,
      `Convex      ${local ? "local deployment (no account)" : "new cloud project with dev + prod deployments"}`,
      `GitHub      ${github ? `new ${values.public ? "public" : "private"} repo` : "skipped"}`,
      `Vercel      ${vercel ? "new project, deploys on every push" : "skipped"}`,
    ].join("\n"),
    "Plan"
  )
  if (!values.yes && !(await ask(p.confirm({ message: "Continue?" })))) {
    p.cancel("Nothing was created.")
    process.exit(0)
  }

  const spinner = p.spinner()
  const todo: string[] = []

  spinner.start("Copying the template")
  await copyTemplate(root, name)
  await run(["git", "init", "--quiet", "--initial-branch=main"], { cwd: root })
  spinner.message("Installing dependencies")
  await run(["bun", "install"], { cwd: root })
  spinner.stop("Project files ready")

  // Convex: create the deployments first, so their URLs are known when
  // asking for credentials (Google needs the redirect URIs).
  let convexProject: Awaited<ReturnType<typeof createCloudProject>> | undefined
  if (local) {
    spinner.start("Starting a local Convex deployment")
    await createLocalDeployment(backendDir)
    spinner.stop("Local Convex deployment ready")
  } else {
    p.log.step("Creating the Convex project")
    convexProject = await createCloudProject(
      backendDir,
      name,
      values.team ?? process.env.CSTACK_CONVEX_TEAM
    )
    p.log.success(`Convex project ${convexProject.projectSlug} created`)
  }
  const devSiteUrl = siteUrlFrom(await readLocalEnv(backendDir))

  const redirectUris = [
    `${devSiteUrl}/oauth/google/callback`,
    ...(vercel && convexProject
      ? [`${convexProject.prodSiteUrl}/oauth/google/callback`]
      : []),
  ]
  const google = await askGoogle(redirectUris, values.yes)
  const resendApiKey = await askResend(values.yes)
  const emailFrom = process.env.CSTACK_EMAIL_FROM

  spinner.start("Configuring the dev deployment")
  await setEnv(
    backendDir,
    await deploymentEnv({
      siteUrl: DEV_SITE_URL,
      google,
      resendApiKey,
      emailFrom,
    }),
    { local }
  )
  spinner.message("Pushing the backend")
  await push(backendDir, { local })
  spinner.stop("Dev deployment configured")

  spinner.start("Creating the first commit")
  await run(["git", "add", "-A"], { cwd: root })
  await run(["git", "commit", "--quiet", "-m", "Initial commit from cstack"], {
    cwd: root,
  })
  spinner.stop("Created the first commit")

  let repo: { nameWithOwner: string; url: string } | undefined
  if (github) {
    spinner.start("Creating the GitHub repo")
    try {
      repo = await createGithubRepo(
        root,
        name,
        values.public ? "public" : "private"
      )
      spinner.stop(`GitHub repo created: ${repo.url}`)
    } catch (error) {
      spinner.error("Could not create the GitHub repo")
      p.log.warn(errorText(error))
      todo.push("Create a GitHub repo, add it as `origin` and push `main`.")
    }
  }

  let siteUrl: string | undefined
  if (vercel && repo && convexProject) {
    spinner.start("Creating a Convex deploy key for production")
    try {
      const convexDeployKey = await createProdDeployKey(backendDir, "vercel")
      spinner.message("Creating the Vercel project")
      const project = await createVercelProject({
        root,
        name,
        repo: repo.nameWithOwner,
        convexDeployKey,
      })
      siteUrl = project.url
      spinner.message("Configuring the production deployment")
      await setEnv(
        backendDir,
        await deploymentEnv({ siteUrl, google, resendApiKey, emailFrom }),
        { prod: true }
      )
      spinner.stop(`Vercel project created: ${project.dashboardUrl}`)
    } catch (error) {
      spinner.error("Could not finish the Vercel setup")
      p.log.warn(errorText(error))
      todo.push(
        "Finish production by hand: create a Vercel project for this repo with root directory `apps/web`, add a Convex production deploy key as CONVEX_DEPLOY_KEY, and set the production Convex env vars (see README)."
      )
    }
  }

  if (repo) {
    spinner.start("Pushing to GitHub")
    try {
      await pushMain(root)
      spinner.stop(
        siteUrl
          ? "Pushed. Vercel is deploying the first build."
          : "Pushed to GitHub"
      )
    } catch (error) {
      spinner.error("Could not push to GitHub")
      p.log.warn(errorText(error))
      todo.push("Push the first commit: `git push -u origin main`.")
    }
  }

  if (!google) {
    todo.push(
      [
        "Set up Google sign-in: create an OAuth client (Web application) at",
        "https://console.cloud.google.com/apis/credentials with these redirect URIs:",
        ...redirectUris.map((uri) => `  ${uri}`),
        "then set AUTH_GOOGLE_CLIENT_ID and AUTH_GOOGLE_CLIENT_SECRET with",
        "`bunx convex env set` in packages/backend (add --prod for production).",
      ].join("\n")
    )
  }

  p.note(
    [
      `cd ${relative(process.cwd(), root) || "."}`,
      "bun dev",
      "",
      `App        ${DEV_SITE_URL}`,
      ...(convexProject ? [`Convex     ${convexProject.dashboardUrl}`] : []),
      ...(repo ? [`GitHub     ${repo.url}`] : []),
      ...(siteUrl ? [`Live       ${siteUrl}`] : []),
    ].join("\n"),
    "Next steps"
  )
  if (google) {
    p.log.info(
      `Make sure your Google OAuth client lists these redirect URIs:\n${redirectUris.join("\n")}`
    )
  }
  for (const item of todo) p.log.warn(item)
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
  if (site) return site
  const url = env.VITE_CONVEX_URL ?? env.CONVEX_URL
  if (!url) fail("Convex didn't write a deployment URL to .env.local")
  return url.replace(/\.convex\.cloud$/, ".convex.site")
}

async function askGoogle(redirectUris: string[], yes: boolean) {
  const clientId = process.env.CSTACK_GOOGLE_CLIENT_ID
  const clientSecret = process.env.CSTACK_GOOGLE_CLIENT_SECRET
  if (clientId && clientSecret) return { clientId, clientSecret }
  if (yes) return undefined

  p.note(
    [
      "Google is the only sign-in method. Create an OAuth client",
      "(type: Web application) at",
      "https://console.cloud.google.com/apis/credentials",
      "and add these authorized redirect URIs:",
      ...redirectUris.map((uri) => `  ${uri}`),
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

async function askResend(yes: boolean) {
  const key = process.env.CSTACK_RESEND_API_KEY
  if (key || yes) return key
  const answer = await ask(
    p.password({
      message: "Resend API key (leave empty to log emails instead of sending)",
    })
  )
  return answer.trim() || undefined
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
