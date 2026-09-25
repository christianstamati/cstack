import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { run } from "./exec"
import { TEMPLATE_ROOT } from "./template"

const REPO = "christianstamati/cstack"

/**
 * `bunx github:christianstamati/cstack` downloads a commit once and reuses it
 * on every later run, even after main moves on. When this copy came from bunx
 * without a pinned ref and is behind main, run the latest commit instead.
 */
export async function runLatestIfStale() {
  if (process.env.CSTACK_SKIP_UPDATE) return

  // Bun writes `<owner>-<repo>-<short sha>` here for GitHub downloads. A local
  // checkout has no such file.
  const tagFile = join(TEMPLATE_ROOT, ".bun-tag")
  if (!existsSync(tagFile)) return
  if (await isPinned()) return

  const current = (await readFile(tagFile, "utf8")).trim().split("-").at(-1)
  const latest = await latestCommit()
  if (!current || !latest || latest.startsWith(current)) return

  console.error(`Updating to the latest cstack (${latest.slice(0, 7)})…`)
  const proc = Bun.spawn(
    ["bunx", `github:${REPO}#${latest}`, ...process.argv.slice(2)],
    {
      stdio: ["inherit", "inherit", "inherit"],
      env: { ...process.env, CSTACK_SKIP_UPDATE: "1" },
    }
  )
  process.exit(await proc.exited)
}

/**
 * Whether bunx was asked for a specific ref, like `github:…#v1.0.0`. bunx
 * installs into `<tmp>/bunx-…/node_modules/cstack`, next to a package.json
 * that names what was requested.
 */
async function isPinned() {
  const manifest = join(TEMPLATE_ROOT, "../../package.json")
  if (!existsSync(manifest)) return true // unknown layout: leave it alone
  const { dependencies } = JSON.parse(await readFile(manifest, "utf8"))
  const spec = dependencies?.cstack
  return typeof spec !== "string" || spec.includes("#")
}

async function latestCommit() {
  try {
    const { stdout } = await run(
      ["git", "ls-remote", `https://github.com/${REPO}`, "HEAD"],
      { cwd: process.cwd(), env: { GIT_TERMINAL_PROMPT: "0" } }
    )
    return stdout.split("\t")[0] || undefined
  } catch {
    return undefined // offline: this copy will do
  }
}
