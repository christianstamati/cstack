// Town mode: serve the page, open it, run the agent against the MCP server.
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
  if (options.askEverything) {
    console.log("The agent will ask before every command.");
  } else if (launch.allowed.length > 0) {
    console.log(
      `Allowed without asking in this session: ${launch.allowed.join(", ")}. Anything else asks in this terminal.`,
    );
    if (launch.allowed.some((entry) => entry.startsWith("npx") || entry.startsWith("bunx"))) {
      console.log("npx and bunx let the agent download and run npm packages without asking.");
    }
  }
  if (options.open && !(await openBrowser(server.url))) {
    console.log("Couldn't open a browser. Open the URL above.");
  }

  let closing: Promise<void> | undefined;
  const closeServer = () => (closing ??= server.close());
  const onSignal = () => void closeServer();
  process.once("SIGINT", onSignal);
  process.once("SIGTERM", onSignal);
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
    });
  } finally {
    process.off("SIGINT", onSignal);
    process.off("SIGTERM", onSignal);
    store.agentStopped();
    await closeServer();
  }
}
