# cstack town Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `@cstack-dev/create` into `@cstack-dev/town`, whose `create` subcommand runs the bootstrap interview through a low-poly 3D town in the browser by default, with the text interview behind `--terminal`.

**Architecture:** The CLI process hosts one local HTTP server holding the town state. It serves the built React Three Fiber page, streams state to it by server-sent events, accepts answers by POST, and exposes the cstack tools to the agent as an MCP server over Streamable HTTP. The agent (Claude Code or Codex) runs interactively in the terminal with that MCP server and a scoped permission policy. All town code loads by dynamic import, so `--terminal` never touches it.

**Tech Stack:** TypeScript, Node 20.12+, Vite+ (`vp check`, `vp test`, `vp pack`, `vp build`), MCP TypeScript SDK, React, three.js, React Three Fiber.

**Spec:** `docs/superpowers/specs/2026-10-20-town-ui-design.md`

## Global Constraints

- Package name `@cstack-dev/town`, bin `town`, command shape `town create <dir> [options] [-- agent args]`.
- Runtime: Node `>=20.12.0`. The published bin is a `vp pack` bundle; `package.json` keeps no runtime `dependencies` (everything is bundled from `devDependencies`).
- Town code (server, MCP, page) is loaded only through dynamic `import()`; `--terminal` must not load it.
- Server binds `127.0.0.1` on a free port (port `0`), and every request needs the random `token` query parameter.
- Published tarball under 3 MB, measured as `3 * 1024 * 1024` bytes; the publish fails above it.
- Music: "Lofi Hip Hop Loop" by OMF-Games, https://opengameart.org/content/lofi-hip-hop-loop, CC0. Credit line on the page and in the README: `Music: "Lofi Hip Hop Loop" by OMF-Games (CC0)`.
- Never use the agents' skip-all-permissions modes (`--dangerously-skip-permissions`, `--dangerously-bypass-approvals-and-sandbox`).
- No 3D text: billboard, labels and signs are HTML overlays (no runtime font fetching).
- Desktop browsers only. Original models and world; Bruno Simon's site is a mood reference only.
- Install dependencies at their latest versions with `bun add -d`; never pin versions from memory. Check each library's current docs for APIs.
- Follow `CLAUDE.md`: edit `.github/*.md` prompts, then `bun run sync-prompt`; run `vp check` and `vp test` before each commit.

## Review Focus

1. **Two `ask` calls at once** (the agent makes parallel tool calls): questions queue and show one at a time, each answer returns to its own call. Test in Task 3.
2. **The page open in two tabs:** both show the same state; the first answer wins and the second gets `409` and re-syncs. Test in Task 4.
3. **The agent exits or crashes while a question is pending:** pending calls reject, the page shows "The agent stopped", the server closes. Test in Task 3 and Task 6.
4. **A stale or invalid answer** (wrong `questionId`, an option id not in the question, empty free text): rejected with `400`, nothing changes. Test in Task 3 and Task 4.
5. **The browser can't open** (no default browser, `--no-open`, SSH with port forwarding): the URL is always printed and the run continues. Test in Task 6.

---

## File Structure

```
.github/BOOTSTRAP.md          prompt (renamed references)
.github/TOWN.md               NEW town-mode prompt section, appended in town mode
scripts/sync-prompt.ts        syncs both prompts into src/*.ts
scripts/check-pack-size.ts    NEW fails over 3 MB
src/index.ts                  bin entry: parse, dispatch, error handling
src/args.ts                   subcommand + option parsing, usage text
src/create.ts                 NEW `create` flow (moved from index.ts), terminal vs town
src/prompt.ts                 fill prompt, launch prompt, defaults (unchanged API)
src/machine.ts, src/agent.ts  unchanged except runAgent env support
src/town-prompt.ts            NEW generated from .github/TOWN.md
src/town/catalog.ts           NEW slots, lots, option ids (shared with the page)
src/town/protocol.ts          NEW state and answer types (shared with the page)
src/town/store.ts             NEW TownStore: state, question queue, answers
src/town/server.ts            NEW HTTP: page, SSE, answers, MCP endpoint, token
src/town/mcp.ts               NEW MCP tools bound to the store
src/town/launch.ts            NEW agent args/env for MCP + permissions, startup summary
src/town/fallback.ts          NEW decides whether the town can be shown
src/town/open-browser.ts      NEW best-effort browser open
src/town/run.ts               NEW wires store + server + browser + agent
ui/                           NEW Vite app (React Three Fiber), built to dist/ui
  index.html, vite.config.ts, src/main.tsx, src/App.tsx
  src/use-town.ts             SSE subscription + postAnswer
  src/logic.ts                pure view logic (stages, theme, signs)
  src/scene/*.tsx             island, lots, lighting, crane, camera
  src/buildings/*.tsx         one component per option + generic
  src/hud/*.tsx               billboard, entry screen, mute, credits, signs
  public/music/               the loop
tests/                        node tests; ui/src/*.test.ts for page logic
```

---

### Task 1: Rename to `@cstack-dev/town` with the `create` subcommand

**Files:**

- Modify: `package.json`, `src/args.ts`, `src/index.ts`, `.github/BOOTSTRAP.md`, `README.md`, `CLAUDE.md`
- Create: `src/create.ts`
- Test: `tests/args.test.ts`

**Interfaces:**

