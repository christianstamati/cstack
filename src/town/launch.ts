// How the agent is launched in town mode. Flags checked against Claude Code 2.1.304
// and codex-cli 0.160.1 (`--help`) and their current docs.
//
// Claude Code
//   --mcp-config <configs...>   JSON string or file; Streamable HTTP server shape is
//                               { mcpServers: { name: { type: "http", url } } }.
//                               Variadic: the prompt goes after `--` (agentCommandLine),
//                               and the town's last flag is non-variadic as well.
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
//   --sandbox read-only         with on-request: asks before edits, network and writes.
//   --ask-for-approval on-request   (0.160 accepts only on-request and never; `untrusted`
//                               is gone, from the flag and from config).
//   Both flags error when given twice ("cannot be used multiple times"), so when the
//   user passes their own after `--`, the town leaves its one out.
//
// Neither agent's skip-all-permissions mode is ever used by the town.
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

const OVERRIDE_NOTE =
  "You passed permission flags after --, and your flags override the town's permission defaults.";

type LaunchInput = {
  mcpUrl: string;
  askEverything: boolean;
  /** What the user passed after `--`; they go on the agent's command line after the town's. */
  agentArgs?: ReadonlyArray<string>;
};

export function townLaunch(agent: AgentId, input: LaunchInput): TownLaunch {
  return agent === "claude" ? claudeLaunch(input) : codexLaunch(input);
}

/** True when `args` (before any `--`) set one of the long flags `long` (also `--flag=value`)
 * or the short flags `short` (also `-xvalue`). */
function setsFlag(
  args: ReadonlyArray<string>,
  long: ReadonlyArray<string>,
  short: ReadonlyArray<string> = [],
): boolean {
  for (const arg of args) {
    if (arg === "--") return false;
    if (long.some((flag) => arg === flag || arg.startsWith(`${flag}=`))) return true;
    if (!arg.startsWith("--") && short.some((flag) => arg.startsWith(flag))) return true;
  }
  return false;
}

function claudeLaunch(input: LaunchInput): TownLaunch {
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
    summary: [
      ...(input.askEverything
        ? ["The agent will ask before every command and file edit."]
        : [
            `Allowed without asking in this session: ${allowed.join(", ")}. They run with whatever arguments the agent picks.`,
            "File edits in the project are accepted automatically, and so are basic file commands like mkdir, mv and cp in the project (Claude's accept-edits mode). Anything else asks in this terminal.",
            PACKAGES_WARNING,
          ]),
      // Claude takes the last --permission-mode, so the user's (after the town's) wins.
      ...(setsFlag(input.agentArgs ?? [], ["--permission-mode", "--dangerously-skip-permissions"])
        ? [OVERRIDE_NOTE]
        : []),
    ],
  };
}

function codexLaunch(input: LaunchInput): TownLaunch {
  const own = input.agentArgs ?? [];
  const bypass = setsFlag(own, ["--full-auto", "--dangerously-bypass-approvals-and-sandbox"]);
  const ownSandbox = bypass || setsFlag(own, ["--sandbox"], ["-s"]);
  const ownApproval = bypass || setsFlag(own, ["--ask-for-approval"], ["-a"]);
  const args = [
    "-c",
    `mcp_servers.cstack.url=${JSON.stringify(input.mcpUrl)}`,
    "-c",
    `mcp_servers.cstack.tool_timeout_sec=${TOOL_TIMEOUT_MS / 1000}`,
  ];
  if (!ownSandbox) {
    if (!input.askEverything) args.push("-c", "sandbox_workspace_write.network_access=true");
    args.push("--sandbox", input.askEverything ? "read-only" : "workspace-write");
  }
  if (!ownApproval) args.push("--ask-for-approval", "on-request");
  return {
    args,
    env: {},
    allowed: [],
    runsPackages: !input.askEverything,
    summary:
      ownSandbox || ownApproval
        ? [OVERRIDE_NOTE]
        : input.askEverything
          ? [
              "Codex runs in a read-only sandbox and asks before it edits files, uses the network or runs anything that needs more than reading.",
            ]
          : [
              "Codex can run any command without asking, with file writes limited to the project folder and network access allowed. Anything outside that asks in this terminal.",
              PACKAGES_WARNING,
            ],
  };
}
