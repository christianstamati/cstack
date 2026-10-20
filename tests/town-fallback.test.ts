import { expect, test } from "vite-plus/test";

import { townUnavailableReason } from "../src/town/fallback.ts";

test.each([
  [{ stdinTTY: false, stdoutTTY: true, env: {}, open: true }, "no interactive terminal"],
  [{ stdinTTY: true, stdoutTTY: false, env: {}, open: true }, "no interactive terminal"],
  [{ stdinTTY: true, stdoutTTY: true, env: { CI: "true" }, open: true }, "running in CI"],
  [{ stdinTTY: true, stdoutTTY: true, env: { SSH_CONNECTION: "x" }, open: true }, "SSH session"],
  [{ stdinTTY: true, stdoutTTY: true, env: { SSH_TTY: "/dev/pts/1" }, open: true }, "SSH session"],
  [{ stdinTTY: true, stdoutTTY: true, env: { SSH_CONNECTION: "x" }, open: false }, null],
  [{ stdinTTY: true, stdoutTTY: true, env: { CI: "false" }, open: true }, null],
  [{ stdinTTY: true, stdoutTTY: true, env: { CI: "0" }, open: true }, null],
  [{ stdinTTY: true, stdoutTTY: true, env: {}, open: true }, null],
])("townUnavailableReason %#", (input, expected) =>
  expect(townUnavailableReason(input)).toBe(expected),
);
