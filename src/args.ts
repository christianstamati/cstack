import { parseArgs } from "node:util";

export const AGENT_IDS = ["claude", "codex"] as const;
export type AgentId = (typeof AGENT_IDS)[number];

export interface CliOptions {
  readonly dir: string | undefined;
  readonly agent: AgentId | undefined;
  readonly model: string | undefined;
  readonly config: string | undefined;
  readonly defaults: boolean;
  readonly help: boolean;
  // Everything after `--`, passed to the agent CLI as is.
  readonly agentArgs: ReadonlyArray<string>;
}

export const USAGE = `Usage: create-cstack [project-dir] [options] [-- agent args]

Creates project-dir, writes the cstack bootstrap prompt into it, and starts
Claude Code or Codex there to interview you and build the project.

Options:
  --agent <claude|codex>  Agent CLI to use. Default: ask when both are installed.
  --model <name>          Model passed through to the agent CLI.
  --defaults              Skip the interview and use the cstack defaults.
  --config <file>         Reuse a saved .cstack/config.json.
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
        help: { type: "boolean", short: "h", default: false },
      },
    });
  } catch (error) {
    throw new UsageError(error instanceof Error ? error.message : String(error));
  }

  const { values, positionals } = parsed;
  if (positionals.length > 1) {
    throw new UsageError(`Expected one project directory, got: ${positionals.join(" ")}`);
  }
  const agent = values.agent;
  if (agent !== undefined && !isAgentId(agent)) {
    throw new UsageError(`--agent must be one of: ${AGENT_IDS.join(", ")}`);
  }
  if (values.defaults && values.config !== undefined) {
    throw new UsageError("Use either --defaults or --config, not both.");
  }

  return {
    dir: positionals[0],
    agent,
    model: values.model,
    config: values.config,
    defaults: values.defaults,
    help: values.help,
    agentArgs,
  };
}

function isAgentId(value: string): value is AgentId {
  return (AGENT_IDS as ReadonlyArray<string>).includes(value);
}

const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidProjectName(name: string): boolean {
  return KEBAB_CASE.test(name);
}
