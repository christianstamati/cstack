import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "vite-plus/test";

import { BOOTSTRAP_PROMPT } from "../src/bootstrap-prompt.ts";
import { defaultConfig, fillBootstrapPrompt } from "../src/prompt.ts";

const facts = {
  projectDir: "/tmp/my-app",
  projectName: "my-app",
  agent: "Claude Code",
  os: "darwin arm64 (25.0.0)",
  nodeVersion: "v24.0.0",
  tools: "- git: git version 2.50.0",
};

test("the embedded prompt matches .github/BOOTSTRAP.md byte for byte", () => {
  const markdown = readFileSync(join(import.meta.dirname, "../.github/BOOTSTRAP.md"), "utf8");
  // On failure: edit the Markdown file, then run `bun run sync-prompt`.
  expect(BOOTSTRAP_PROMPT).toBe(markdown);
});

test("filling the prompt replaces every placeholder", () => {
  const filled = fillBootstrapPrompt(facts);
  expect(filled).not.toMatch(/\{\{[A-Z_]+\}\}/);
  expect(filled).toContain("inside `/tmp/my-app`");
  expect(filled).toContain("Default: `my-app`");
  expect(filled).toContain("- git: git version 2.50.0");
});

test("the defaults in the prompt match what --defaults writes", () => {
  const filled = fillBootstrapPrompt(facts);
  const section = filled.split("## cstack defaults")[1] ?? "";
  const json = /```json\n([\s\S]*?)\n```/.exec(section)?.[1];
  expect(json).toBeDefined();
  expect(JSON.parse(json ?? "")).toEqual(defaultConfig("my-app"));
});
