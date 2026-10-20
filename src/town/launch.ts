// How the agent is launched in town mode. Flags checked against Claude Code 2.1.304
// and codex-cli 0.160.1 (`--help`) and their current docs.
//
// Claude Code
//   --mcp-config <configs...>   JSON string or file; Streamable HTTP server shape is
//                               { mcpServers: { name: { type: "http", url } } }.
//                               Variadic: the flag after it must be non-variadic so the
//                               trailing prompt isn't read as another config.
//   --allowedTools <tools...>   permission rules (`mcp__server__tool`, `Bash(npx *)`);
//                               passed as ONE comma-separated value (also variadic).
//   --permission-mode           `acceptEdits` auto-approves file edits; `default` asks.
//   MCP_TOOL_TIMEOUT (env)      ms per MCP tool call (docs: code.claude.com/docs/en/env-vars).
//                               Above 60000 it also lifts the 60s per-request limit on
//                               HTTP servers, which matters for a long-waiting `ask`.
//
// Codex
//   -c key=value                TOML override; values are TOML (strings quoted).
//   mcp_servers.<name>.url      Streamable HTTP server (openai/codex config mcp_types.rs).
//   mcp_servers.<name>.tool_timeout_sec   seconds per tool call (default 300).
//   --sandbox workspace-write   write inside the project only.
//   -c sandbox_workspace_write.network_access=true   lets installs reach the network.
//   --ask-for-approval on-request | untrusted   (`untrusted` asks for all but known-safe).
//
// Neither agent's skip-all-permissions mode is ever used.
import type { AgentId } from "../args.ts";

export const ALLOWED_COMMANDS = [
  "npm",
  "pnpm",
  "yarn",
  "bun",
  "npx",
  "bunx",
  "pnpm dlx",
  "yarn dlx",
  "git",
  "vp",
  "docker compose",
] as const;

const MCP_TOOLS = ["ask", "decide", "plan", "progress", "report", "status"];
const TOOL_TIMEOUT_MS = 24 * 60 * 60 * 1000;
const DOWNLOADS_PACKAGES = new Set(["npx", "bunx"]);

export interface TownLaunch {
  args: string[];
  env: Record<string, string>;
  /** Tools the agent may run without asking (Claude only). */
  allowed: string[];
  /** True when the agent can download and run npm packages without asking. */
  runsPackages: boolean;
  /** Plain-words startup message about what runs without asking. */
  summary: string[];
}

const PACKAGES_WARNING = "npx and bunx let the agent download and run npm packages without asking.";

export function townLaunch(
  agent: AgentId,
  input: { mcpUrl: string; askEverything: boolean },
): TownLaunch {
  return agent === "claude" ? claudeLaunch(input) : codexLaunch(input);
}

function claudeLaunch(input: { mcpUrl: string; askEverything: boolean }): TownLaunch {
  const mcpConfig = JSON.stringify({
    mcpServers: { cstack: { type: "http", url: input.mcpUrl } },
  });
  const rules = MCP_TOOLS.map((tool) => `mcp__cstack__${tool}`);
  if (!input.askEverything) {
    rules.push(...ALLOWED_COMMANDS.map((command) => `Bash(${command} *)`));
  }
  const allowed = input.askEverything
    ? []
    : ALLOWED_COMMANDS.map((command) =>
        DOWNLOADS_PACKAGES.has(command) ? `${command} (runs any npm package)` : command,
      );
  return {
    args: [
      "--mcp-config",
      mcpConfig,
      "--allowedTools",
      rules.join(","),
      "--permission-mode",
      input.askEverything ? "default" : "acceptEdits",
    ],
    env: { MCP_TOOL_TIMEOUT: String(TOOL_TIMEOUT_MS) },
    allowed,
    runsPackages: !input.askEverything,
    summary: input.askEverything
      ? ["The agent will ask before every command and file edit."]
      : [
          `Allowed without asking in this session: ${allowed.join(", ")}. They run with whatever arguments the agent picks.`,
          "File edits in the project are accepted automatically, and so are basic file commands like mkdir, mv and cp in the project (Claude's accept-edits mode). Anything else asks in this terminal.",
          PACKAGES_WARNING,
        ],
  };
}

function codexLaunch(input: { mcpUrl: string; askEverything: boolean }): TownLaunch {
  return {
    args: [
      "-c",
      `mcp_servers.cstack.url=${JSON.stringify(input.mcpUrl)}`,
      "-c",
      `mcp_servers.cstack.tool_timeout_sec=${TOOL_TIMEOUT_MS / 1000}`,
      "-c",
      "sandbox_workspace_write.network_access=true",
      "--sandbox",
      "workspace-write",
      "--ask-for-approval",
      input.askEverything ? "untrusted" : "on-request",
    ],
    env: {},
    allowed: [],
    runsPackages: !input.askEverything,
    summary: input.askEverything
      ? [
          "Codex will ask before running commands, except known-safe read-only ones. File edits in the project folder are still accepted automatically.",
        ]
      : [
          "Codex can run any command without asking, with file writes limited to the project folder and network access allowed. Anything outside that asks in this terminal.",
          PACKAGES_WARNING,
        ],
  };
}
