import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "vite-plus/test";

import { fillBootstrapPrompt } from "../src/prompt.ts";
import { TOWN_PROMPT } from "../src/town-prompt.ts";
import { SLOTS } from "../src/town/catalog.ts";

const facts = {
  projectDir: "/tmp/my-app",
  projectName: "my-app",
  agent: "Claude Code",
  os: "darwin arm64 (25.0.0)",
  nodeVersion: "v24.0.0",
  tools: "- git: git version 2.50.0",
};

test("TOWN.md is embedded byte for byte", () => {
  // On failure: edit .github/TOWN.md, then run `bun run sync-prompt`.
  expect(TOWN_PROMPT).toBe(readFileSync(join(import.meta.dirname, "../.github/TOWN.md"), "utf8"));
});

test("TOWN.md names every slot and option id in the catalog", () => {
  for (const slot of SLOTS) {
    expect(TOWN_PROMPT).toContain(`\`${slot.id}\``);
    for (const option of slot.options) expect(TOWN_PROMPT).toContain(`\`${option.id}\``);
  }
});

test("town mode appends the section; terminal mode doesn't", () => {
  expect(fillBootstrapPrompt(facts, { town: true })).toContain(TOWN_PROMPT);
  expect(fillBootstrapPrompt(facts)).not.toContain("# Town mode");
});

test("catalog lots are unique", () => {
  const lots = SLOTS.map((s) => s.lot.join(","));
  expect(new Set(lots).size).toBe(lots.length);
});
