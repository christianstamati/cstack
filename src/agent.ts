import { spawn } from "node:child_process";
import { platform } from "node:os";
import { createInterface } from "node:readline/promises";

import type { AgentId } from "./args.ts";

export interface Agent {
  readonly id: AgentId;
  readonly label: string;
}

export const AGENTS: ReadonlyArray<Agent> = [
  { id: "claude", label: "Claude Code" },
  { id: "codex", label: "Codex" },
];

export async function pickAgent(agents: ReadonlyArray<Agent>): Promise<Agent> {
  const readline = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const menu = agents.map((agent, index) => `  [${index + 1}] ${agent.label}`).join("\n");
    for (;;) {
      const answer = (await readline.question(`Bootstrap with:\n${menu}\n> `)).trim();
      const byNumber = agents[Number.parseInt(answer, 10) - 1];
      if (byNumber !== undefined) {
        return byNumber;
      }
      const byId = agents.find((agent) => agent.id === answer.toLowerCase());
      if (byId !== undefined) {
        return byId;
      }
    }
  } finally {
    readline.close();
  }
}

export async function ask(question: string): Promise<string> {
  const readline = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await readline.question(question)).trim();
  } finally {
    readline.close();
  }
}

const isWindows = platform() === "win32";

// cmd.exe splits unquoted arguments on spaces; the agent CLIs are `.cmd` shims there.
function quoteForCmd(arg: string): string {
  return /[\s"]/.test(arg) ? `"${arg.replaceAll('"', '""')}"` : arg;
}

export function runAgent(input: {
  readonly command: string;
  readonly args: ReadonlyArray<string>;
  readonly cwd: string;
}): Promise<number> {
  return new Promise((resolve, reject) => {
    const args = isWindows ? input.args.map(quoteForCmd) : [...input.args];
    const child = spawn(input.command, args, {
      cwd: input.cwd,
      stdio: "inherit",
      shell: isWindows,
    });
    child.once("error", reject);
    // Death by signal has no exit code; report it as a failure.
    child.once("exit", (code, signal) => resolve(code ?? (signal === null ? 0 : 1)));
  });
}
