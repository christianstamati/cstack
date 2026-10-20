import type { CliOptions } from "../src/args.ts";

export const defaultOptions: CliOptions = {
  command: "create",
  defaults: false,
  terminal: false,
  open: true,
  askEverything: false,
  agentArgs: [],
};
