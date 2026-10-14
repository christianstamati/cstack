import { existsSync } from "node:fs"
import { chmod, mkdir, readFile, stat, writeFile } from "node:fs/promises"
import { basename, dirname, extname, join, resolve } from "node:path"

import { run } from "./exec"
import { matches, recipe, type Stack } from "./stack"

/**
 * The template: the cstack repo this CLI lives in. That's either a local
 * checkout or the copy `bunx github:christianstamati/cstack` downloaded.
 */
export const TEMPLATE_ROOT = resolve(import.meta.dirname, "../..")

/** Files that replace or add to parts of the template for other stacks. */
const VARIANTS = "cli/template/variants"

/** The name used throughout the template, replaced by the project name. */
const TEMPLATE_NAME = "cstack"

/** Template-only files that never go into a generated project. */
const EXCLUDED = [
  /^cli\//,
  /^README\.md$/,
  /^\.github\/workflows\/templates\.yml$/,
  /^\.bun-tag$/,
  /(^|\/)node_modules\//,
  /(^|\/)\.git\//,
]

/** Only the template repo uses these; generated projects drop them. */
const CLI_DEPENDENCIES = ["@clack/prompts"]

/**
 * Copies the template into `dest` as `stack`, with the template name replaced
 * by the project name.
 */
export async function copyTemplate(
  dest: string,
  name: string,
  stack: Stack,
  root = TEMPLATE_ROOT
) {
  const { remove, keep, packages, overlays } = recipe(stack)
  const under = (file: string, paths: string[]) =>
    paths.some((path) => file === path || file.startsWith(path))

  const files = (await templateFiles(root)).filter(
    (file) =>
      !EXCLUDED.some((pattern) => pattern.test(file)) &&
      (!under(file, remove) || under(file, keep))
  )
  for (const file of files) {
    await copyFile(join(root, file), join(dest, file), name, stack)
  }

  for (const overlay of overlays) {
    const variant = join(root, VARIANTS, overlay)
    for (const file of await listFiles(variant)) {
      const target = join(dest, file)
      if (basename(file) === "package.json") {
        await writePackageJson(target, join(variant, file), name, root)
      } else {
        await copyFile(join(variant, file), target, name, stack)
      }
    }
  }

  for (const [file, edit] of Object.entries(packages)) {
    await editJson(join(dest, file), (pkg) => {
      for (const dependency of edit.dropDependencies ?? []) {
        delete pkg.dependencies?.[dependency]
        delete pkg.devDependencies?.[dependency]
      }
      for (const [script, command] of Object.entries(edit.scripts ?? {})) {
        if (command === null) delete pkg.scripts[script]
        else pkg.scripts[script] = command
      }
    })
  }

  await finalizePackageJson(dest)
  await writeReadme(dest, name, stack, root)
}

async function copyFile(
  source: string,
  target: string,
  name: string,
  stack: Stack
) {
  const info = await stat(source).catch(() => null)
  if (!info?.isFile()) return // deleted in the working tree

  await mkdir(dirname(target), { recursive: true })
  const bytes = await readFile(source)
  if (!isText(bytes)) {
    await writeFile(target, bytes)
  } else {
    // Conditionals first: renaming would rewrite their `cstack:` markers.
    const text = bytes.toString("utf8")
    const rendered =
      extname(target) === ".md" ? renderConditionals(text, stack) : text
    await writeFile(target, rename(rendered, name))
  }
  await chmod(target, info.mode)
}

/**
 * A variant's package.json adds to (and overrides) the one it lands on. A
 * dependency version of `"repo"` takes the version this repo's web app uses,
 * so both frontends stay on the same releases.
 */