- Produces:
  - `type Command = "create" | "help"`
  - `interface CliOptions { command: Command; dir?: string; agent?: AgentId; model?: string; config?: string; defaults: boolean; terminal: boolean; open: boolean; askEverything: boolean; agentArgs: ReadonlyArray<string> }`
  - `parseCliArgs(argv: ReadonlyArray<string>): CliOptions` (throws `UsageError`)
  - `USAGE: string`, `CREATE_USAGE: string`
  - `createProject(options: CliOptions): Promise<number>` in `src/create.ts` (today's `main` body; town branch added in Task 6)

- [ ] **Step 1: Rewrite `tests/args.test.ts` for the new shape**

```ts
test("create takes a directory and options", () => {
  expect(parseCliArgs(["create", "my-app", "--agent", "codex", "--model", "o5"])).toMatchObject({
    command: "create",
    dir: "my-app",
    agent: "codex",
    model: "o5",
    terminal: false,
    open: true,
    askEverything: false,
    agentArgs: [],
  });
});
test("town flags", () => {
  expect(
    parseCliArgs(["create", "a", "--terminal", "--no-open", "--ask-everything"]),
  ).toMatchObject({ terminal: true, open: false, askEverything: true });
});
test("no command or --help prints help", () => {
  expect(parseCliArgs([]).command).toBe("help");
  expect(parseCliArgs(["--help"]).command).toBe("help");
});
test("create --help is help for create", () => {
  expect(parseCliArgs(["create", "--help"])).toMatchObject({ command: "help", dir: undefined });
});
test("update is not available yet", () => {
  expect(() => parseCliArgs(["update"])).toThrow(/later version/);
});
test("unknown commands and bad input are usage errors", () => {
  expect(() => parseCliArgs(["make", "x"])).toThrow(UsageError);
  expect(() => parseCliArgs(["create", "--agent", "cursor"])).toThrow(UsageError);
  expect(() => parseCliArgs(["create", "a", "b"])).toThrow(UsageError);
  expect(() => parseCliArgs(["create", "--defaults", "--config", "x.json"])).toThrow(UsageError);
});
test("everything after -- goes to the agent", () => {
  expect(parseCliArgs(["create", "a", "--", "--permission-mode", "plan"]).agentArgs).toEqual([
    "--permission-mode",
    "plan",
  ]);
});
```

Keep the existing `isValidProjectName` test.

- [ ] **Step 2: Run** `vp test tests/args.test.ts` — Expected: FAIL (`command` missing).

- [ ] **Step 3: Implement the parser and move the flow**
  - `src/args.ts`: first positional is the command. `"create"` → create; `"update"` → `UsageError("town update is coming in a later version. For now: town create <dir>")`; nothing or `--help` → `"help"`; anything else → `UsageError`. `--no-open` maps to `open: false` (use `parseArgs` with `allowNegative: true` on `open`, or a separate boolean). `CREATE_USAGE` documents every flag; `USAGE` lists commands (`create`, `update (coming later)`).
  - `src/create.ts`: move everything after option parsing from `main` in `src/index.ts` into `createProject(options)`. Behaviour unchanged for now (it always runs the terminal path).
  - `src/index.ts`: parse, print `USAGE` or `CREATE_USAGE` for help (create's when the command was `create --help`; add `helpFor?: "create"` to `CliOptions` if needed), else `createProject`. Keep the `UsageError` / `CliError` handling (move `CliError` to `src/create.ts` and export it).

- [ ] **Step 4: Rename**
  - `package.json`: `"name": "@cstack-dev/town"`, `"bin": { "town": "dist/index.mjs" }`, `"version": "0.2.0"`, description `"Build your stack as a little 3D town with Claude Code or Codex"`.
  - `.github/BOOTSTRAP.md`: replace `create-cstack --defaults` / `--config <file>` with `town create --defaults` / `--config <file>`, and `create-cstack` with `town create` everywhere. Run `bun run sync-prompt`.
  - `README.md` and `CLAUDE.md`: new name and `npx @cstack-dev/town create my-app` (and `bunx`, `pnpm dlx` forms). Remove the `npm create @cstack-dev` line.

- [ ] **Step 5: Run** `vp check && vp test` — Expected: PASS. Then `bun src/index.ts create /tmp/x --terminal --help` prints create usage.

- [ ] **Step 6: Commit** — `git commit -m "feat!: rename to @cstack-dev/town with a create subcommand"`

---

### Task 2: Catalog, protocol types and the town-mode prompt

**Files:**

- Create: `src/town/catalog.ts`, `src/town/protocol.ts`, `.github/TOWN.md`, `src/town-prompt.ts` (generated)
- Modify: `scripts/sync-prompt.ts`, `src/prompt.ts`
- Test: `tests/town-prompt.test.ts`

**Interfaces:**

- Produces (`src/town/catalog.ts`, imported by server and page; no Node imports):
  - `type SlotId = "name" | "structure" | "toolchain" | "packageManager" | "frontend" | "data" | "api" | "database" | "deploy" | "dbHost" | "auth" | "authMethods" | "ui" | "extras"`
  - `interface SlotDef { id: SlotId; label: string; kind: "building" | "sign" | "paint" | "props"; lot: [x: number, z: number]; options: ReadonlyArray<{ id: string; label: string }> }`
  - `const SLOTS: ReadonlyArray<SlotDef>` — option ids exactly as `config.json` values in `BOOTSTRAP.md` (e.g. frontend `nextjs`, `tanstack-start`; data `none`, `convex`, `payload`, `drizzle`; api `builtin`, `orpc`, `trpc`, `hono`, `elysia`, `nestjs`; authMethods `google`, `github`, `password`, `magic-link`; extras `example`, `ci`, `env`, `tests`, `agent-docs`). `name` (kind `sign`) and `ui` (kind `paint`) have no options.
  - `slotById(id: SlotId): SlotDef`
- Produces (`src/town/protocol.ts`):
  - `interface TownOption { id: string; label: string; description?: string; recommended?: boolean }`
  - `interface Question { id: string; slot: SlotId | null; question: string; quip?: string; options: TownOption[]; multiSelect: boolean; freeText: boolean }`
  - `interface Placement { slot: SlotId; optionIds: string[]; labels: string[]; auto: boolean; reason?: string }`
  - `interface PlanView { rows: { label: string; value: string; auto: boolean }[]; tree: string; generators: string[]; manualSteps: string[] }`
  - `interface BuildStep { name: string; slots: SlotId[]; status: "started" | "done" | "failed"; message?: string }`
  - `interface ReportView { built: string[]; commands: string[]; manualSteps: { slot: SlotId | null; text: string }[]; unverified: string[] }`
  - `type Phase = "interview" | "plan" | "build" | "done"`
  - `interface TownState { projectName: string; phase: Phase; placements: Partial<Record<SlotId, Placement>>; pending: Question | null; plan: PlanView | null; steps: BuildStep[]; report: ReportView | null; status: string | null; lastAgentActivity: number; agentStopped: boolean }`
  - `type AnswerBody = { questionId: string; optionIds: string[]; text?: string } | { questionId: "plan"; action: "build" } | { questionId: "plan"; action: "change"; slot: SlotId }`
- Produces (`src/prompt.ts`): `fillBootstrapPrompt(facts, options?: { town: boolean }): string` — appends `TOWN_PROMPT` (from `src/town-prompt.ts`) after a blank line when `town` is true.

- [ ] **Step 1: Write `tests/town-prompt.test.ts`**

```ts
test("TOWN.md is embedded byte for byte", () => {
  expect(TOWN_PROMPT).toBe(readFileSync(join(import.meta.dirname, "../.github/TOWN.md"), "utf8"));
});
test("TOWN.md names every slot and option id in the catalog", () => {
  for (const slot of SLOTS) {
    expect(TOWN_PROMPT).toContain(`\`${slot.id}\``);
    for (const option of slot.options) expect(TOWN_PROMPT).toContain(`\`${option.id}\``);
  }
});
test("town mode appends the section; terminal mode doesn't", () => {
  expect(fillBootstrapPrompt(facts, { town: true })).toContain(TOWN_PROMPT);
  expect(fillBootstrapPrompt(facts)).not.toContain("# Town mode");
});
test("catalog lots are unique", () => {
  const lots = SLOTS.map((s) => s.lot.join(","));
  expect(new Set(lots).size).toBe(lots.length);
});
```

- [ ] **Step 2: Run** `vp test tests/town-prompt.test.ts` — Expected: FAIL (modules missing).

- [ ] **Step 3: Write `.github/TOWN.md`** starting with `# Town mode`. It overrides the Phase 1 question rule and tells the agent, in this order:
  1. The user is answering in a 3D town in the browser, not the terminal. Ask every question (including Q0, the plan approval, conflicts, preset codes, "install X then continue", and blocked steps after 3 attempts) with the `ask` tool of the `cstack` MCP server. Never ask in the terminal and never use `AskUserQuestion`.
  2. Use `slot` ids and option ids from the table (one row per slot, listing every option id in backticks). Pass `slot: null` for questions that aren't a stack choice. Use `freeText: true` for the project name and preset codes.
  3. Labels at most 24 characters, descriptions one line, an optional `quip` (one short funny line, never mocking the user).
  4. Call `decide` for every answer settled without asking, with the reason.
  5. Phase 2: call `plan` and follow its result (`build`, or `change` with the slot to re-ask).
  6. Phase 3: call `progress` with `started` and `done`/`failed` for each numbered step, listing the slots it builds. Finish Phase 4 with `report`; give each manual step its slot.
  7. Call `status` with one short line before any work that takes more than a few seconds.

  Extend `scripts/sync-prompt.ts` to also generate `src/town-prompt.ts` exporting `TOWN_PROMPT` (same escaping). Run `bun run sync-prompt`.

