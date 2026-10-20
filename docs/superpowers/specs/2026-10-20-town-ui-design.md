# cstack town — design

Date: 2026-10-20
Status: draft for review

## Intent

`npx @cstack-dev/create my-app` runs the cstack bootstrap interview in the terminal:
Claude Code or Codex asks a dozen or more questions one at a time, then builds the
project. It works, but it's a wall of text.

The CLI becomes **cstack town**: `npx @cstack-dev/town create my-app` opens a playful
3D page in the browser. The questions appear there, and every answer adds a building
to a small low-poly island town at night, with a lofi loop playing. By the end of the
interview the town _is_ your stack. The point is that setting up a project should be
fun, the way Bruno Simon's portfolio (https://bruno-simon.com) makes a CV fun:
low-poly, flat-shaded, toy-like, things bounce. That site is a reference for the mood
only; the world, models and interactions here are original.

Later, `npx @cstack-dev/town update` will open the same town for an existing project,
to swap buildings and repair outdated ones. That's out of scope here, but the name and
command shape are chosen for it.

## Goals (first version)

1. **Rename and reshape the CLI.** The package is `@cstack-dev/town`, the command is
   `town`, and the current behaviour becomes the `create` subcommand:
   `town create <dir> [options] [-- agent args]`. All of today's options carry over
   (`--agent`, `--model`, `--defaults`, `--config`, `-- <agent args>`).
2. **The town opens by default.** `town create my-app` starts the page, opens it in the
   browser and prints its URL. `--terminal` runs the plain text interview exactly as
   today. `--no-open` starts the page and prints the URL without opening a browser.
3. **Automatic fallback to text.** When there's no way to show the page — no
   interactive terminal, CI, or an SSH session — `create` runs the text interview and
   says why in one line.
4. Every question the agent asks appears on a billboard in the town, and the user
   answers by clicking (or typing, for free text). No questions are asked in the
   terminal while the town is in use, apart from the permission prompts described in
   "Agent permissions".
5. Each answer drops a distinct building (or prop, or repaint) into the town with a
   bounce. Each tool option has its own recognisable building: Vercel and SST look
   different, Convex/Drizzle/Payload look different, and so on.
6. While the agent works out the next question (it may read `--help` output and docs
   for several seconds), the town shows that it's thinking: a crane swinging over the
   empty lot where the next building will go.
