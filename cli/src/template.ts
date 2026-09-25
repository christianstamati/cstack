import { existsSync } from "node:fs"
import { chmod, mkdir, readFile, stat, writeFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { run } from "./exec"

/**
 * The template: the cstack repo this CLI lives in. That's either a local
 * checkout or the copy `bunx github:christianstamati/cstack` downloaded.
 */
export const TEMPLATE_ROOT = resolve(import.meta.dir, "../..")

/** The name used throughout the template, replaced by the project name. */
const TEMPLATE_NAME = "cstack"

/** Template-only files that never go into a generated project. */
const EXCLUDED = [
  /^cli\//,
  /^README\.md$/,
  /^\.bun-tag$/,
  /(^|\/)node_modules\//,
  /(^|\/)\.git\//,
]

/** Only the template repo uses these; generated projects drop them. */
const CLI_DEPENDENCIES = ["@clack/prompts"]

/**
 * Copies the template into `dest`, with the template name replaced by the
 * project name.
 */
export async function copyTemplate(dest: string, name: string) {
  const files = (await templateFiles()).filter(
    (file) => !EXCLUDED.some((pattern) => pattern.test(file))
  )

  for (const file of files) {
    const source = join(TEMPLATE_ROOT, file)
    const info = await stat(source).catch(() => null)
    if (!info?.isFile()) continue // deleted in the working tree

    const target = join(dest, file)
    await mkdir(dirname(target), { recursive: true })
    const bytes = await readFile(source)
    await writeFile(target, isText(bytes) ? rename(bytes, name) : bytes)
    await chmod(target, info.mode)
  }

  await finalizePackageJson(dest)
  await writeReadme(dest, name)
}

/**
 * In a local checkout, every file git tracks or would track, so ignored files
 * like node_modules and .env.local are skipped. A downloaded copy has no git
 * history, but it holds exactly the committed files.
 */
async function templateFiles() {
  if (existsSync(join(TEMPLATE_ROOT, ".git"))) {
    const { stdout } = await run(
      ["git", "ls-files", "-z", "--cached", "--others", "--exclude-standard"],
      { cwd: TEMPLATE_ROOT }
    )
    return stdout.split("\0").filter(Boolean)
  }
  return Array.fromAsync(
    new Bun.Glob("**/*").scan({ cwd: TEMPLATE_ROOT, dot: true })
  )
}

function isText(bytes: Buffer) {
  return !bytes.subarray(0, 8000).includes(0)
}

function rename(bytes: Buffer, name: string) {
  return bytes.toString("utf8").replaceAll(TEMPLATE_NAME, name)
}

/** Removes what only the template repo needs: the CLI and its dependency. */
async function finalizePackageJson(dest: string) {
  const path = join(dest, "package.json")
  const pkg = JSON.parse(await readFile(path, "utf8"))
  pkg.workspaces = pkg.workspaces.filter((ws: string) => ws !== "cli")
  delete pkg.bin
  for (const dependency of CLI_DEPENDENCIES) {
    delete pkg.dependencies?.[dependency]
  }
  if (pkg.dependencies && Object.keys(pkg.dependencies).length === 0) {
    delete pkg.dependencies
  }
  await writeFile(path, `${JSON.stringify(pkg, null, 2)}\n`)
}

async function writeReadme(dest: string, name: string) {
  const template = await readFile(
    join(TEMPLATE_ROOT, "cli/template/README.md"),
    "utf8"
  )
  await writeFile(
    join(dest, "README.md"),
    template.replaceAll("{{name}}", name)
  )
}
