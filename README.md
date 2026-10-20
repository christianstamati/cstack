# cstack

`town create` starts a new full-stack TypeScript project by handing the setup to
Claude Code or Codex. It creates the project folder, writes a bootstrap prompt into it,
and opens the agent there. The agent interviews you (structure, toolchain, framework,
data layer, auth, deploy target, UI styling), shows a plan, and builds the project only
after you approve it, using each tool's official generator.

You answer in your browser, not the terminal. The page is a small pastel low-poly town,
and your stack grows in it as you answer.

```bash
npx @cstack-dev/town create my-app
```

`bunx @cstack-dev/town create my-app` and `pnpm dlx @cstack-dev/town create my-app` do the same. Any of them asks which agent to use when both
are installed:

```
Bootstrap with:
  [1] Claude Code
  [2] Codex
>
```

## The town

`town create` prints a local address (`http://127.0.0.1:<port>/?token=...`), opens it in
your browser and starts the agent in the terminal. The agent asks every question through
the page instead of the terminal.

- The town is a city on a floating slab. It starts as bare land with a name sign, then
  grows outward from the centre in the order you answer. Roads are paved as blocks are
  added, and cars appear once two blocks connect.
- Each answer adds a building. Every building carries its tool's logo (tools without a
  logo get a monogram badge). Answers the agent settles on its own are marked as
  automatic, and a slot that doesn't apply stays an empty block.
- Pieces that work together are linked by glowing traffic on the streets.
- While the agent thinks, a crane shows it. The sky follows your local clock, day and
  night. To look at another hour, add `&time=HH:MM` to the address, for example
  `&time=21:30`.
- The plan appears as a card with **Build it** and **Change something**. During the
  build each building goes from blueprint to constructing to solid, or shows as failed.
  At the end a report card lists what was built, the commands to run (with copy buttons),
  manual steps (also as signs next to the building they belong to) and anything
  unverified, with a day or night finale.
- There is background music with a mute button.

The agent keeps running in your terminal as a normal session, so you can keep talking to
it after the report. When you quit the agent, the page's server stops and `town` exits
with the agent's exit code.

## Options

| Flag                    | What it does                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------ |
| `--agent claude\|codex` | Agent to use. Without it, the CLI asks when both are installed                       |
| `--model <name>`        | Model passed through to the agent CLI                                                |
| `--defaults`            | Skip the interview and go straight to the plan with the cstack defaults              |
| `--config <file>`       | Reuse a `config.json` saved by an earlier run                                        |
| `--terminal`            | Skip the town and run the text interview in the terminal                             |
| `--no-open`             | Start the town and print its address, but don't open the browser                     |
| `--ask-everything`      | Keep the agent's permission prompts for every command and edit (see below)           |
| `-- <args>`             | Everything after `--` goes to the agent CLI, e.g. `-- --permission-mode acceptEdits` |

### Permissions in town mode

The agent can't wait on you for every `npm install`, so the town loosens its permissions
for that session. `town` prints this at startup and never uses either agent's
skip-all-permissions mode.

- **Claude Code** runs in accept-edits mode, so file edits in the project (and basic
  file commands like mkdir, mv and cp) are accepted. It also gets an allowlist of
  `npm`, `pnpm`, `yarn`, `bun`, `npx`, `bunx`, `pnpm dlx`, `yarn dlx`, `git`, `vp` and
  `docker compose`. Those run with whatever arguments the agent picks. Anything else
  asks in your terminal.
- **Codex** can run any command without asking, with file writes limited to the project
  folder and network access allowed. Anything outside that asks in your terminal.
- `npx` and `bunx` can download and run any npm package without asking. Check what the
  agent is about to install if that matters to you.
- `--ask-everything` keeps the prompts: Claude Code asks before every command and edit,
  and Codex asks before everything except known-safe read-only commands.

### When the text interview is used instead

`town create` falls back to the text interview automatically, and says why in one line,
when it can't show a page: there is no interactive terminal, it runs in CI, or you are in
an SSH session (pass `--no-open` to use the town over SSH, e.g. with a forwarded port).
`--terminal` forces the text interview. Nothing from the town is loaded in that case.

The cstack defaults: a Vite+ monorepo on Bun, TanStack Start, Convex with Convex Auth
v2 and Google sign-in, shadcn/ui on Base UI, Vercel, plus an example feature, CI, tests
and agent docs.

## What happens

1. The CLI checks the folder name is kebab-case and the folder is new or empty.
2. It records machine facts: OS and which of git, gh, node, bun, pnpm, npm, yarn,
   docker, claude and codex are installed.
3. It writes `.cstack/BOOTSTRAP.md` (the prompt with those facts filled in) and, with
   `--defaults` or `--config`, `.cstack/config.json`.
4. It starts the agent in the new folder with a one-line instruction to read that file.
   In town mode it also starts the local page and gives the agent the `cstack` tools to
   ask, show the plan and report progress. If neither agent is installed, it prints the file's path so you can paste it into
   any agent.

The agent works in four phases: interview, plan, build (one commit per step), verify
(fresh install, check, test, build, dev server responds). At the end it deletes
`BOOTSTRAP.md` and keeps `config.json`, so the same setup can be run again with
`--config`.

## Requirements

Node 20.12 or later, and [Claude Code](https://claude.com/claude-code)
or [Codex](https://github.com/openai/codex).

## Editing the prompt

The prompt lives in [.github/BOOTSTRAP.md](.github/BOOTSTRAP.md). The CLI embeds a copy
in `src/bootstrap-prompt.ts`, which is generated. After editing the Markdown file:

```bash
bun run sync-prompt
```

`vp test` fails if the two differ, or if the "cstack defaults" JSON in the prompt
doesn't match what `--defaults` writes (`src/prompt.ts`).

## Development

```bash
bun install
vp check
vp test
bun src/index.ts create my-app   # run from source (serves the page from dist/ui)
vp run build              # dist/index.mjs (the published bin), then the page into dist/ui
bun scripts/check-pack-size.ts   # fails if the npm tarball is over 3 MB
```

The town page is a React Three Fiber app in `ui/` with its own `tsconfig.json`;
`vp check` and `vp test` cover it too.

## Publishing

```bash
npm version patch
npm publish
```

`prepublishOnly` runs `vp check`, `vp test` and `vp run build` first, then
`scripts/check-pack-size.ts`, so a broken build, or a tarball over 3 MB, can't be published.

The town prompt is `.github/TOWN.md`; the generated copy in `src/town-prompt.ts` is kept
in sync the same way as the bootstrap prompt (`bun run sync-prompt`).

## Credits

Music: "Lofi Hip Hop Loop" by OMF-Games (CC0)
([OpenGameArt](https://opengameart.org/content/lofi-hip-hop-loop)), shipped as an MP3
transcode.

Logos on the buildings come from [Simple Icons](https://simpleicons.org). They are
the trademarks of their respective owners and are used only to identify each tool.
