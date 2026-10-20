import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { afterEach, beforeEach, expect, test } from "vite-plus/test";

import { createMcpHandler } from "../src/town/mcp.ts";
import { startTownServer, type TownServer } from "../src/town/server.ts";
import { TownStore } from "../src/town/store.ts";

let dir: string;
let store: TownStore;
let server: TownServer;
let client: Client;

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "town-mcp-"));
  writeFileSync(join(dir, "index.html"), "<html></html>");
  store = new TownStore("my-app");
  server = await startTownServer({ store, uiDir: dir, mcp: createMcpHandler(store) });
  client = new Client({ name: "test", version: "1.0.0" });
  await client.connect(new StreamableHTTPClientTransport(new URL(server.mcpUrl)));
});

afterEach(async () => {
  await client.close();
  await server.close();
  rmSync(dir, { recursive: true, force: true });
});

const textOf = (result: unknown): string =>
  (result as { content: { type: string; text: string }[] }).content[0]!.text;

async function waitFor<T>(read: () => T | null | undefined | false): Promise<T> {
  for (let i = 0; i < 200; i++) {
    const value = read();
    if (value) return value;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error("timed out waiting");
}

const deployQuestion = {
  slot: "deploy",
  question: "Deploy?",
  options: [{ id: "vercel", label: "Vercel" }],
  multiSelect: false,
  freeText: false,
};

test("lists the six cstack tools", async () => {
  expect((await client.listTools()).tools.map((t) => t.name).sort()).toEqual([
    "ask",
    "decide",
    "plan",
    "progress",
    "report",
    "status",
  ]);
});

test("ask blocks until the page answers", async () => {
  const call = client.callTool({ name: "ask", arguments: deployQuestion });
  const pending = await waitFor(() => store.getState().pending);
  expect(pending.question).toBe("Deploy?");
  store.answer({ questionId: pending.id, optionIds: ["vercel"] });
  expect(JSON.parse(textOf(await call))).toEqual({ optionIds: ["vercel"] });
});

test("ask returns free text", async () => {
  const call = client.callTool({
    name: "ask",
    arguments: { slot: "name", question: "Name?", options: [], multiSelect: false, freeText: true },
  });
  const pending = await waitFor(() => store.getState().pending);
  store.answer({ questionId: pending.id, optionIds: [], text: "acme" });
  expect(JSON.parse(textOf(await call))).toEqual({ optionIds: [], text: "acme" });
});

test("ask accepts a null slot", async () => {
  const call = client.callTool({
    name: "ask",
    arguments: { ...deployQuestion, slot: null },
  });
  const pending = await waitFor(() => store.getState().pending);
  expect(pending.slot).toBeNull();
  store.answer({ questionId: pending.id, optionIds: ["vercel"] });
  await call;
});

test("an unknown slot is a tool error", async () => {
  const result = await client.callTool({
    name: "ask",
    arguments: { ...deployQuestion, slot: "kitchen" },
  });
  expect(result.isError).toBe(true);
  expect(store.getState().pending).toBeNull();
});

test("ask ends with an error result when the agent stops", async () => {
  const call = client.callTool({ name: "ask", arguments: deployQuestion });
  await waitFor(() => store.getState().pending);
  store.agentStopped();
  const result = await call;
  expect(result.isError).toBe(true);
  expect(textOf(result)).toContain("agent stopped");
});

test("decide places an auto building", async () => {
  const result = await client.callTool({
    name: "decide",
    arguments: { slot: "api", optionIds: [], labels: ["Not needed"], reason: "Convex has an API" },
  });
  expect(textOf(result)).toBe("ok");
  expect(store.getState().placements.api).toEqual({
    slot: "api",
    optionIds: [],
    labels: ["Not needed"],
    auto: true,
    reason: "Convex has an API",
    seq: 0,
    lot: null,
  });
});

test("plan blocks until the page approves", async () => {
  const call = client.callTool({
    name: "plan",
    arguments: {
      rows: [{ label: "Deploy", value: "Vercel", auto: false }],
      tree: "app/",
      generators: [],
      manualSteps: [],
    },
  });
  await waitFor(() => store.getState().plan);
  expect(store.answer({ questionId: "plan", action: "change", slot: "deploy" })).toBe("ok");
  expect(JSON.parse(textOf(await call))).toEqual({ action: "change", slot: "deploy" });
});

test("progress, status and report update the town", async () => {
  expect(textOf(await client.callTool({ name: "status", arguments: { text: "Installing" } }))).toBe(
    "ok",
  );
  expect(
    textOf(
      await client.callTool({
        name: "progress",
        arguments: { name: "Scaffold", slots: ["frontend"], status: "started" },
      }),
    ),
  ).toBe("ok");
  expect(
    textOf(
      await client.callTool({
        name: "report",
        arguments: {
          built: ["app"],
          commands: ["bun dev"],
          manualSteps: [{ slot: null, text: "Log in" }],
          unverified: [],
        },
      }),
    ),
  ).toBe("ok");
  const state = store.getState();
  expect(state.status).toBe("Installing");
  expect(state.steps).toHaveLength(1);
  expect(state.phase).toBe("done");
});

test("the http server sets no request timeout", () => {
  expect(server.http.requestTimeout).toBe(0);
});

test("a request without the token never reaches the handler", async () => {
  const res = await fetch(new URL("/mcp", server.mcpUrl), { method: "POST" });
  expect(res.status).toBe(401);
});

test("an ask dropped by the client is withdrawn", async () => {
  const controller = new AbortController();
  const request = fetch(server.mcpUrl, {
    method: "POST",
    signal: controller.signal,
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: "ask", arguments: deployQuestion },
    }),
  }).catch(() => undefined);
  await waitFor(() => store.getState().pending);
  controller.abort();
  await request;
  await waitFor(() => store.getState().pending === null);
});

test("an unanswerable question is a tool error", async () => {
  const result = await client.callTool({
    name: "ask",
    arguments: { ...deployQuestion, options: [] },
  });
  expect(result.isError).toBe(true);
  expect(store.getState().pending).toBeNull();
});

test("a misspelled field is a tool error", async () => {
  const result = await client.callTool({
    name: "ask",
    arguments: { ...deployQuestion, multiselect: true },
  });
  expect(result.isError).toBe(true);
  expect(store.getState().pending).toBeNull();
});
