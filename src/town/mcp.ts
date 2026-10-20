// The `cstack` MCP server: the tools the agent uses to drive the town. Served over
// Streamable HTTP in stateless mode (a fresh server and transport per request),
// which is all the tools need and keeps a pending `ask` tied to its own request.
import type { IncomingMessage, ServerResponse } from "node:http";
import { McpServer } from "@modelcontextprotocol/server";
import { NodeStreamableHTTPServerTransport } from "@modelcontextprotocol/node";
import * as z from "zod/v4";

import { SLOTS, type SlotId } from "./catalog.ts";
import { AgentStoppedError, type TownStore } from "./store.ts";

const slot = z.enum(SLOTS.map((s) => s.id) as [SlotId, ...SlotId[]]);

type ToolResult = { content: { type: "text"; text: string }[]; isError?: true };

const text = (value: string): ToolResult => ({ content: [{ type: "text", text: value }] });
const json = (value: unknown): ToolResult => text(JSON.stringify(value));
const failure = (message: string): ToolResult => ({ ...text(message), isError: true });

/** Runs a tool body; an AgentStoppedError (or any throw) becomes an error result. */
async function guard(run: () => ToolResult | Promise<ToolResult>): Promise<ToolResult> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof AgentStoppedError) return failure(error.message);
    return failure(error instanceof Error ? error.message : String(error));
  }
}

function createServer(store: TownStore): McpServer {
  const server = new McpServer({ name: "cstack", version: "1.0.0" });

  server.registerTool(
    "ask",
    {
      description:
        "Ask the user one question in the town. Waits until the user answers in their browser, " +
        "which can take minutes: do not continue before it returns. Returns JSON " +
        '{ "optionIds": string[], "text"?: string }. Use the answer as given.',
      inputSchema: z.strictObject({
        slot: slot
          .nullable()
          .describe("The slot this question fills, or null if it is not a stack choice."),
        question: z.string(),
        quip: z.string().optional().describe("One short funny line, never mocking the user."),
        options: z
          .array(
            z.object({
              id: z.string(),
              label: z.string().describe("At most 24 characters."),
              description: z.string().optional().describe("One line."),
              recommended: z.boolean().optional(),
            }),
          )
          .default([]),
        multiSelect: z.boolean().default(false),
        freeText: z.boolean().default(false),
      }),
    },
    (args, ctx) => guard(async () => json(await store.ask(args, ctx.mcpReq.signal))),
  );

  server.registerTool(
    "decide",
    {
      description:
        "Report an answer you settled without asking (a preset, a forced choice, a skipped " +
        'question), with the reason. For a slot that does not apply, pass optionIds: [] and labels: ["Not needed"].',
      inputSchema: z.strictObject({
        slot,
        optionIds: z.array(z.string()),
        labels: z.array(z.string()),
        reason: z.string(),
      }),
    },
    (args) =>
      guard(() => {
        store.decide(args);
        return text("ok");
      }),
  );

  server.registerTool(
    "plan",
    {
      description:
        "Show the plan for approval (Phase 2). Waits until the user approves or asks to change " +
        'a choice, which can take minutes. Returns JSON { "action": "build" } or { "action": "change", "slot": string }.',
      inputSchema: z.strictObject({
        rows: z.array(z.object({ label: z.string(), value: z.string(), auto: z.boolean() })),
        tree: z.string(),
        generators: z.array(z.string()),
        manualSteps: z.array(z.string()),
      }),
    },
    (args, ctx) => guard(async () => json(await store.showPlan(args, ctx.mcpReq.signal))),
  );

  server.registerTool(
    "progress",
    {
      description:
        "Report a build step (Phase 3): once with status started, again with done or failed, " +
        "listing the slots the step builds.",
      inputSchema: z.strictObject({
        name: z.string(),
        slots: z.array(slot),
        status: z.enum(["started", "done", "failed"]),
        message: z.string().optional(),
      }),
    },
    (args) =>
      guard(() => {
        store.progress(args);
        return text("ok");
      }),
  );

  server.registerTool(
    "report",
    {
      description:
        "Send the final report (Phase 4). Give each manual step the slot it belongs to, or null.",
      inputSchema: z.strictObject({
        built: z.array(z.string()),
        commands: z.array(z.string()),
        manualSteps: z.array(z.object({ slot: slot.nullable(), text: z.string() })),
        unverified: z.array(z.string()),
      }),
    },
    (args) =>
      guard(() => {
        store.report(args);
        return text("ok");
      }),
  );

  server.registerTool(
    "status",
    {
      description:
        "Show one short line of what you are doing, before any work that takes more than a few seconds.",
      inputSchema: z.strictObject({ text: z.string() }),
    },
    (args) =>
      guard(() => {
        store.setStatus(args.text);
        return text("ok");
      }),
  );

  return server;
}

export function createMcpHandler(
  store: TownStore,
): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  return async (req, res) => {
    const server = createServer(store);
    // Stateless: no session id. SSE keep-alive frames (the transport default) keep a
    // long-waiting `ask` or `plan` response alive.
    const transport = new NodeStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res);
  };
}
