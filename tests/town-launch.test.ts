import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";

import { townLaunch } from "../src/town/launch.ts";
import { openBrowser } from "../src/town/open-browser.ts";
import { findPackageRoot } from "../src/town/run.ts";

const URL_ = "http://127.0.0.1:4321/mcp?token=abc";

test("claude gets the MCP server, accept-edits and the allowlist", () => {
  const { args, env, allowed } = townLaunch("claude", { mcpUrl: URL_, askEverything: false });
  expect(args).toContain("--mcp-config");
  expect(JSON.parse(args[args.indexOf("--mcp-config") + 1] ?? "")).toEqual({
    mcpServers: { cstack: { type: "http", url: URL_ } },
  });
  expect(args).toEqual(expect.arrayContaining(["--permission-mode", "acceptEdits"]));
  expect(args.join(" ")).toContain("mcp__cstack__ask");
  expect(args.join(" ")).toContain("Bash(npx *)");
  expect(env.MCP_TOOL_TIMEOUT).toBe("86400000");
  expect(allowed).toContain("npx (runs any npm package)");
  expect(args.join(" ")).not.toMatch(/dangerously/);
});

test("claude ends on a non-variadic flag so the prompt isn't swallowed", () => {
  for (const askEverything of [false, true]) {
    const { args } = townLaunch("claude", { mcpUrl: URL_, askEverything });
    expect(args.at(-2)).toBe("--permission-mode");
  }
});

test("claude with --ask-everything only allows the cstack tools", () => {
  const { args, allowed } = townLaunch("claude", { mcpUrl: URL_, askEverything: true });
  expect(args).not.toContain("acceptEdits");
  expect(args.join(" ")).not.toContain("Bash(");
  expect(args.join(" ")).toContain("mcp__cstack__ask");
  expect(allowed).toEqual([]);
});

test("codex gets the MCP server, workspace-write with network, approval on request", () => {
  const { args } = townLaunch("codex", { mcpUrl: URL_, askEverything: false });
  expect(args).toEqual(
    expect.arrayContaining(["--sandbox", "workspace-write", "--ask-for-approval", "on-request"]),
  );
  expect(args.join(" ")).toContain(`mcp_servers.cstack.url="${URL_}"`);
  expect(args.join(" ")).toContain("mcp_servers.cstack.tool_timeout_sec=86400");
  expect(args.join(" ")).toContain("sandbox_workspace_write.network_access=true");
  expect(args.join(" ")).not.toMatch(/dangerously/);
});

test("a missing opener resolves false instead of throwing", async () => {
  await expect(openBrowser("http://127.0.0.1:1/", ["definitely-not-a-command-xyz"])).resolves.toBe(
    false,
  );
});

test("a failing opener resolves false", async () => {
  await expect(openBrowser("http://127.0.0.1:1/", ["false"])).resolves.toBe(false);
});

