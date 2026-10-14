import { describe, expect, test } from "bun:test"
import { existsSync } from "node:fs"
import { mkdtemp, readFile, rm } from "node:fs/promises"
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
import { copyTemplate, renderConditionals, TEMPLATE_ROOT } from "./template"

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
