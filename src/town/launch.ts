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

export function townLaunch(
  agent: AgentId,
  input: { mcpUrl: string; askEverything: boolean },
): { args: string[]; env: Record<string, string>; allowed: string[] } {
  return agent === "claude" ? claudeLaunch(input) : codexLaunch(input);
}

function claudeLaunch(input: { mcpUrl: string; askEverything: boolean }) {
  const mcpConfig = JSON.stringify({
    mcpServers: { cstack: { type: "http", url: input.mcpUrl } },
  });
  const rules = MCP_TOOLS.map((tool) => `mcp__cstack__${tool}`);
  if (!input.askEverything) {
    rules.push(...ALLOWED_COMMANDS.map((command) => `Bash(${command} *)`));
  }
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
    allowed: input.askEverything
      ? []
      : ALLOWED_COMMANDS.map((command) =>
          DOWNLOADS_PACKAGES.has(command) ? `${command} (runs any npm package)` : command,
        ),
  };
}

function codexLaunch(input: { mcpUrl: string; askEverything: boolean }) {
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
    allowed: input.askEverything ? [] : ["commands inside the project folder (sandboxed)"],
  };
}
