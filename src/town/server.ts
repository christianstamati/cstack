// Local HTTP server for one town session: serves the built page, streams the
// town state to it by server-sent events and accepts answers. The MCP handler
// is mounted at /mcp by the caller. Binds to 127.0.0.1 only and every request
// must carry the random session token.
import { randomBytes, timingSafeEqual } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { extname, resolve, sep } from "node:path";

import type { AnswerBody, TownState } from "./protocol.ts";
import type { TownStore } from "./store.ts";

export interface TownServer {
  url: string;
  mcpUrl: string;
  token: string;
  close(): Promise<void>;
}

export interface StartTownServerInput {
  store: TownStore;
  uiDir: string;
  mcp?: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
}

const MAX_BODY_BYTES = 64 * 1024;
const KEEP_ALIVE_MS = 15_000;

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
};

function send(
  res: ServerResponse,
  status: number,
  body: string | Buffer = "",
  headers: Record<string, string> = {},
) {
  if (res.headersSent) {
    res.end();
    return;
  }
  res.writeHead(status, { "cache-control": "no-store", ...headers });
  res.end(body);
}

function methodNotAllowed(res: ServerResponse, allow: string) {
  send(res, 405, "Method Not Allowed", { allow });
}

class BodyTooLargeError extends Error {}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolveBody, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let failed = false;
    req.on("data", (chunk: Buffer) => {
      if (failed) return;
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        failed = true;
        chunks.length = 0;
        reject(new BodyTooLargeError());
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (!failed) resolveBody(Buffer.concat(chunks).toString("utf8"));
    });
    req.on("error", (error) => {
      if (!failed) reject(error);
    });
  });
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

/** Checks the request body has the shape of an AnswerBody; the store checks the meaning. */
function parseAnswerBody(raw: string): AnswerBody | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  if (typeof body.questionId !== "string") return null;
  if (body.questionId === "plan") {
    if (body.action === "build") return { questionId: "plan", action: "build" };
    if (body.action === "change" && typeof body.slot === "string") {
      return { questionId: "plan", action: "change", slot: body.slot as never };
    }
    return null;
  }
  if (!isStringArray(body.optionIds)) return null;
  if (body.text !== undefined && typeof body.text !== "string") return null;
  return body.text === undefined
    ? { questionId: body.questionId, optionIds: body.optionIds }
    : { questionId: body.questionId, optionIds: body.optionIds, text: body.text };
}

export async function startTownServer(input: StartTownServerInput): Promise<TownServer> {
  const { store, mcp } = input;
  const uiRoot = resolve(input.uiDir);
  const token = randomBytes(32).toString("hex");
  const tokenBuffer = Buffer.from(token);
  const streams = new Set<ServerResponse>();
  let closing: Promise<void> | null = null;

  const hasToken = (candidate: string | null): boolean => {
    if (candidate === null) return false;
    const given = Buffer.from(candidate);
    return given.length === tokenBuffer.length && timingSafeEqual(given, tokenBuffer);
  };

  const handleEvents = (req: IncomingMessage, res: ServerResponse) => {
    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-store",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    });
    streams.add(res);
    // The store does not guard its listeners, so this one must never throw.
    const write = (chunk: string) => {
      if (res.writableEnded || res.destroyed) return;
      try {
        res.write(chunk);
      } catch {
        // The client is gone; `close` below cleans up.
      }
    };
    const sendState = (state: TownState) => write(`data: ${JSON.stringify(state)}\n\n`);
    const unsubscribe = input.store.subscribe(sendState);
    const keepAlive = setInterval(() => write(": keep-alive\n\n"), KEEP_ALIVE_MS);
    keepAlive.unref();
    const cleanup = () => {
      clearInterval(keepAlive);
      unsubscribe();
      streams.delete(res);
    };
    res.on("close", cleanup);
    req.on("error", cleanup);
    res.on("error", cleanup);
    sendState(store.getState());
  };

  const handleAnswer = async (req: IncomingMessage, res: ServerResponse) => {
    let raw: string;
    try {
      raw = await readBody(req);
    } catch (error) {
      if (error instanceof BodyTooLargeError) {
        res.once("finish", () => req.destroy());
        send(res, 413, "Payload Too Large", { connection: "close" });
      } else {
        send(res, 400, "Bad Request");
      }
      return;
    }
    const body = parseAnswerBody(raw);
    if (!body) {
      send(res, 400, "Bad Request");
      return;
    }
    const outcome = store.answer(body);
    if (outcome === "ok") send(res, 204);
    else if (outcome === "stale") send(res, 409, "Conflict");
    else send(res, 400, "Bad Request");
  };

  const handleStatic = async (pathname: string, res: ServerResponse) => {
    let decoded: string;
    try {
      decoded = decodeURIComponent(pathname);
    } catch {
      send(res, 400, "Bad Request");
      return;
    }
    if (decoded.includes("\0")) {
      send(res, 400, "Bad Request");
      return;
    }
    const target = resolve(uiRoot, "." + decoded);
    if (target !== uiRoot && !target.startsWith(uiRoot + sep)) {
      send(res, 403, "Forbidden");
      return;
    }
    const ext = extname(target).toLowerCase();
    let file = target;
    let isFile = false;
    try {
      isFile = (await stat(target)).isFile();
    } catch {
      isFile = false;
    }
    if (!isFile) {
      if (ext !== "") {
        send(res, 404, "Not Found");
        return;
      }
      file = resolve(uiRoot, "index.html");
    }
    try {
      const data = await readFile(file);
      const type = CONTENT_TYPES[extname(file).toLowerCase()] ?? "application/octet-stream";
      send(res, 200, data, { "content-type": type });
    } catch {
      send(res, 404, "Not Found");
    }
  };

  const route = async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    if (!hasToken(url.searchParams.get("token"))) {
      send(res, 401, "Unauthorized");
      return;
    }
    const method = req.method ?? "GET";
    switch (url.pathname) {
      case "/events":
        if (method !== "GET") return methodNotAllowed(res, "GET");
        return handleEvents(req, res);
      case "/answer":
        if (method !== "POST") return methodNotAllowed(res, "POST");
        return handleAnswer(req, res);
      case "/mcp":
        if (!mcp) return send(res, 404, "Not Found");
        return mcp(req, res);
      default:
        if (method !== "GET" && method !== "HEAD") return methodNotAllowed(res, "GET, HEAD");
        return handleStatic(url.pathname, res);
    }
  };

  const server: Server = createServer((req, res) => {
    route(req, res).catch(() => {
      send(res, 500, "Internal Server Error");
    });
  });

  await new Promise<void>((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", rejectListen);
      resolveListen();
    });
  });
  const { port } = server.address() as AddressInfo;
  const origin = `http://127.0.0.1:${port}`;

  return {
    url: `${origin}/?token=${token}`,
    mcpUrl: `${origin}/mcp?token=${token}`,
    token,
    close() {
      closing ??= new Promise<void>((resolveClose) => {
        for (const res of streams) res.end();
        server.close(() => resolveClose());
        server.closeAllConnections();
      });
      return closing;
    },
  };
}
