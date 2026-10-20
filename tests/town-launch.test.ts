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

test("codex with --ask-everything asks before untrusted commands", () => {
  const { args } = townLaunch("codex", { mcpUrl: URL_, askEverything: true });
  expect(args).toEqual(expect.arrayContaining(["--ask-for-approval", "untrusted"]));
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
