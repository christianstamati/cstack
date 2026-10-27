#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

import { AGENTS, ask, pickAgent, runAgent, type Agent } from "./agent.ts";
import { isValidProjectName, parseCliArgs, USAGE, UsageError, type CliOptions } from "./args.ts";
import { describeOs, detectTools, formatTools } from "./machine.ts";
import {
  BOOTSTRAP_PATH,
  CONFIG_PATH,
  defaultConfig,
  fillBootstrapPrompt,
  LAUNCH_PROMPT,
} from "./prompt.ts";

// Files an OS drops into folders on its own; a folder holding only these is empty.
const IGNORED_ENTRIES = new Set([".DS_Store", "Thumbs.db"]);

class CliError extends Error {}

async function main(argv: ReadonlyArray<string>): Promise<number> {
  const options = parseCliArgs(argv);
  if (options.help) {
    console.log(USAGE);
    return 0;
  }

  const interactive = process.stdin.isTTY === true && process.stdout.isTTY === true;

  let dir = options.dir;
  if (dir === undefined) {
    if (!interactive) {
      throw new UsageError("Pass the project directory, e.g. create-cs-stack my-app");
    }
    dir = (await ask("Project name (my-app): ")) || "my-app";
  }
  const projectDir = resolve(dir);
  const projectName = basename(projectDir);
  if (!isValidProjectName(projectName)) {
    throw new CliError(`"${projectName}" isn't a valid project name. Use kebab-case, e.g. my-app.`);
  }
  assertEmptyOrMissing(projectDir);

  const presetConfig = loadPresetConfig(options, projectName);

  const tools = detectTools();
  const installed = AGENTS.filter((agent) => tools[agent.id] !== null);
  const agent = await chooseAgent(options, installed, interactive);

  mkdirSync(join(projectDir, ".cs-stack"), { recursive: true });
  const promptPath = join(projectDir, BOOTSTRAP_PATH);
  writeFileSync(
    promptPath,
    fillBootstrapPrompt({
      projectDir,
      projectName,
      agent: agent?.label ?? "unknown (pasted by hand)",
      os: describeOs(),
      nodeVersion: tools.node ?? "not installed",
      tools: formatTools(tools),
    }),
  );
  if (presetConfig !== undefined) {
    writeFileSync(join(projectDir, CONFIG_PATH), `${JSON.stringify(presetConfig, null, 2)}\n`);
  }

  if (agent === undefined) {
    console.log(
      [
        "No supported agent CLI (claude, codex) was found on this machine.",
        "",
        "The bootstrap prompt was written to:",
        `  ${promptPath}`,
        "",
        `Open an agent in ${projectDir} and paste that file into it.`,
      ].join("\n"),
    );
    return 0;
  }

  console.log(`Created ${projectDir}. Starting ${agent.label}…\n`);
  return runAgent({
    command: agent.id,
    args: [
      ...(options.model === undefined ? [] : ["--model", options.model]),
      ...options.agentArgs,
      LAUNCH_PROMPT,
    ],
    cwd: projectDir,
  });
}

function assertEmptyOrMissing(projectDir: string): void {
  if (!existsSync(projectDir)) {
    if (!existsSync(dirname(projectDir))) {
      throw new CliError(`The parent folder ${dirname(projectDir)} doesn't exist.`);
    }
    return;
  }
  if (!statSync(projectDir).isDirectory()) {
    throw new CliError(`${projectDir} exists and isn't a folder.`);
  }
  const entries = readdirSync(projectDir).filter((entry) => !IGNORED_ENTRIES.has(entry));
  if (entries.length > 0) {
    throw new CliError(`${projectDir} isn't empty. Pick a new folder name.`);
  }
}

function loadPresetConfig(options: CliOptions, projectName: string): unknown {
  if (options.defaults) {
    return defaultConfig(projectName);
  }
  if (options.config === undefined) {
    return undefined;
  }
  const configPath = resolve(options.config);
  let config: unknown;
  try {
    config = JSON.parse(readFileSync(configPath, "utf8"));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new CliError(`Couldn't read ${configPath} as JSON: ${reason}`);
  }
  if (typeof config !== "object" || config === null || Array.isArray(config)) {
    throw new CliError(`${configPath} must contain a JSON object.`);
  }
  // The folder decides the default name; the agent validates the rest.
  return { ...config, name: projectName };
}

async function chooseAgent(
  options: CliOptions,
  installed: ReadonlyArray<Agent>,
  interactive: boolean,
): Promise<Agent | undefined> {
  if (options.agent !== undefined) {
    const requested = installed.find((agent) => agent.id === options.agent);
    if (requested === undefined) {
      throw new CliError(`\`${options.agent}\` is not installed or was not found on PATH.`);
    }
    return requested;
  }
  if (installed.length <= 1) {
    return installed[0];
  }
  // With stdout redirected the menu is invisible and the command would hang on it.
  if (!interactive) {
    throw new CliError(
      "Both claude and codex are installed and there is no terminal to ask which to use. Re-run with --agent claude or --agent codex.",
    );
  }
  return pickAgent(installed);
}

try {
  process.exitCode = await main(process.argv.slice(2));
} catch (error) {
  if (error instanceof UsageError) {
    console.error(`${error.message}\n\n${USAGE}`);
    process.exitCode = 2;
  } else if (error instanceof CliError) {
    console.error(error.message);
    process.exitCode = 1;
  } else {
    throw error;
  }
}
