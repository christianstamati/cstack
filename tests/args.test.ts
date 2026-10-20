import { expect, test } from "vite-plus/test";

import { isValidProjectName, parseCliArgs, UsageError } from "../src/args.ts";

test("create takes a directory and options", () => {
  expect(parseCliArgs(["create", "my-app", "--agent", "codex", "--model", "o5"])).toMatchObject({
    command: "create",
    dir: "my-app",
    agent: "codex",
    model: "o5",
    terminal: false,
    open: true,
    askEverything: false,
    agentArgs: [],
  });
});

test("town flags", () => {
  expect(
    parseCliArgs(["create", "a", "--terminal", "--no-open", "--ask-everything"]),
  ).toMatchObject({ terminal: true, open: false, askEverything: true });
});

test("no command or --help prints help", () => {
  expect(parseCliArgs([]).command).toBe("help");
  expect(parseCliArgs(["--help"]).command).toBe("help");
});

test("create --help is help for create", () => {
  expect(parseCliArgs(["create", "--help"])).toMatchObject({
    command: "help",
    helpFor: "create",
    dir: undefined,
  });
});

test("update is not available yet", () => {
  expect(() => parseCliArgs(["update"])).toThrow(/later version/);
});

test("unknown commands and bad input are usage errors", () => {
  expect(() => parseCliArgs(["make", "x"])).toThrow(UsageError);
  expect(() => parseCliArgs(["create", "--agent", "cursor"])).toThrow(UsageError);
  expect(() => parseCliArgs(["create", "a", "b"])).toThrow(UsageError);
  expect(() => parseCliArgs(["create", "--defaults", "--config", "x.json"])).toThrow(UsageError);
});

test("everything after -- goes to the agent", () => {
  expect(parseCliArgs(["create", "a", "--", "--permission-mode", "plan"]).agentArgs).toEqual([
    "--permission-mode",
    "plan",
  ]);
});

test("project names are kebab-case", () => {
  expect(isValidProjectName("my-app")).toBe(true);
  expect(isValidProjectName("app2")).toBe(true);
  expect(isValidProjectName("My-App")).toBe(false);
  expect(isValidProjectName("my_app")).toBe(false);
  expect(isValidProjectName("-app")).toBe(false);
});
