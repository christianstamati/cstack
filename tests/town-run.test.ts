import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test, vi } from "vite-plus/test";

import { runAgent } from "../src/agent.ts";
import { defaultOptions } from "./helpers.ts";
import { runTown } from "../src/town/run.ts";

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
