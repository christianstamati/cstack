// Town mode: serve the page, open it, run the agent against the MCP server.
import type { ChildProcess } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { runAgent, type Agent } from "../agent.ts";
import type { CliOptions } from "../args.ts";
import { townLaunch } from "./launch.ts";
import { createMcpHandler } from "./mcp.ts";
import { openBrowser } from "./open-browser.ts";
import { startTownServer } from "./server.ts";
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

export async function runTown(input: {
  options: CliOptions;
  projectDir: string;
  projectName: string;
  agent: Agent;
  launchPrompt: string;
}): Promise<number> {
  const { options } = input;
  const store = new TownStore(input.projectName);
  const server = await startTownServer({
    store,
    uiDir: resolveUiDir(),
    mcp: createMcpHandler(store),
  });
  const launch = townLaunch(input.agent.id, {
    mcpUrl: server.mcpUrl,
    askEverything: options.askEverything,
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
      args: [
        ...launch.args,
        ...(options.model === undefined ? [] : ["--model", options.model]),
        ...options.agentArgs,
        input.launchPrompt,
      ],
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
