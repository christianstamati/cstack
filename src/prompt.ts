import { BOOTSTRAP_PROMPT } from "./bootstrap-prompt.ts";

export interface PromptFacts {
  readonly projectDir: string;
  readonly projectName: string;
  readonly agent: string;
  readonly os: string;
  readonly nodeVersion: string;
  readonly tools: string;
}

// Where the CLI writes the filled prompt, relative to the project folder.
export const BOOTSTRAP_PATH = ".cstack/BOOTSTRAP.md";
export const CONFIG_PATH = ".cstack/config.json";

// The agent gets a one-line pointer instead of the whole prompt: Windows `.cmd` shims
// run through cmd.exe, which can't carry a multiline argument, and with no agent
// installed the file is what the user pastes by hand.
export const LAUNCH_PROMPT = `Read the file "${BOOTSTRAP_PATH}" and follow it exactly: it is your cstack bootstrap prompt.`;

export function fillBootstrapPrompt(facts: PromptFacts): string {
  const values: Record<string, string> = {
    PROJECT_DIR: facts.projectDir,
    PROJECT_NAME: facts.projectName,
    AGENT: facts.agent,
    OS: facts.os,
    NODE_VERSION: facts.nodeVersion,
    TOOLS: facts.tools,
  };
  const filled = BOOTSTRAP_PROMPT.replaceAll(/\{\{([A-Z_]+)\}\}/g, (match, key: string) => {
    const value = values[key];
    if (value === undefined) {
      throw new Error(`Unknown placeholder ${match} in the bootstrap prompt.`);
    }
    return value;
  });
  return filled;
}

// Matches the "cstack defaults" section of the prompt; `--defaults` writes it.
export function defaultConfig(name: string) {
  return {
    name,
    structure: "monorepo",
    toolchain: "vite-plus",
    packageManager: "bun",
    frontend: "tanstack-start",
    data: "convex",
    api: null,
    database: null,
    deploy: "vercel",
    dbHost: null,
    auth: "convex-auth-v2",
    authMethods: ["google"],
    ui: { library: "shadcn", base: "base-ui", preset: null },
    extras: ["example", "ci", "tests", "agent-docs"],
  };
}