async function writePackageJson(
  target: string,
  source: string,
  name: string,
  root: string
) {
  const extra = JSON.parse(rename(await readFile(source, "utf8"), name))
  const repoWeb = JSON.parse(
    await readFile(join(root, "apps/web/package.json"), "utf8")
  )
  for (const field of ["dependencies", "devDependencies"]) {
    for (const [dependency, version] of Object.entries(extra[field] ?? {})) {
      if (version !== "repo") continue
      const resolved =
        repoWeb.dependencies?.[dependency] ??
        repoWeb.devDependencies?.[dependency]
      if (!resolved) {
        throw new Error(`apps/web/package.json has no ${dependency}`)
      }
      extra[field][dependency] = resolved
    }
  }

  if (!existsSync(target)) {
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, "{}")
  }
  await editJson(target, (pkg) => {
    for (const [key, value] of Object.entries(extra)) {
      pkg[key] =
        value && typeof value === "object" && !Array.isArray(value)
          ? { ...pkg[key], ...value }
          : value
    }
  })
}

type Json = Record<string, any>

async function editJson(path: string, edit: (json: Json) => void) {
  const json = JSON.parse(await readFile(path, "utf8"))
  edit(json)
  await writeFile(path, `${JSON.stringify(json, null, 2)}\n`)
}

/**
 * Keeps the `<!-- cstack:if name=value -->` … `<!-- cstack:end -->` blocks
 * that apply to `stack` (without their marker lines) and drops the rest.
 * `name!=value` negates. Blocks can nest.
 */
export function renderConditionals(text: string, stack: Stack) {
  const open = /^\s*<!-- cstack:if (\w+)(!?=)([\w-]+) -->\s*$/
  const close = /^\s*<!-- cstack:end -->\s*$/
  const active: boolean[] = []
  const lines: string[] = []

  for (const line of text.split("\n")) {
    const opened = line.match(open)
    if (opened) {
      const [, key, op, value] = opened
      const hit = matches(stack, `${key}=${value}`)
      active.push(op === "=" ? hit : !hit)
    } else if (close.test(line)) {
      if (active.pop() === undefined) throw new Error("Unmatched cstack:end")
    } else if (active.every(Boolean)) {
      lines.push(line)
    }
  }
  if (active.length > 0) throw new Error("Unclosed cstack:if block")
  // Removed blocks leave runs of blank lines behind.
  return lines.join("\n").replace(/\n{3,}/g, "\n\n")
}

/**
 * In a local checkout, every file git tracks or would track, so ignored files
 * like node_modules and .env.local are skipped. A downloaded copy has no git
 * history, but it holds exactly the committed files.
 */
export async function templateFiles(root: string) {
  if (existsSync(join(root, ".git"))) {
    const { stdout } = await run(
      ["git", "ls-files", "-z", "--cached", "--others", "--exclude-standard"],
      { cwd: root }
    )
    return stdout.split("\0").filter(Boolean)
  }
  return listFiles(root)
}

/**
 * Every file under `root`, as `/`-separated paths like git prints them. On
 * Windows, Bun.Glob returns `\`-separated ones, which no rule here matches.
 */
export async function listFiles(root: string) {
  const files = await Array.fromAsync(
    new Bun.Glob("**/*").scan({ cwd: root, dot: true })
  )
  return files.map((file) => file.replaceAll("\\", "/"))
}

function isText(bytes: Buffer) {
  return !bytes.subarray(0, 8000).includes(0)
}

function rename(text: string, name: string) {
  return text.replaceAll(TEMPLATE_NAME, name)
}

/** Removes what only the template repo needs: the CLI and its dependency. */
async function finalizePackageJson(dest: string) {
  await editJson(join(dest, "package.json"), (pkg) => {
    pkg.workspaces = pkg.workspaces.filter((ws: string) => ws !== "cli")
    delete pkg.bin
    for (const dependency of CLI_DEPENDENCIES) {
      delete pkg.dependencies?.[dependency]
    }
    if (pkg.dependencies && Object.keys(pkg.dependencies).length === 0) {
      delete pkg.dependencies
    }
  })
}

async function writeReadme(
  dest: string,
  name: string,
  stack: Stack,
  root: string
) {
  const template = await readFile(join(root, "cli/template/README.md"), "utf8")
  await writeFile(
    join(dest, "README.md"),
    renderConditionals(template.replaceAll("{{name}}", name), stack)
  )
}