- [ ] **Step 4: Implement** `src/town/catalog.ts`, `src/town/protocol.ts` and the `town` option of `fillBootstrapPrompt`. Lots: place the 14 slots on a rough ring around the island centre, `name` at the entrance.

- [ ] **Step 5: Run** `vp check && vp test` — Expected: PASS.

- [ ] **Step 6: Commit** — `git commit -m "feat: add the town catalog, protocol types and town-mode prompt"`

---

### Task 3: TownStore

**Files:**

- Create: `src/town/store.ts`
- Test: `tests/town-store.test.ts`

**Interfaces:**

- Consumes: protocol types from Task 2.
- Produces:
  - `class TownStore { constructor(projectName: string, now?: () => number) }`
  - `getState(): TownState` (a snapshot; `pending` is the head of the queue)
  - `subscribe(listener: (state: TownState) => void): () => void`
  - `ask(input: Omit<Question, "id">): Promise<{ optionIds: string[]; text?: string }>`
  - `decide(input: { slot: SlotId; optionIds: string[]; labels: string[]; reason: string }): void`
  - `showPlan(plan: PlanView): Promise<{ action: "build" } | { action: "change"; slot: SlotId }>`
  - `progress(step: BuildStep): void`, `report(report: ReportView): void`, `setStatus(text: string): void`
  - `answer(body: AnswerBody): "ok" | "stale" | "invalid"`
  - `agentStopped(): void`
  - `class AgentStoppedError extends Error`

- [ ] **Step 1: Write tests**