7. Answers the agent decides on its own (a skipped question, e.g. "Database: built
   into Convex") drop their building in too, labelled as automatic.
8. The plan (Phase 2 of the prompt) appears on the billboard with **Build it** and
   **Change something**. "Change something" lets the user click a building to
   re-answer that question.
9. During the build, buildings start as glowing blueprints and turn solid, with a
   construction animation, as each build step is committed.
10. When done, the town lights up and the billboard shows the final report: what was
    built, how to run it, manual steps (each as a sign next to the building it belongs
    to) and anything left unverified (a warning sign).
11. Background music: "Lofi Hip Hop Loop" by OMF-Games
    (https://opengameart.org/content/lofi-hip-hop-loop, CC0), looping, with a mute
    button. Credited in a small credits line on the page and in the README.
12. Works with both Claude Code and Codex.

## Non-goals (later versions)

- **`town update`**: swapping buildings on an existing project (e.g. replace Vercel
  with SST and have the agent rework the project), and repairing outdated buildings
  (scaffolding or cracks on a building whose tool has a newer version on npm, cracks
  for a new major; click to have the agent upgrade it). The town must be built so these
  can be added: it is driven by the same config shape as `.cstack/config.json`.
- A drivable vehicle, physics, or anything game-like beyond clicking.
- Mobile layouts. Desktop browsers only.
- Answering questions in the terminal and the browser at the same time.

## Anti-goals (failure even if it technically works)

- **The agent hangs.** A question that never reaches the page, an answer that never
  reaches the agent, a tool call that times out mid-interview, or a permission prompt
  waiting in the terminal while the page shows nothing. Reliability of the
  question/answer channel matters more than any visual.
- **The page owns the interview rules.** Which questions to ask, which to skip, the
  compatibility rules and the live shadcn option lists stay in `BOOTSTRAP.md` and the
  agent. The page only shows what the agent sends and returns what the user picks. If
  the agent sends an option the town has no building for, the page still works (see
  "Unknown options").
- **`--terminal` gets slower.** The text path must not load or run any page code. The
  page ships in the same package (see "Package size"), so the download grows, within a
  fixed budget.
- **A copy of Bruno Simon's site** or of any existing game.

## Constraints

- Everything stays in this repo and ships as `@cstack-dev/town` on npm.
- Node 20.12+ at runtime (the CLI is bundled by `vp pack`).
- Vite+ for the repo's own check/test/build (see `CLAUDE.md`).
- The page is React Three Fiber.
- The page and its server are local only: bind to `127.0.0.1`, with a random token in
  the URL so other local processes or tabs can't post answers.
- The music file ships inside the package, so it must stay CC0 or similar.

## How it works (decided)

### Flow

1. `town create my-app` does everything `create` does today (checks the folder,
   collects machine facts, writes `.cstack/BOOTSTRAP.md`, picks the agent). Unless
   `--terminal` is set or the fallback applies, it also:
   - starts a local server that serves the built page and exposes the cstack tools to
     the agent;
   - opens the page in the default browser (unless `--no-open`) and prints its URL;
   - writes the town-mode instructions into the prompt (see "Prompt changes");
   - starts the agent with the cstack tools registered for that session only, and with
     the permissions described in "Agent permissions".
2. The agent runs in the terminal (the user can watch it there), but asks every
   question through the cstack `ask` tool. The tool call waits until the user answers
   on the page, then returns the answer.
3. After the answer, the page shows the "thinking" crane until the next tool call.
4. The plan, build progress and final report also go through cstack tools.
5. The agent runs as an ordinary interactive session, not headless, so the user can
   keep talking to it in the terminal after the report. After `report`, the page says
   the project is ready and the tab can be closed. When the user quits the agent, the
   server stops and the CLI exits with the agent's exit code.

### Agent ↔ page channel: an MCP server run by the CLI

Both Claude Code and Codex load MCP servers, so the cstack tools are an MCP server.
The CLI process hosts it alongside the page, so there's one process holding the state.
The tools (names and exact fields are the builder's; this is the minimum):

- `ask` — one question. Input: `slot` (which part of the stack, see "Slots"; optional),
  `question` text, an optional short `quip` (one funny line for the billboard),
  `options` (id, label, one-line description, recommended flag), `multiSelect`, and
  whether free text is allowed. Returns the chosen option id(s) or text.
- `decide` — an answer the agent chose itself. Input: `slot`, option, `reason`.
  Returns immediately; the page drops the building marked "auto".
- `plan` — the Phase 2 plan. Input: the summary rows, tree, generators, manual steps.
  Returns `build` or `change` with the slot the user wants to change.
- `progress` — build progress. Input: step name, the slot(s) it covers, status
  (started / done / failed), a short message. Returns immediately.
- `report` — the final report. Input: built, commands, manual steps (each with the slot
  it belongs to), unverified items. Returns immediately.
- `status` — optional free-form "what I'm doing now" line shown under the crane.

`ask` also covers questions that aren't a stack choice. With no `slot` it's a
billboard-only question that adds no building. The prompt has several of these: the
Payload v4 beta question, "switch to monorepo?" for Elysia or NestJS, pasting a
shadcn preset code (free text), "install X, then continue" for a missing tool, and
"blocked after 3 attempts" (options such as retry, skip this step, stop). A blocked
step also shows on its building as a failed state. So the page is the only place the
agent asks the user anything, apart from permission prompts.

The page talks to the server over plain HTTP: it receives state updates by a stream
(server-sent events) and posts answers. The server keeps the whole town state, so
reloading or reopening the page restores it, and an answer is never lost because the
tab was closed: the `ask` call keeps waiting until someone answers.

### Agent permissions

In town mode the agent runs dozens of commands, and each would normally stop for
approval in the terminal while the page shows nothing. So `town create` starts the
agent with:

- **Allowed without asking:** editing files inside the project folder, and the
  commands the bootstrap needs: package managers (`npm`, `pnpm`, `yarn`, `bun`),
  generators run through `npx` / `bunx` / `pnpm dlx` / `yarn dlx`, `git`, `vp`, and
  `docker compose`.
- **Still asked in the terminal:** everything else, especially anything outside the
  project folder. When the agent has been silent on the page for a while, the town
  shows a "check your terminal" sign.
- **Printed at startup:** the exact list of what's allowed, before the agent starts.
- **Opt-out:** `--ask-everything` keeps every permission prompt as the agent's default.
- **The user's settings win:** anything passed after `--` to the agent overrides these
  defaults.
- Never the agent's "skip all permission checks" mode.

Allowing `npx`/`bunx` lets the agent download and run any npm package without asking.
The startup message says so in plain words. The exact flags differ between Claude Code
and Codex; the builder maps this policy onto each agent's current permission settings
and documents the mapping.

`--terminal` keeps today's behaviour: the agent's own default permissions.

### Prompt changes

`BOOTSTRAP.md` gets a town-mode section that only applies when the town is in use
(placeholder or appended section, builder's choice; the sync-and-test rule for the
prompt still holds). It tells the agent to:

- ask every question, including the plan approval, through the cstack tools and never
  in the terminal or with `AskUserQuestion`;
- call `decide` for every answer it settles without asking;
- use the slot ids and the option ids listed in the prompt where they exist;
- keep labels short enough for a billboard and add an optional quip;
- report each Phase 3 step with `progress` and finish with `report`.

### Slots and buildings

A slot is one part of the stack, matching the `config.json` fields: `name`,
`structure`, `toolchain`, `packageManager`, `frontend`, `data`, `api`, `database`,
`deploy`, `dbHost`, `auth`, `authMethods`, `ui` (styling), `extras`. Each slot has a
fixed lot on the island so the town has a stable layout.

- Most slots are one building, and each option of that slot has its own building
  design, recognisable without reading the label (shape, colour, a signature detail).
  Labels still appear on hover.
- `name` is the sign at the town entrance.
- `ui` styling doesn't add a building: it repaints the town (base colour, theme colour,
  radius as how rounded the buildings are).
- `extras` are small props around the town (e.g. a lighthouse for CI, a watchtower for
  tests).
- **Unknown options**: if the agent sends an option id the page doesn't know (a new
  shadcn style, a tool added to the prompt later), the page drops a generic building
  with the option's label on it. Nothing breaks.

### Package size

The page ships inside `@cstack-dev/town`, so everyone downloads it, including
`--terminal` users. Budget: the published tarball stays under 3 MB (three.js, React,
the page and the music together are expected to fit). A check in the release step
fails the publish if the tarball goes over. If the page can't fit, the fallback is a
second package fetched only for the town; that's a later decision.

### Music

Bundled in the package. Browsers block autoplay, so the page starts with a "tap to
enter" moment that also starts the music. Mute state is remembered in the browser.
Credit: "Lofi Hip Hop Loop" by OMF-Games, CC0.

### The old package

`@cstack-dev/create@0.1.0` is already published. Once `@cstack-dev/town` is out, it
gets an npm deprecation message pointing to `npx @cstack-dev/town create`. Deprecating
changes the public npm listing, so it's done only after the user confirms at release
time. The README, `CLAUDE.md` and the prompt's references to `create-cstack` /
`@cstack-dev/create` are updated to the new name.

## Left to the builder

- How the page is built and bundled with the CLI (e.g. a `ui/` Vite app built into
  `dist/ui`), and whether the town's models are built in code or authored as glTF.
- Exact MCP transport and how each agent is told about the server (e.g. Claude Code's
  `--mcp-config`, Codex config overrides), including raising each agent's tool-call
  timeout so `ask` can wait for minutes. Check each agent's current docs; verify both.
- Mapping the permission policy onto each agent's flags or settings.
- How "no way to show the page" is detected (TTY, `CI`, `SSH_CONNECTION` and similar).
- How long "silent for a while" is before the "check your terminal" sign appears.
- Building designs, colours, animations, camera, lighting, the crane, the
  blueprint-to-solid effect, the "lights up" ending.
- Audio format conversion if a browser can't play the OGG.
- Exact tool names and schemas, within the minimum above.
- Tests: at least the server's question/answer channel (an `ask` waits, an answer
  returns it, a reload restores state), argument parsing for the subcommand and new
  flags, the fallback decision, and the prompt sync test for the town-mode section.

