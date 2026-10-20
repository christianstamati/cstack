#!/usr/bin/env node
import { CREATE_USAGE, parseCliArgs, USAGE, UsageError } from "./args.ts";
import { CliError, createProject } from "./create.ts";

async function main(argv: ReadonlyArray<string>): Promise<number> {
  const options = parseCliArgs(argv);
  if (options.command === "help") {
    console.log(options.helpFor === "create" ? CREATE_USAGE : USAGE);
    return 0;
  }
  return createProject(options);
}

try {
  process.exitCode = await main(process.argv.slice(2));
} catch (error) {
  if (error instanceof UsageError) {
    console.error(`${error.message}\n\n${USAGE}`);
    process.exitCode = 2;
  } else if (error instanceof CliError) {
    console.error(error.message);
    process.exitCode = 1;
  } else {
    throw error;
  }
}