```ts
test("ask waits for the matching answer and places a building", async () => {
  const store = new TownStore("my-app");
  const result = store.ask({ slot: "frontend", question: "Frontend?", options: [opt("nextjs"), opt("tanstack-start")], multiSelect: false, freeText: false });
  const id = store.getState().pending!.id;
  expect(store.answer({ questionId: id, optionIds: ["nextjs"] })).toBe("ok");
  await expect(result).resolves.toEqual({ optionIds: ["nextjs"] });
  expect(store.getState().placements.frontend).toMatchObject({ optionIds: ["nextjs"], auto: false });
  expect(store.getState().pending).toBeNull();
});
test("parallel asks queue and resolve in order", async () => { /* two asks; pending is the first; answering it exposes the second */ });
test("stale and invalid answers change nothing", () => {
  // wrong questionId -> "stale"; unknown option id, two ids on single-select, empty text on freeText -> "invalid"
});
test("a no-slot question places nothing", async () => { /* slot: null, answer, placements unchanged */ });
test("decide places an auto building", () => {
  store.decide({ slot: "database", optionIds: ["convex"], labels: ["Built into Convex"], reason: "Convex" });
  expect(store.getState().placements.database).toMatchObject({ auto: true, reason: "Convex" });
});
test("plan moves to the plan phase and returns build or change", async () => { /* showPlan; answer {questionId:"plan",action:"change",slot:"deploy"} -> resolves; phase back to "interview" on change, "build" on build */ });
test("progress, report and status update state and lastAgentActivity", () => { /* report sets phase "done" */ });
test("agentStopped rejects pending calls and marks the state", async () => {
  const pending = store.ask({ ... });
  store.agentStopped();
  await expect(pending).rejects.toBeInstanceOf(AgentStoppedError);
  expect(store.getState().agentStopped).toBe(true);
});
test("subscribers get a snapshot on every change", () => { /* count calls */ });
```

- [ ] **Step 2: Run** `vp test tests/town-store.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement `TownStore`.** Question ids from `crypto.randomUUID()`. Every agent-facing call (`ask`, `decide`, `showPlan`, `progress`, `report`, `setStatus`) sets `lastAgentActivity = now()`. Answering a building slot replaces its placement (re-answering after "change" swaps the building).

- [ ] **Step 4: Run** `vp test tests/town-store.test.ts` — Expected: PASS.

- [ ] **Step 5: Commit** — `git commit -m "feat: add the town store with a question queue"`

---

### Task 4: Town HTTP server (page, SSE, answers)

**Files:**

- Create: `src/town/server.ts`
- Test: `tests/town-server.test.ts`

**Interfaces:**

- Consumes: `TownStore` (Task 3).
- Produces:
  - `interface TownServer { url: string; mcpUrl: string; token: string; close(): Promise<void> }`
  - `startTownServer(input: { store: TownStore; uiDir: string; mcp?: (req: IncomingMessage, res: ServerResponse) => Promise<void> }): Promise<TownServer>`
  - Routes (all require `?token=`; otherwise `401`): `GET /` and static files from `uiDir` (`index.html` fallback for unknown paths without an extension); `GET /events` SSE, sends the full `TownState` as `data:` on connect and on every change, plus a comment keep-alive every 15 s; `POST /answer` JSON `AnswerBody` → `204` ok, `409` stale, `400` invalid; `ALL /mcp` → `mcp` handler (Task 5).
  - `url` = `http://127.0.0.1:<port>/?token=<token>`, `mcpUrl` = `http://127.0.0.1:<port>/mcp?token=<token>`. Token: 32 random bytes, hex.

- [ ] **Step 1: Write tests** (start on port 0 with a temp `uiDir` holding `index.html`)

```ts
test("requests without the token get 401", async () => {
  expect((await fetch(base + "/")).status).toBe(401);
});
test("serves the page with the token", async () => {
  expect(await (await fetch(server.url)).text()).toContain("<html");
});
test("SSE sends the current state on connect and after changes", async () => {
  /* read first event, store.setStatus("x"), read next event has status "x" */
});
test("answers resolve the pending ask", async () => {
  /* store.ask(...); POST /answer -> 204; ask resolves */
});
test("a second tab's late answer gets 409", async () => {
  /* answer twice with the same id -> 204 then 409 */
});
test("invalid answers get 400", async () => {
  /* unknown option id */
});
test("binds to 127.0.0.1", () => {
  expect(new URL(server.url).hostname).toBe("127.0.0.1");
});
test("close ends SSE streams", async () => {
  /* stream ends */
});
```

