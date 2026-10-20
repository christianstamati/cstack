import { expect, test } from "vite-plus/test";

import { isValidProjectName, parseCliArgs, UsageError } from "../src/args.ts";

test("parses a directory and options", () => {
  expect(parseCliArgs(["my-app", "--agent", "codex", "--model", "o5"])).toMatchObject({
    dir: "my-app",
    agent: "codex",
    model: "o5",
    defaults: false,
    agentArgs: [],
  });
});

test("passes everything after -- to the agent", () => {
  const options = parseCliArgs(["my-app", "--", "--permission-mode", "acceptEdits"]);
  expect(options.agentArgs).toEqual(["--permission-mode", "acceptEdits"]);
});

test("rejects bad input", () => {
  expect(() => parseCliArgs(["--agent", "cursor"])).toThrow(UsageError);
  expect(() => parseCliArgs(["a", "b"])).toThrow(UsageError);
  expect(() => parseCliArgs(["--defaults", "--config", "x.json"])).toThrow(UsageError);
  expect(() => parseCliArgs(["--nope"])).toThrow(UsageError);
});

test("project names are kebab-case", () => {
  expect(isValidProjectName("my-app")).toBe(true);
  expect(isValidProjectName("app2")).toBe(true);
  expect(isValidProjectName("My-App")).toBe(false);
  expect(isValidProjectName("my_app")).toBe(false);
  expect(isValidProjectName("-app")).toBe(false);
});
