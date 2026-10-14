import { describe, expect, test } from "bun:test"
import { existsSync } from "node:fs"
import { cp, mkdir, mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import {
  BACKENDS,
  type Backend,
  FRONTENDS,
  type Frontend,
  recipe,
  type Stack,
} from "./stack"
import {
  copyTemplate,
  renderConditionals,
  TEMPLATE_ROOT,
  templateFiles,
} from "./template"

const STACKS: Stack[] = (Object.keys(FRONTENDS) as Frontend[]).flatMap(
  (frontend) =>
    (Object.keys(BACKENDS) as Backend[]).map((backend) => ({
      frontend,
      backend,
    }))
)

describe("recipe", () => {
  // A renamed file would otherwise silently end up in (or missing from)
  // generated projects.
  test.each(STACKS)("names files that exist: %o", (stack) => {
    const { remove, keep, packages, overlays } = recipe(stack)
    for (const path of [...remove, ...keep, ...Object.keys(packages)]) {
      expect(existsSync(join(TEMPLATE_ROOT, path)), path).toBe(true)
    }
    for (const overlay of overlays) {
      const dir = join(TEMPLATE_ROOT, "cli/template/variants", overlay)
      expect(existsSync(dir), overlay).toBe(true)
    }
  })
})

describe("copyTemplate", () => {
  test.each(STACKS)("renders every conditional block: %o", async (stack) => {
    const dest = await mkdtemp(join(tmpdir(), "cstack-test-"))
    try {
      await copyTemplate(dest, "my-app", stack)
      for (const file of ["CLAUDE.md", "README.md"]) {
        const text = await readFile(join(dest, file), "utf8")
        expect(text, file).not.toMatch(/<!-- [\w-]+:(if|end)/)
        expect(text, file).not.toContain("cstack:")
      }
      const pkg = JSON.parse(await readFile(join(dest, "package.json"), "utf8"))
      expect(pkg.name).toBe("my-app")
    } finally {
      await rm(dest, { recursive: true, force: true })
    }
  })
})

// `bunx github:…` downloads the repo without .git, so the file list comes from
// a glob instead of git. On Windows that glob returns `\` paths.
describe("a downloaded template", () => {
  test("lists the same files as git, with / separators", async () => {
    const download = await downloadCopy()
    try {
      const fromGit = await templateFiles(TEMPLATE_ROOT)
      const fromDisk = await templateFiles(download)
      expect(fromDisk.toSorted()).toEqual(fromGit.toSorted())
    } finally {
      await rm(download, { recursive: true, force: true })
    }
  })

  test("generates the same project as a checkout", async () => {
    const download = await downloadCopy()
    const dest = await mkdtemp(join(tmpdir(), "cstack-test-"))
    try {
      const stack: Stack = { frontend: "tanstack-start", backend: "none" }
      await copyTemplate(dest, "my-app", stack, download)
      expect(existsSync(join(dest, "cli"))).toBe(false)
      expect(existsSync(join(dest, "packages/backend"))).toBe(false)
      expect(existsSync(join(dest, "apps/web/src/components/auth"))).toBe(false)
    } finally {
      await rm(download, { recursive: true, force: true })
      await rm(dest, { recursive: true, force: true })
    }
  })
})

/** A copy of the template's files without .git, like bunx downloads. */
async function downloadCopy() {
  const download = await mkdtemp(join(tmpdir(), "cstack-download-"))
  for (const file of await templateFiles(TEMPLATE_ROOT)) {
    if (!existsSync(join(TEMPLATE_ROOT, file))) continue // deleted locally
    await mkdir(join(download, file, ".."), { recursive: true })
    await cp(join(TEMPLATE_ROOT, file), join(download, file))
  }
  return download
}

describe("renderConditionals", () => {
  const stack: Stack = { frontend: "nextjs", backend: "none" }

  test("keeps matching blocks without their markers", () => {
    const text = [
      "a",
      "<!-- cstack:if frontend=nextjs -->",
      "next",
      "<!-- cstack:end -->",
      "<!-- cstack:if frontend=tanstack-start -->",
      "tanstack",
      "<!-- cstack:end -->",
      "b",
    ].join("\n")
    expect(renderConditionals(text, stack)).toBe("a\nnext\nb")
  })

  test("supports negation and nesting", () => {
    const text = [
      "<!-- cstack:if backend!=convex -->",
      "<!-- cstack:if frontend=nextjs -->",
      "kept",
      "<!-- cstack:end -->",
      "<!-- cstack:if frontend=tanstack-start -->",
      "dropped",
      "<!-- cstack:end -->",
      "<!-- cstack:end -->",
    ].join("\n")
    expect(renderConditionals(text, stack)).toBe("kept")
  })

  test("drops repo-only text", () => {
    const text = "<!-- cstack:if repo=true -->\nrepo\n<!-- cstack:end -->\nx"
    expect(renderConditionals(text, stack)).toBe("x")
  })

  test("collapses the blank lines removed blocks leave", () => {
    const text =
      "a\n\n<!-- cstack:if backend=convex -->\nc\n<!-- cstack:end -->\n\nb"
    expect(renderConditionals(text, stack)).toBe("a\n\nb")
  })

  test("rejects unbalanced markers", () => {
    expect(() =>
      renderConditionals("<!-- cstack:if backend=none -->", stack)
    ).toThrow("Unclosed")
    expect(() => renderConditionals("<!-- cstack:end -->", stack)).toThrow(
      "Unmatched"
    )
  })
})