- [ ] **Step 2: Run** `vp test tests/town-server.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement** with `node:http` (no framework). Static files: resolve inside `uiDir` only (reject `..`), set content types for `.html .js .css .mp3 .ogg .svg .png .woff2`. Compare tokens with `crypto.timingSafeEqual`.

- [ ] **Step 4: Run** — Expected: PASS.

- [ ] **Step 5: Commit** — `git commit -m "feat: add the local town server"`

---

### Task 5: MCP tools

**Files:**

- Create: `src/town/mcp.ts`
- Modify: `package.json` (devDependencies)
- Test: `tests/town-mcp.test.ts`

**Interfaces:**

- Consumes: `TownStore` (Task 3), `startTownServer({ mcp })` (Task 4), catalog `SlotId` values (Task 2).
- Produces: `createMcpHandler(store: TownStore): (req: IncomingMessage, res: ServerResponse) => Promise<void>` — an MCP server named `cstack` over Streamable HTTP with tools `ask`, `decide`, `plan`, `progress`, `report`, `status`. Inputs mirror the store methods; `slot` is validated against catalog ids. `ask` returns `{ optionIds, text? }` as JSON text content; `plan` returns `{ action, slot? }`; the others return `"ok"`. Tool descriptions say `ask` and `plan` wait for the user.

- [ ] **Step 1: Add the SDK.** `bun add -d` the current MCP TypeScript SDK (check npm and its README for the package name and the Streamable HTTP server transport; it may be split into server/client packages) plus its schema library if required.

- [ ] **Step 2: Write tests** using the SDK's client over Streamable HTTP against a real `startTownServer`:

```ts
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
  const call = client.callTool({
    name: "ask",
    arguments: {
      slot: "deploy",
      question: "Deploy?",
      options: [{ id: "vercel", label: "Vercel" }],
      multiSelect: false,
      freeText: false,
    },
  });
  await waitFor(() => store.getState().pending);
  store.answer({ questionId: store.getState().pending!.id, optionIds: ["vercel"] });
  expect(JSON.parse(textOf(await call))).toEqual({ optionIds: ["vercel"] });
});
test("an unknown slot is a tool error", async () => {
  /* slot "kitchen" -> isError */
});
test("decide places an auto building", async () => {
  /* ... */
});
```

- [ ] **Step 3: Run** `vp test tests/town-mcp.test.ts` — Expected: FAIL.

- [ ] **Step 4: Implement `createMcpHandler`.** Use whichever transport mode the SDK documents for long-running tool calls; make sure a call that waits 10 minutes isn't closed by the server (no server-side request timeout on `/mcp`; send keep-alives if the transport supports them).

- [ ] **Step 5: Run** — Expected: PASS. Confirm `vp pack` still builds and `dist/index.mjs` doesn't import the SDK at the top level (grep the entry chunk).

- [ ] **Step 6: Commit** — `git commit -m "feat: expose the cstack tools over MCP"`

---

### Task 6: Launching the agent in town mode

**Files:**

- Create: `src/town/launch.ts`, `src/town/fallback.ts`, `src/town/open-browser.ts`, `src/town/run.ts`
- Modify: `src/create.ts`, `src/agent.ts` (`runAgent` accepts `env`)
- Test: `tests/town-launch.test.ts`, `tests/town-fallback.test.ts`

**Interfaces:**

- Consumes: `startTownServer`, `createMcpHandler`, `TownStore`, `fillBootstrapPrompt(facts, { town })`, `CliOptions`.
- Produces:
  - `townUnavailableReason(input: { stdinTTY: boolean; stdoutTTY: boolean; env: Record<string, string | undefined>; open: boolean }): string | null` — `"no interactive terminal"` if either stream isn't a TTY; `"running in CI"` if `env.CI` is set and not `"false"`/`"0"`; `"SSH session"` if `SSH_CONNECTION` or `SSH_TTY` is set **and** `open` is true (with `--no-open` the user opens the URL themselves, e.g. through a forwarded port); else `null`.
  - `townLaunch(agent: AgentId, input: { mcpUrl: string; askEverything: boolean }): { args: string[]; env: Record<string, string>; allowed: string[] }`
  - `ALLOWED_COMMANDS = ["npm", "pnpm", "yarn", "bun", "npx", "bunx", "pnpm dlx", "yarn dlx", "git", "vp", "docker compose"]`
  - `openBrowser(url: string, opener?: readonly [command: string, ...args: string[]]): Promise<boolean>` — default opener `open` on macOS, `cmd /c start ""` on Windows, `xdg-open` elsewhere (URL appended); resolves `false` on any failure or non-zero exit, never throws.
  - `runTown(input: { options: CliOptions; projectDir: string; projectName: string; agent: Agent; launchPrompt: string }): Promise<number>`

- [ ] **Step 1: Write tests**

```ts
// fallback
test.each([
  [{ stdinTTY: false, stdoutTTY: true, env: {}, open: true }, "no interactive terminal"],
  [{ stdinTTY: true, stdoutTTY: true, env: { CI: "true" }, open: true }, "running in CI"],
  [{ stdinTTY: true, stdoutTTY: true, env: { SSH_CONNECTION: "x" }, open: true }, "SSH session"],
  [{ stdinTTY: true, stdoutTTY: true, env: { SSH_CONNECTION: "x" }, open: false }, null],
  [{ stdinTTY: true, stdoutTTY: true, env: { CI: "false" }, open: true }, null],
])("townUnavailableReason %#", (input, expected) =>
  expect(townUnavailableReason(input)).toBe(expected),
);

// open-browser
test("a missing opener resolves false instead of throwing", async () => {
  await expect(openBrowser("http://127.0.0.1:1/", ["definitely-not-a-command-xyz"])).resolves.toBe(
    false,
  );
});

