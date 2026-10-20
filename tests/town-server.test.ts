import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { request } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, test } from "vite-plus/test";

import type { TownState } from "../src/town/protocol.ts";
import { startTownServer, type TownServer } from "../src/town/server.ts";
import { TownStore } from "../src/town/store.ts";

let dir: string;
let store: TownStore;
let server: TownServer;
let base: string;
let token: string;

const q = {
  slot: "frontend" as const,
  question: "Frontend?",
  options: [
    { id: "nextjs", label: "Next.js" },
    { id: "tanstack-start", label: "TanStack Start" },
  ],
  multiSelect: false,
  freeText: false,
};

const post = (body: string, path = "/answer") =>
  fetch(`${base}${path}?token=${token}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "town-ui-"));
  writeFileSync(join(dir, "index.html"), "<html><body>town</body></html>");
  writeFileSync(join(dir, "app.js"), "console.log(1)");
  mkdirSync(join(dir, "assets"));
  writeFileSync(join(dir, "assets", "a.css"), "body{}");
  store = new TownStore("my-app");
  server = await startTownServer({ store, uiDir: dir });
  const url = new URL(server.url);
  base = url.origin;
  token = server.token;
});

afterEach(async () => {
  await server.close();
  rmSync(dir, { recursive: true, force: true });
});

/** Reads SSE events from an open response. */
async function openEvents() {
  const controller = new AbortController();
  const res = await fetch(`${base}/events?token=${token}`, { signal: controller.signal });
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  return {
    res,
    async next(): Promise<TownState> {
      for (;;) {
        const end = buffer.indexOf("\n\n");
        if (end >= 0) {
          const chunk = buffer.slice(0, end);
          buffer = buffer.slice(end + 2);
          const data = chunk
            .split("\n")
            .filter((l) => l.startsWith("data: "))
            .map((l) => l.slice(6))
            .join("\n");
          if (data) return JSON.parse(data) as TownState;
          continue;
        }
        const { value, done } = await reader.read();
        if (done) throw new Error("stream ended");
        buffer += decoder.decode(value, { stream: true });
      }
    },
    reader,
    abort: () => controller.abort(),
  };
}

test("requests without the token get 401", async () => {
  expect((await fetch(base + "/")).status).toBe(401);
  expect((await fetch(base + "/?token=nope")).status).toBe(401);
  expect((await fetch(base + "/events")).status).toBe(401);
  expect((await fetch(base + "/answer", { method: "POST", body: "{}" })).status).toBe(401);
  expect((await fetch(base + "/mcp")).status).toBe(401);
});

test("token is 64 hex chars and urls carry it", () => {
  expect(server.token).toMatch(/^[0-9a-f]{64}$/);
  expect(server.url).toBe(`${base}/?token=${server.token}`);
  expect(server.mcpUrl).toBe(`${base}/mcp?token=${server.token}`);
});

test("serves the page with the token", async () => {
  const res = await fetch(server.url);
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toContain("text/html");
  expect(await res.text()).toContain("<html");
});

test("serves static files with content types", async () => {
  const js = await fetch(`${base}/app.js?token=${token}`);
  expect(js.headers.get("content-type")).toContain("javascript");
  const css = await fetch(`${base}/assets/a.css?token=${token}`);
  expect(css.headers.get("content-type")).toContain("text/css");
});

test("built files load without the token, the page and the API do not", async () => {
  // A page built with relative asset paths requests ./assets/x.js without the query string.
  const js = await fetch(`${base}/app.js`);
  expect(js.status).toBe(200);
  expect(await js.text()).toBe("console.log(1)");
  expect((await fetch(`${base}/assets/a.css`)).status).toBe(200);
  expect((await fetch(`${base}/assets/a.css`, { method: "HEAD" })).status).toBe(200);
  expect((await fetch(`${base}/index.html`)).status).toBe(401);
  expect((await fetch(`${base}/some/route`)).status).toBe(401);
  expect((await fetch(`${base}/assets`)).status).toBe(401);
  expect((await fetch(`${base}/missing.js`)).status).toBe(401);
  expect((await fetch(`${base}/app.js`, { method: "POST" })).status).toBe(401);
});

test("byte ranges are served for media", async () => {
  const full = await fetch(`${base}/app.js`);
  expect(full.headers.get("accept-ranges")).toBe("bytes");
  const part = await fetch(`${base}/app.js`, { headers: { range: "bytes=0-6" } });
  expect(part.status).toBe(206);
  expect(part.headers.get("content-range")).toBe("bytes 0-6/14");
  expect(part.headers.get("content-length")).toBe("7");
  expect(await part.text()).toBe("console");
  const open = await fetch(`${base}/app.js`, { headers: { range: "bytes=8-" } });
  expect(await open.text()).toBe("log(1)");
  const suffix = await fetch(`${base}/app.js`, { headers: { range: "bytes=-3" } });
  expect(await suffix.text()).toBe("(1)");
  const beyond = await fetch(`${base}/app.js`, { headers: { range: "bytes=99-" } });
  expect(beyond.status).toBe(416);
  expect(beyond.headers.get("content-range")).toBe("bytes */14");
  const odd = await fetch(`${base}/app.js`, { headers: { range: "lines=1-2" } });
  expect(odd.status).toBe(200);
  expect(await odd.text()).toBe("console.log(1)");
});

test("unknown paths without an extension fall back to index.html", async () => {
  const res = await fetch(`${base}/some/route?token=${token}`);
  expect(res.status).toBe(200);
  expect(await res.text()).toContain("<html");
});

test("unknown files with an extension get 404", async () => {
  expect((await fetch(`${base}/missing.js?token=${token}`)).status).toBe(404);
});

test("path traversal is rejected", async () => {
  writeFileSync(join(dir, "..", "town-secret.txt"), "secret");
  try {
    for (const path of [
      "/../town-secret.txt",
      "/%2e%2e/town-secret.txt",
      "/..%2ftown-secret.txt",
    ].flatMap((p) => [`${p}?token=${token}`, p])) {
      // Raw request so the client does not normalise the path.
      const status = await new Promise<number>((resolve, reject) => {
        const req = request({ host: "127.0.0.1", port: new URL(base).port, path }, (res) => {
          res.resume();
          resolve(res.statusCode ?? 0);
        });
        req.on("error", reject);
        req.end();
      });
      expect(status).not.toBe(200);
      expect([400, 401, 403, 404]).toContain(status);
    }
  } finally {
    rmSync(join(dir, "..", "town-secret.txt"), { force: true });
  }
});

test("unknown methods on known routes get 405", async () => {
  expect((await fetch(`${base}/events?token=${token}`, { method: "POST" })).status).toBe(405);
  expect((await fetch(`${base}/answer?token=${token}`)).status).toBe(405);
  expect((await fetch(`${base}/?token=${token}`, { method: "DELETE" })).status).toBe(405);
});

test("/mcp without a handler gets 404", async () => {
  expect((await fetch(`${base}/mcp?token=${token}`)).status).toBe(404);
});

test("/mcp is handed to the mcp handler", async () => {
  await server.close();
  server = await startTownServer({
    store,
    uiDir: dir,
    mcp: async (req, res) => {
      res.statusCode = 200;
      res.end(`mcp ${req.method}`);
    },
  });
  base = new URL(server.url).origin;
  token = server.token;
  const res = await fetch(`${base}/mcp?token=${token}`, { method: "POST", body: "{}" });
  expect(await res.text()).toBe("mcp POST");
});

test("a throwing mcp handler gets 500", async () => {
  await server.close();
  server = await startTownServer({
    store,
    uiDir: dir,
    mcp: async () => {
      throw new Error("boom");
    },
  });
  base = new URL(server.url).origin;
  token = server.token;
  expect((await fetch(`${base}/mcp?token=${token}`)).status).toBe(500);
});

test("SSE sends the current state on connect and after changes", async () => {
  const events = await openEvents();
  expect(events.res.headers.get("content-type")).toContain("text/event-stream");
  const first = await events.next();
  expect(first.projectName).toBe("my-app");
  expect(first.status).toBeNull();
  store.setStatus("x");
  const second = await events.next();
  expect(second.status).toBe("x");
  events.abort();
});

test("answers resolve the pending ask", async () => {
  const asked = store.ask(q);
  const id = store.getState().pending!.id;
  const res = await post(JSON.stringify({ questionId: id, optionIds: ["nextjs"] }));
  expect(res.status).toBe(204);
  await expect(asked).resolves.toEqual({ optionIds: ["nextjs"] });
});

test("a second tab's late answer gets 409", async () => {
  void store.ask(q);
  const id = store.getState().pending!.id;
  const body = JSON.stringify({ questionId: id, optionIds: ["nextjs"] });
  expect((await post(body)).status).toBe(204);
  expect((await post(body)).status).toBe(409);
});

test("invalid answers get 400", async () => {
  void store.ask(q);
  const id = store.getState().pending!.id;
  expect((await post(JSON.stringify({ questionId: id, optionIds: ["bogus"] }))).status).toBe(400);
});

test("malformed JSON and wrong shapes get 400", async () => {
  expect((await post("{nope")).status).toBe(400);
  expect((await post("null")).status).toBe(400);
  expect((await post("[]")).status).toBe(400);
  expect((await post(JSON.stringify({ optionIds: ["a"] }))).status).toBe(400);
  expect((await post(JSON.stringify({ questionId: "x", optionIds: "a" }))).status).toBe(400);
  expect((await post(JSON.stringify({ questionId: "x", optionIds: [1] }))).status).toBe(400);
  expect((await post(JSON.stringify({ questionId: "plan", action: "dance" }))).status).toBe(400);
  expect((await post(JSON.stringify({ questionId: "x" }))).status).toBe(400);
});

test("plan answers are routed to the store", async () => {
  const plan = store.showPlan({ rows: [], tree: "", generators: [], manualSteps: [] });
  expect((await post(JSON.stringify({ questionId: "plan", action: "build" }))).status).toBe(204);
  await expect(plan).resolves.toEqual({ action: "build" });
});

test("oversized bodies get 413", async () => {
  const big = JSON.stringify({ questionId: "x", optionIds: [], text: "a".repeat(70 * 1024) });
  expect((await post(big)).status).toBe(413);
});

test("binds to 127.0.0.1", () => {
  expect(new URL(server.url).hostname).toBe("127.0.0.1");
});

test("close ends SSE streams and resolves", async () => {
  const events = await openEvents();
  await events.next();
  await server.close();
  const result = await events.reader.read().catch(() => ({ done: true }));
  expect(result.done).toBe(true);
  // afterEach closes again: must be safe.
});

test("a closed SSE client is unsubscribed and does not break later changes", async () => {
  const events = await openEvents();
  await events.next();
  events.abort();
  await new Promise((r) => setTimeout(r, 50));
  expect(() => store.setStatus("after")).not.toThrow();
  const again = await openEvents();
  expect((await again.next()).status).toBe("after");
  again.abort();
});
