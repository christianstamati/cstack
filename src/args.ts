import { parseArgs } from "node:util";

export const AGENT_IDS = ["claude", "codex"] as const;
export type AgentId = (typeof AGENT_IDS)[number];

export type Command = "create" | "help";

export interface CliOptions {
  readonly command: Command;
  // Set when help was asked for a specific command, e.g. `town create --help`.
  readonly helpFor?: "create";
  readonly dir?: string;
  readonly agent?: AgentId;
  readonly model?: string;
  readonly config?: string;
  readonly defaults: boolean;
  readonly terminal: boolean;
  readonly open: boolean;
  readonly askEverything: boolean;
  // Everything after `--`, passed to the agent CLI as is.
  readonly agentArgs: ReadonlyArray<string>;
}

export const USAGE = `Usage: town <command> [options]

Commands:
  create <dir>      Create a project and build it with Claude Code or Codex.
  update            (coming later)

Run \`town create --help\` for the create options.`;

export const CREATE_USAGE = `Usage: town create <dir> [options] [-- agent args]

Creates dir, writes the cstack bootstrap prompt into it, and starts
Claude Code or Codex there to interview you and build the project.

Options:
  --agent <claude|codex>  Agent CLI to use. Default: ask when both are installed.
  --model <name>          Model passed through to the agent CLI.
  --defaults              Skip the interview and use the cstack defaults.
  --config <file>         Reuse a saved .cstack/config.json.
  --terminal              Stay in the terminal instead of opening the town.
  --no-open               Don't open the browser automatically.
  --ask-everything        Ask every question instead of using sensible defaults.
  -h, --help              Show this help.

Arguments after -- go to the agent CLI, e.g. -- --permission-mode acceptEdits`;

export class UsageError extends Error {}

export function parseCliArgs(argv: ReadonlyArray<string>): CliOptions {
  const separator = argv.indexOf("--");
  const own = separator === -1 ? argv : argv.slice(0, separator);
  const agentArgs = separator === -1 ? [] : argv.slice(separator + 1);

  let parsed;
  try {
    parsed = parseArgs({
      args: [...own],
      allowPositionals: true,
      strict: true,
      options: {
        agent: { type: "string" },
        model: { type: "string" },
        config: { type: "string" },
        defaults: { type: "boolean", default: false },
        terminal: { type: "boolean", default: false },
        "no-open": { type: "boolean", default: false },
        "ask-everything": { type: "boolean", default: false },
        help: { type: "boolean", short: "h", default: false },
      },
    });
  } catch (error) {
    throw new UsageError(error instanceof Error ? error.message : String(error));
  }

  const { values, positionals } = parsed;
  const [name, ...rest] = positionals;
  if (name === undefined) {
    if (values.help || argv.length === 0) {
      return baseOptions("help");
    }
    throw new UsageError("Missing command. Try: town create <dir>");
  }
  if (name === "update") {
    throw new UsageError("town update is coming in a later version. For now: town create <dir>");
  }
  if (name !== "create") {
    throw new UsageError(`Unknown command: ${name}`);
  }
  if (values.help) {
    return { ...baseOptions("help"), helpFor: "create", dir: undefined };
  }
  if (rest.length > 1) {
    throw new UsageError(`Expected one project directory, got: ${rest.join(" ")}`);
  }
  const agent = values.agent;
  if (agent !== undefined && !isAgentId(agent)) {
    throw new UsageError(`--agent must be one of: ${AGENT_IDS.join(", ")}`);
  }
  if (values.defaults && values.config !== undefined) {
    throw new UsageError("Use either --defaults or --config, not both.");
  }

  return {
    command: "create",
    dir: rest[0],
    agent,
    model: values.model,
    config: values.config,
    defaults: values.defaults,
    terminal: values.terminal,
    open: !values["no-open"],
    askEverything: values["ask-everything"],
    agentArgs,
  };

  function baseOptions(command: Command): CliOptions {
    return {
      command,
      defaults: false,
      terminal: false,
      open: true,
      askEverything: false,
      agentArgs,
    };
  }
}

function isAgentId(value: string): value is AgentId {
  return (AGENT_IDS as ReadonlyArray<string>).includes(value);
}

const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidProjectName(name: string): boolean {
  return KEBAB_CASE.test(name);
}