// launch: claude
test("claude gets the MCP server, accept-edits and the allowlist", () => {
  const { args, env, allowed } = townLaunch("claude", { mcpUrl: URL_, askEverything: false });
  expect(args).toContain("--mcp-config");
  expect(JSON.parse(args[args.indexOf("--mcp-config") + 1])).toEqual({
    mcpServers: { cstack: { type: "http", url: URL_ } },
  });
  expect(args).toEqual(expect.arrayContaining(["--permission-mode", "acceptEdits"]));
  expect(args.join(" ")).toContain("mcp__cstack__ask");
  expect(args.join(" ")).toContain("Bash(npx *)");
  expect(env.MCP_TOOL_TIMEOUT).toBeDefined();
  expect(allowed).toContain("npx (runs any npm package)");
  expect(args.join(" ")).not.toMatch(/dangerously/);
});
test("claude with --ask-everything only allows the cstack tools", () => {
  const { args } = townLaunch("claude", { mcpUrl: URL_, askEverything: true });
  expect(args).not.toContain("acceptEdits");
  expect(args.join(" ")).not.toContain("Bash(");
  expect(args.join(" ")).toContain("mcp__cstack__ask");
});
// launch: codex
test("codex gets the MCP server, workspace-write with network, approval on request", () => {
  const { args } = townLaunch("codex", { mcpUrl: URL_, askEverything: false });
  expect(args).toEqual(
    expect.arrayContaining(["--sandbox", "workspace-write", "--ask-for-approval", "on-request"]),
  );
  expect(args.join(" ")).toContain(`mcp_servers.cstack.url="${URL_}"`);
  expect(args.join(" ")).toContain("tool_timeout_sec");
  expect(args.join(" ")).toContain("sandbox_workspace_write.network_access=true");
  expect(args.join(" ")).not.toMatch(/dangerously/);
});
```

- [ ] **Step 2: Run** `vp test tests/town-launch.test.ts tests/town-fallback.test.ts` — Expected: FAIL.

- [ ] **Step 3: Verify the flag names against each agent's current docs and `--help`** before implementing (Claude Code: `--mcp-config` accepting inline JSON, `--allowedTools` patterns, `--permission-mode acceptEdits`, the MCP tool timeout environment variable; Codex: `-c mcp_servers.<name>.url`, `tool_timeout_sec`, `--sandbox workspace-write`, `sandbox_workspace_write.network_access`, `--ask-for-approval on-request`). Adjust the tests if a name differs; record the mapping in a comment at the top of `src/town/launch.ts`. Tool-call timeout: 24 hours.

- [ ] **Step 4: Implement** `fallback.ts`, `launch.ts`, `open-browser.ts`, then `runTown`:
  1. `store = new TownStore(projectName)`; `server = await startTownServer({ store, uiDir, mcp: createMcpHandler(store) })` where `uiDir` is `new URL("./ui/", import.meta.url)` resolved to a path (the bundle sits next to `dist/ui`).
  2. Print the URL, then the permission summary: `Allowed without asking in this session: <allowed joined by ", ">. Anything else asks in this terminal.` plus, when `npx`/`bunx` are allowed, `npx and bunx let the agent download and run npm packages without asking.` With `--ask-everything`: `The agent will ask before every command.`
  3. Unless `options.open` is false, `await openBrowser(server.url)`; on `false` print `Couldn't open a browser. Open the URL above.`
  4. `runAgent({ command: agent.id, args: [...launch.args, ...(model), ...options.agentArgs, launchPrompt], env: launch.env, cwd: projectDir })` — the user's `--` args come after the town defaults so they win.
  5. On agent exit: `store.agentStopped()`, `await server.close()`, return the exit code. Also close the server on `SIGINT`/`SIGTERM`.

  In `src/create.ts`: after choosing the agent, `const reason = options.terminal ? null : townUnavailableReason(...)`; town mode when `!options.terminal && reason === null`. If a reason exists, print `Using the text interview: <reason>.`. Write the prompt with `fillBootstrapPrompt(facts, { town })`. Town mode: `const { runTown } = await import("./town/run.ts")`. When no agent is installed, town mode is skipped (prompt written without the town section, as today).

- [ ] **Step 5: Run** `vp check && vp test` — Expected: PASS.

- [ ] **Step 6: Smoke test with a stand-in agent.** Write a throwaway script in the scratchpad (not the repo) that acts as `claude` on `PATH`: it reads `--mcp-config`, connects with the MCP client, calls `ask` once and prints the result. Run `bun src/index.ts create /tmp/town-smoke --agent claude --no-open`, open the printed URL with `curl` to post an answer to `/answer`, and confirm the script prints it and the CLI exits 0 and the server port is closed.

- [ ] **Step 7: Commit** — `git commit -m "feat: run the agent in town mode with scoped permissions"`

---

### Task 7: The page skeleton: build, state, entry, music, island

**Files:**

- Create: `ui/index.html`, `ui/vite.config.ts`, `ui/tsconfig.json`, `ui/src/main.tsx`, `ui/src/App.tsx`, `ui/src/use-town.ts`, `ui/src/logic.ts`, `ui/src/hud/Entry.tsx`, `ui/src/hud/Mute.tsx`, `ui/src/hud/Credits.tsx`, `ui/src/scene/Island.tsx`, `ui/src/scene/Lots.tsx`, `ui/public/music/lofi-loop.<ext>`, `scripts/check-pack-size.ts`
- Modify: `package.json` (scripts, devDependencies), root `tsconfig.json` (include `ui`), `vite.config.ts` if needed
- Test: `ui/src/logic.test.ts`, `tests/pack-size.test.ts`

**Interfaces:**

- Consumes: `TownState`, `AnswerBody` (Task 2), server routes (Task 4).
- Produces:
  - `useTown(): { state: TownState | null; connected: boolean; postAnswer(body: AnswerBody): Promise<"ok" | "stale" | "invalid"> }` — reads `token` from `location.search`, subscribes to `/events?token=`, reconnects with backoff, re-reads state after a `409`.
  - `lotPosition(slot: SlotId): [x: number, y: number, z: number]` in `logic.ts`.
  - `MUTE_KEY = "cstack-town-muted"` (localStorage, wrapped in try/catch).
  - `checkPackSize(bytes: number, limit = 3 * 1024 * 1024): string | null` — returns an error message over the limit.
  - Scripts: `"build:ui"` (Vite+ build of `ui/` into `dist/ui`), `"build": "vp run build:ui && vp pack"`, `"prepublishOnly": "vp check && vp test && vp run build && bun scripts/check-pack-size.ts"`.

- [ ] **Step 1: Add dependencies** with `bun add -d react react-dom three @react-three/fiber @types/react @types/react-dom @types/three` (latest). Add `@react-three/drei` only if a later task needs it.

- [ ] **Step 2: Write tests**

```ts
// ui/src/logic.test.ts
test("every slot has a lot on the island", () => {
  for (const slot of SLOTS) expect(lotPosition(slot.id)).toHaveLength(3);
});
// tests/pack-size.test.ts
test("pack size limit is 3 MB", () => {
  expect(checkPackSize(3 * 1024 * 1024)).toBeNull();
  expect(checkPackSize(3 * 1024 * 1024 + 1)).toMatch(/3 MB/);
});
```

- [ ] **Step 3: Run** `vp test` — Expected: FAIL.

