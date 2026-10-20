// Town mode: serve the page, open it, run the agent against the MCP server.
import type { ChildProcess } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { agentCommandLine, runAgent, type Agent } from "../agent.ts";
import type { CliOptions } from "../args.ts";
import { CliError } from "../errors.ts";
import { townLaunch } from "./launch.ts";
import { createMcpHandler } from "./mcp.ts";
import { openBrowser } from "./open-browser.ts";
import { startTownServer, type TownServer } from "./server.ts";
import { TownStore } from "./store.ts";

const PACKAGE_NAME = "@cstack-dev/town";

/** Nearest ancestor of `from` whose package.json names this package. */
export function findPackageRoot(from: string): string {
  let dir = from;
  for (;;) {
    const manifest = join(dir, "package.json");
    if (existsSync(manifest)) {
      try {
        if (
          (JSON.parse(readFileSync(manifest, "utf8")) as { name?: unknown }).name === PACKAGE_NAME
        ) {
          return dir;
        }
      } catch {
        // Unreadable manifest: keep walking.
      }
    }
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error(`Couldn't find the ${PACKAGE_NAME} package root above ${from}.`);
    }
    dir = parent;
  }
}

export function resolveUiDir(): string {
  return join(findPackageRoot(dirname(fileURLToPath(import.meta.url))), "dist", "ui");
}

/** Starts the town's server. A failure (no built page, no port) becomes a plain error that
 * says how to go on without the town, instead of a stack trace. */
export async function openTown(
  store: TownStore,
  uiDir: () => string = resolveUiDir,
  start: typeof startTownServer = startTownServer,
): Promise<TownServer> {
  try {
    return await start({ store, uiDir: uiDir(), mcp: createMcpHandler(store) });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new CliError(
      `Couldn't start the town: ${reason}\nRun the same command with --terminal to use the text interview instead.`,
    );
  }
}

export async function runTown(input: {
  options: CliOptions;
  projectDir: string;
  projectName: string;
  agent: Agent;
  launchPrompt: string;
}): Promise<number> {
  const { options } = input;
  const store = new TownStore(input.projectName);
  const server = await openTown(store);
  const launch = townLaunch(input.agent.id, {
    mcpUrl: server.mcpUrl,
    askEverything: options.askEverything,
    agentArgs: options.agentArgs,
  });

  console.log(`Your town: ${server.url}`);
  for (const line of launch.summary) {
    console.log(line);
  }
  if (options.open && !(await openBrowser(server.url))) {
    console.log("Couldn't open a browser. Open the URL above.");
  }

  // Ctrl-C reaches the whole foreground process group; the agent decides what it
  // means (it cancels a turn), so the CLI only keeps itself alive and cleans up
  // after the agent exits. SIGTERM/SIGHUP are forwarded so `kill <cli>` ends the agent.
  let child: ChildProcess | undefined;
  const ignore = () => {};
  const forward = (signal: NodeJS.Signals) => () => {
    child?.kill(signal);
  };
  const onTerm = forward("SIGTERM");
  const onHup = forward("SIGHUP");
  process.on("SIGINT", ignore);
  process.on("SIGTERM", onTerm);
  process.on("SIGHUP", onHup);
  try {
    return await runAgent({
      command: input.agent.id,
      args: agentCommandLine({
        launchArgs: launch.args,
        model: options.model,
        agentArgs: options.agentArgs,
        prompt: input.launchPrompt,
      }),
      env: launch.env,
      cwd: input.projectDir,
      onSpawn: (spawned) => {
        child = spawned;
      },
    });
  } finally {
    process.off("SIGINT", ignore);
    process.off("SIGTERM", onTerm);
    process.off("SIGHUP", onHup);
    store.agentStopped();
    await server.close();
  }
}
