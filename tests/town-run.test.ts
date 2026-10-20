import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test, vi } from "vite-plus/test";

import { agentCommandLine, runAgent } from "../src/agent.ts";
import { defaultOptions } from "./helpers.ts";
import { CliError } from "../src/create.ts";
import { openTown, runTown } from "../src/town/run.ts";
import { TownStore } from "../src/town/store.ts";

let dir: string | undefined;
afterEach(() => {
  if (dir !== undefined) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
  vi.restoreAllMocks();
});

test("runAgent exposes the child through onSpawn", async () => {
  let pid: number | undefined;
  const code = await runAgent({
    command: process.execPath,
    args: ["-e", ""],
    cwd: tmpdir(),
    onSpawn: (child) => {
      pid = child.pid;
    },
  });
  expect(code).toBe(0);
  expect(pid).toBeGreaterThan(0);
});

test("runTown forwards SIGTERM to the agent, ignores SIGINT, and resolves", async () => {
  dir = mkdtempSync(join(tmpdir(), "town-run-"));
  const bin = join(dir, "claude");
  writeFileSync(bin, "#!/bin/sh\nexec sleep 30\n");
  chmodSync(bin, 0o755);
  const oldPath = process.env.PATH;
  process.env.PATH = `${dir}:${oldPath}`;
  vi.spyOn(console, "log").mockImplementation(() => {});
  try {
    const running = runTown({
      options: { ...defaultOptions, open: false },
      projectDir: dir,
      projectName: "t",
      agent: { id: "claude", label: "Claude Code" },
      launchPrompt: "hi",
    });
    await new Promise((r) => setTimeout(r, 600));
    process.emit("SIGINT");
    await new Promise((r) => setTimeout(r, 100));
    let settled = false;
    void running.then(() => (settled = true));
    await new Promise((r) => setTimeout(r, 100));
    expect(settled).toBe(false);
    process.emit("SIGTERM");
    // The agent died from the forwarded signal: reported as a failure exit code.
    await expect(running).resolves.toBe(1);
  } finally {
    process.env.PATH = oldPath;
  }
});

test("the launch prompt comes after `--`, so a variadic flag can't swallow it", () => {
  // Text mode: no town flags.
  expect(
    agentCommandLine({ agentArgs: ["--allowedTools", "Bash(make *)"], prompt: "Read it" }),
  ).toEqual(["--allowedTools", "Bash(make *)", "--", "Read it"]);
  expect(
    agentCommandLine({ launchArgs: ["--sandbox", "x"], model: "o3", agentArgs: [], prompt: "p" }),
  ).toEqual(["--sandbox", "x", "--model", "o3", "--", "p"]);
  // The user already ended the options themselves: no second marker.
  expect(agentCommandLine({ agentArgs: ["--", "extra"], prompt: "p" })).toEqual([
    "--",
    "extra",
    "p",
  ]);
});

test("runTown puts the prompt after `--` on the agent's command line", async () => {
  dir = mkdtempSync(join(tmpdir(), "town-run-"));
  const bin = join(dir, "codex");
  const out = join(dir, "args.txt");
  writeFileSync(bin, `#!/bin/sh\nprintf '%s\\n' "$@" > '${out}'\n`);
  chmodSync(bin, 0o755);
  const oldPath = process.env.PATH;
  process.env.PATH = `${dir}:${oldPath}`;
  vi.spyOn(console, "log").mockImplementation(() => {});
  try {
    const code = await runTown({
      options: { ...defaultOptions, open: false, agentArgs: ["-i", "a.png"] },
      projectDir: dir,
      projectName: "t",
      agent: { id: "codex", label: "Codex" },
      launchPrompt: "hi",
    });
    expect(code).toBe(0);
    const args = readFileSync(out, "utf8").trimEnd().split("\n");
    expect(args.slice(-4)).toEqual(["-i", "a.png", "--", "hi"]);
  } finally {
    process.env.PATH = oldPath;
  }
});

test("a town that can't start is a plain error that points to --terminal", async () => {
  const store = new TownStore("t");
  const missingUi = () => {
    throw new Error("Couldn't find the @cstack-dev/town package root above /x.");
  };
  const noPort = async () => {
    throw Object.assign(new Error("listen EADDRNOTAVAIL 127.0.0.1"), { code: "EADDRNOTAVAIL" });
  };
  for (const attempt of [openTown(store, missingUi), openTown(store, () => "/ui", noPort)]) {
    const error = await attempt.catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(CliError);
    expect((error as Error).message).toContain("Couldn't start the town");
    expect((error as Error).message).toContain("--terminal");
  }
  // The reason is kept.
  await expect(openTown(store, missingUi)).rejects.toThrow("package root");
});