- [ ] **Step 4: Implement.**
  - Vite app in `ui/` building to `../dist/ui` with relative asset paths (`base: "./"`). Check `vp build --help` for how to build a sub-folder root.
  - `App`: full-screen R3F `Canvas` at night (dark blue sky, a moon light and soft ambient), the low-poly island (flat-shaded, `flatShading: true`), empty lots marked by subtle squares, slow orbit-limited camera. Not connected → small "Connecting…" HUD; `agentStopped` → "The agent stopped. You can close this tab."
  - `Entry`: first screen "Tap to enter the town" (HTML overlay). The click starts the music (`HTMLAudioElement`, `loop = true`, volume 0.5) unless muted.
  - `Mute`: corner button, persisted with `MUTE_KEY`. `Credits`: small corner line, exact text from Global Constraints.
  - Music: download `LofiLoop.ogg` from the OpenGameArt page. Check it plays in current Safari, Chrome and Firefox; if Safari can't play OGG, transcode to MP3 and ship only the MP3.
  - `scripts/check-pack-size.ts`: run `npm pack --dry-run --json`, read the tarball `size`, print and `process.exit(1)` when `checkPackSize` returns a message.

- [ ] **Step 5: Run** `vp check && vp test && vp run build`, then `bun scripts/check-pack-size.ts` — Expected: PASS and under 3 MB. Run the Task 6 smoke flow and look at the page in a browser: island, entry screen, music, mute.

- [ ] **Step 6: Commit** — `git commit -m "feat: add the town page with the island, entry screen and music"`

---

### Task 8: Buildings

**Files:**

- Create: `ui/src/buildings/registry.ts`, one component per option under `ui/src/buildings/` (grouped by slot, e.g. `frontend.tsx`, `data.tsx`), `ui/src/buildings/Generic.tsx`, `ui/src/buildings/Drop.tsx`, `ui/src/scene/NameSign.tsx`, `ui/src/scene/Props.tsx`
- Modify: `ui/src/logic.ts`, `ui/src/App.tsx`
- Test: `ui/src/buildings/registry.test.ts`, `ui/src/logic.test.ts`

**Interfaces:**

- Consumes: `SLOTS`, `Placement`, `lotPosition`.
- Produces:
  - `BUILDINGS: Record<string, ComponentType<BuildingProps>>` keyed `` `${slot}:${optionId}` ``, for every option of every `building`-kind slot.
  - `buildingFor(slot: SlotId, optionId: string): ComponentType<BuildingProps>` — falls back to `Generic`.
  - `interface BuildingProps { label: string; stage: Stage; theme: Theme }`
  - `type Stage = "preview" | "placed" | "blueprint" | "constructing" | "solid" | "failed"` (only `preview` and `placed` used in this task; Task 10 uses the rest)
  - `interface Theme { base: string; accent: string; roundness: number }` and `themeFor(ui: Placement | undefined): Theme` — defaults when no styling answer yet.
  - `Drop`: wraps a building; on mount it falls from above the lot and settles with one bounce (spring/easing, ~600 ms).

- [ ] **Step 1: Write tests**

```ts
test("every building option in the catalog has its own building", () => {
  for (const slot of SLOTS.filter((s) => s.kind === "building"))
    for (const option of slot.options) expect(BUILDINGS[`${slot.id}:${option.id}`]).toBeDefined();
});
test("unknown options get the generic building", () => {
  expect(buildingFor("frontend", "solid-start")).toBe(Generic);
});
test("theme defaults and follows the styling answer", () => {
  expect(themeFor(undefined)).toEqual(DEFAULT_THEME);
  expect(themeFor(uiPlacement({ baseColor: "zinc", theme: "blue", radius: "0" })).roundness).toBe(
    0,
  );
});
```

How the `ui` styling answer encodes base colour/theme/radius in a `Placement` is the implementer's choice (e.g. `optionIds` as `key:value` pairs); document it in `TOWN.md` (re-sync) and test it here.

- [ ] **Step 2: Run** `vp test ui/src` — Expected: FAIL.

- [ ] **Step 3: Implement.** Each building is built from simple three.js geometries, flat-shaded, recognisable by silhouette and one signature detail (e.g. Vercel a triangular tower, SST a stacked-crate warehouse, Convex a round observatory, Drizzle a water tower, Payload a post office). Buildings use `theme` colours and `roundness`. `auto` placements carry a small "auto" flag on the roof. Hover shows the label as an HTML overlay. `name` renders the entrance sign with the project name; `extras` render small props (e.g. lighthouse for `ci`, watchtower for `tests`). The `ui` answer repaints all buildings.

- [ ] **Step 4: Run** `vp check && vp test` — Expected: PASS. Visual check through the smoke flow: answering drops the right building with a bounce.

- [ ] **Step 5: Commit** — `git commit -m "feat: add a building for every stack option"`

---

### Task 9: Billboard, interview interactions and the thinking crane

**Files:**

- Create: `ui/src/hud/Billboard.tsx`, `ui/src/hud/QuestionCard.tsx`, `ui/src/hud/TerminalSign.tsx`, `ui/src/scene/Crane.tsx`, `ui/src/scene/Preview.tsx`
- Modify: `ui/src/logic.ts`, `ui/src/App.tsx`
- Test: `ui/src/logic.test.ts`

**Interfaces:**

- Consumes: `useTown().postAnswer`, `buildingFor`, `Question`.
- Produces:
  - `TERMINAL_SIGN_AFTER_MS = 30_000`
  - `showTerminalSign(state: TownState, now: number): boolean` — true when `pending` and `plan`-waiting are both absent, `phase !== "done"`, `!agentStopped`, and `now - lastAgentActivity > TERMINAL_SIGN_AFTER_MS`.
  - `isThinking(state: TownState): boolean` — no pending question, phase `interview`, not stopped.
  - `nextLot(state: TownState): SlotId | null` — the first catalog slot without a placement (where the crane swings).

- [ ] **Step 1: Write tests**

```ts
test("terminal sign after 30 s of agent silence", () => {
  expect(showTerminalSign(stateAt({ lastAgentActivity: 0 }), 30_001)).toBe(true);
  expect(showTerminalSign(stateAt({ lastAgentActivity: 0 }), 29_000)).toBe(false);
  expect(showTerminalSign(stateAt({ lastAgentActivity: 0, pending: question() }), 99_999)).toBe(
    false,
  );
});
test("thinking only between questions in the interview", () => {
  /* ... */
});
test("nextLot skips placed slots", () => {
  /* ... */
});
```