## Decisions I made that you should check

- **Subcommands, not flags:** `town create my-app`, later `town update`.
- **`--no-open`** in addition to `--terminal`, for starting the page without opening a
  browser.
- **`--ask-everything`** as the opt-out from the loosened permissions.
- **Deprecate `@cstack-dev/create`** rather than keep it as a forwarding alias, after
  you confirm at release time.
- **One package, under 3 MB.** The publish fails if the tarball goes over budget.
- **The agent still runs in your terminal**, as a normal interactive session you can
  keep talking to after the report. The page is where you answer.
- **Every question goes to the page**, including conflicts, preset codes, missing
  tools and blocked steps, through `ask` without a slot.
- **A quip per question**, written by the agent, to make the billboard funny.
- **"Change something"** on the plan works by clicking the building to re-answer.
- **Desktop only** for the first version.

## Changes during implementation

The rest of this document is the original design and stays as the record. The built town
differs from it in these ways, mostly at the user's request while it was being built:

- **A city instead of an island.** The town is a pastel low-poly city on a floating slab,
  not a small island.
- **Pastel day plus a day/night cycle instead of night only.** The sky follows the local
  clock; `&time=HH:MM` in the page address previews an hour. The finale lights up the
  town at night or celebrates in daylight.
- **Logos on the buildings.** Each building carries its tool's logo from Simple Icons
  (trademarks of their owners, credited in the README and on the page). Tools without an
  icon get a monogram badge.
- **Links as street traffic.** Connections between pieces show as glowing traffic along
  the streets instead of separate props.
- **Growth from the centre, in answer order.** The town starts as bare land with the name
  sign and grows outward from the centre; roads are paved as blocks are added and cars
  appear once two blocks connect.
- **Block assignment follows answer order.** A slot gets the next free block when it first
  gains a building and keeps it for the whole session, even if it later flips to "not
  needed" (the block stays, empty), so nothing moves.
- **Plan, build and report in the town.** The plan card (Build it / Change something),
  build stages (blueprint, constructing, solid or failed), and a report card with copy
  buttons and manual-step signs.