test("findPackageRoot walks up to the @cstack-dev/town package", () => {
  const root = mkdtempSync(join(tmpdir(), "town-root-"));
  try {
    writeFileSync(join(root, "package.json"), JSON.stringify({ name: "@cstack-dev/town" }));
    mkdirSync(join(root, "dist", "deep"), { recursive: true });
    writeFileSync(join(root, "dist", "package.json"), JSON.stringify({ name: "other" }));
    expect(findPackageRoot(join(root, "dist", "deep"))).toBe(root);
    expect(() => findPackageRoot(tmpdir())).toThrow();
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("findPackageRoot finds this repo from source", () => {
  expect(findPackageRoot(import.meta.dirname)).toBe(join(import.meta.dirname, ".."));
});

test("claude's startup summary names the tools and warns about packages", () => {
  const launch = townLaunch("claude", { mcpUrl: URL_, askEverything: false });
  const text = launch.summary.join("\n");
  expect(launch.runsPackages).toBe(true);
  expect(text).toContain("whatever arguments");
  expect(text).toContain("mkdir, mv and cp");
  expect(text).toContain("download and run npm packages");
  expect(text).not.toMatch(/commands in(side)? the project/);
  // Every download-and-run command is flagged, and the summary says plainly what that means.
  for (const command of ["npx", "bunx", "pnpm dlx", "yarn dlx"]) {
    expect(launch.allowed).toContain(`${command} (runs any npm package)`);
    expect(text).toContain(command);
  }
  expect(text).toContain("can run arbitrary code");
  expect(text).toContain("bun -e");
});

test("codex warns about packages and describes its policy plainly", () => {
  const launch = townLaunch("codex", { mcpUrl: URL_, askEverything: false });
  expect(launch.runsPackages).toBe(true);
  expect(launch.summary.join("\n")).toContain("any command");
  expect(launch.summary.join("\n")).toContain("download and run npm packages");
});

test("--ask-everything wording is accurate per agent", () => {
  const claude = townLaunch("claude", { mcpUrl: URL_, askEverything: true });
  const codex = townLaunch("codex", { mcpUrl: URL_, askEverything: true });
  expect(claude.runsPackages).toBe(false);
  expect(codex.runsPackages).toBe(false);
  expect(codex.summary.join("\n")).toContain("read-only sandbox");
  expect(codex.summary.join("\n")).not.toContain("every command");
});

test("a slow opener counts as opened instead of blocking", async () => {
  const started = Date.now();
  await expect(
    openBrowser("http://127.0.0.1:1/", ["sh", "-c", "exec sleep 30", "x"]),
  ).resolves.toBe(true);
  expect(Date.now() - started).toBeLessThan(5000);
});

const flagValue = (args: string[], flag: string) => args[args.indexOf(flag) + 1];

test("codex --ask-everything uses a read-only sandbox with approval on request", () => {
  // codex-cli 0.160 accepts only on-request and never for --ask-for-approval.
  const { args, summary } = townLaunch("codex", {
    mcpUrl: URL_,
    askEverything: true,
    agentArgs: [],
  });
  expect(flagValue(args, "--sandbox")).toBe("read-only");
  expect(flagValue(args, "--ask-for-approval")).toBe("on-request");
  expect(args).not.toContain("untrusted");
  expect(args.join(" ")).not.toContain("network_access");
  expect(summary.join("\n")).toContain("asks before it edits files");
});

test("codex: the user's own permission flags replace the town's", () => {
  const launch = (agentArgs: string[]) =>
    townLaunch("codex", { mcpUrl: URL_, askEverything: false, agentArgs });
  const has = (args: string[], flag: string) => args.includes(flag);
  for (const own of [
    ["--sandbox", "read-only"],
    ["-s", "read-only"],
    ["--sandbox=read-only"],
    ["-sread-only"],
  ]) {
    const { args, summary } = launch(own);
    expect(has(args, "--sandbox")).toBe(false);
    // The network grant belongs to the town's sandbox; it goes with it.
    expect(args.join(" ")).not.toContain("network_access");
    expect(flagValue(args, "--ask-for-approval")).toBe("on-request");
    expect(summary.join("\n")).toContain("your flags override the town's permission defaults");
  }
  for (const own of [
    ["--ask-for-approval", "never"],
    ["-a", "never"],
    ["--ask-for-approval=never"],
    ["-anever"],
  ]) {
    const { args } = launch(own);
    expect(has(args, "--ask-for-approval")).toBe(false);
    expect(flagValue(args, "--sandbox")).toBe("workspace-write");
  }
  for (const own of [["--full-auto"], ["--dangerously-bypass-approvals-and-sandbox"]]) {
    const { args, summary } = launch(own);
    expect(has(args, "--sandbox")).toBe(false);
    expect(has(args, "--ask-for-approval")).toBe(false);
    expect(summary.join("\n")).toContain("your flags override the town's permission defaults");
  }
  // Unrelated flags, and words after the user's own `--`, change nothing.
  for (const own of [["--search"], ["-m", "o3"], ["--", "-s"]]) {
    const { args, summary } = launch(own);
    expect(flagValue(args, "--sandbox")).toBe("workspace-write");
    expect(flagValue(args, "--ask-for-approval")).toBe("on-request");
    expect(summary.join("\n")).not.toContain("override");
  }
});

test("claude: the user's permission flags win (last one wins) and the summary says so", () => {
  const plain = townLaunch("claude", { mcpUrl: URL_, askEverything: false, agentArgs: [] });
  expect(plain.summary.join("\n")).not.toContain("override");
  for (const own of [["--permission-mode", "plan"], ["--dangerously-skip-permissions"]]) {
    const { args, summary } = townLaunch("claude", {
      mcpUrl: URL_,
      askEverything: false,
      agentArgs: own,
    });
    // Claude takes the last --permission-mode, and the user's flags come after the town's.
    expect(flagValue(args, "--permission-mode")).toBe("acceptEdits");
    expect(summary.join("\n")).toContain("your flags override the town's permission defaults");
  }
});