- [ ] **Step 2: Run** — Expected: FAIL.

- [ ] **Step 3: Implement.**
  - `Billboard` (HTML overlay styled as a billboard on a post in the scene): question, quip in italics, options as buttons with descriptions and a "recommended" tag. Single-select answers on click; multi-select toggles, then a **Done** button; free text shows an input and **OK** (disabled when empty). Questions with `slot: null` use the same card.
  - Hovering an option renders `Preview`: that option's building floating translucent above its lot.
  - On answer: `postAnswer`; on `stale` the hook re-syncs; on `invalid` shake the card.
  - `Crane` swings over `nextLot` while `isThinking`; `status` text shows under it.
  - `TerminalSign` shows "The agent needs you in the terminal" when `showTerminalSign` (re-evaluate every second).

- [ ] **Step 4: Run** `vp check && vp test` — Expected: PASS. Smoke flow: answer a full interview with `--defaults` off using the real agent (see Task 11) or the stand-in.

- [ ] **Step 5: Commit** — `git commit -m "feat: ask questions on the billboard with a thinking crane"`

---

### Task 10: Plan, build progress and the final report

**Files:**

- Create: `ui/src/hud/PlanCard.tsx`, `ui/src/hud/ReportCard.tsx`, `ui/src/scene/Signs.tsx`, `ui/src/scene/LightsUp.tsx`
- Modify: `ui/src/logic.ts`, `ui/src/App.tsx`, building components (stages)
- Test: `ui/src/logic.test.ts`

**Interfaces:**

- Consumes: `PlanView`, `BuildStep`, `ReportView`, `Stage`, `postAnswer({ questionId: "plan", ... })`.
- Produces: `stageFor(slot: SlotId, state: TownState): Stage` — `placed` during interview and plan; in `build`: `blueprint` until a step covering the slot starts, `constructing` while started, `solid` when done, `failed` when its latest step failed; in `done`: `solid` unless failed.

- [ ] **Step 1: Write tests**

```ts
test("stages follow the build steps", () => {
  const s = buildState({ steps: [{ name: "Frontend", slots: ["frontend"], status: "started" }] });
  expect(stageFor("frontend", s)).toBe("constructing");
  expect(stageFor("data", s)).toBe("blueprint");
  expect(
    stageFor("frontend", withStep(s, { name: "Frontend", slots: ["frontend"], status: "done" })),
  ).toBe("solid");
  expect(
    stageFor("frontend", withStep(s, { name: "Frontend", slots: ["frontend"], status: "failed" })),
  ).toBe("failed");
});
test("interview and plan show placed buildings", () => {
  /* ... */
});
```

- [ ] **Step 2: Run** — Expected: FAIL.

- [ ] **Step 3: Implement.**
  - `PlanCard` on the billboard: the summary rows (auto rows marked), generators and manual steps; **Build it** posts `{ action: "build" }`; **Change something** enters a pick mode ("Click the building to change") and posts `{ action: "change", slot }` on click.
  - Buildings render each `Stage`: `blueprint` glowing translucent wireframe, `constructing` scaffolding and a small bounce loop, `solid` normal, `failed` smoke and a red flag (its step message on hover).
  - `ReportCard` when `phase === "done"`: built, commands (copy buttons), unverified items. `Signs`: one sign per manual step at its slot's lot (or at the entrance when `slot` is null); a warning sign for unverified items. `LightsUp`: windows light up across the town, then the billboard says "Your project is ready. You can close this tab."

- [ ] **Step 4: Run** `vp check && vp test` — Expected: PASS.

- [ ] **Step 5: Commit** — `git commit -m "feat: show the plan, build progress and final report in the town"`

---

### Task 11: End-to-end run, docs and release checklist

**Files:**

- Modify: `README.md`, `CLAUDE.md`
- Test: manual runs below

- [ ] **Step 1: Full checks.** `vp check && vp test && vp run build && bun scripts/check-pack-size.ts` — Expected: PASS, tarball under 3 MB.

- [ ] **Step 2: Terminal path unchanged.** `bun src/index.ts create /tmp/t1 --terminal --agent claude` with the fake-agent `PATH` from earlier: the launch prompt matches Task 1's, no town URL printed, and `grep -L "@modelcontextprotocol\|three" dist/index.mjs` lists the entry file (no town code in the entry chunk).

- [ ] **Step 3: Real run with each agent.** `bun dist/index.mjs create /tmp/town-claude --agent claude --model claude-opus-5-5` and `--agent codex`: answer the interview in the browser, approve the plan, let the build finish. Confirm: no question appears in the terminal; buildings drop for answers and auto decisions; the crane shows while thinking; blueprints turn solid per step; the report and signs appear; quitting the agent closes the server. Note anything the agent did that the prompt should prevent and fix it in `TOWN.md`.

- [ ] **Step 4: Docs.** README: the town (what it is, `create` options including `--terminal`, `--no-open`, `--ask-everything`), the permission policy in plain words with the `npx`/`bunx` caveat, the automatic text fallback, the music credit. `CLAUDE.md`: the town layout (`src/town`, `ui/`, `.github/TOWN.md` sync rule, `build:ui`).

- [ ] **Step 5: Commit** — `git commit -m "docs: document cstack town"`

- [ ] **Step 6: Release (needs the user).** Stop and ask the user before each of these: `npm publish` for `@cstack-dev/town@0.2.0` (they approve the one-time password in the browser), then `npm deprecate @cstack-dev/create "Moved to @cstack-dev/town: npx @cstack-dev/town create my-app"`, then `git push`.
