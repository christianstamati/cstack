# cstack

`town create` starts a new full-stack TypeScript project by handing the setup to
Claude Code or Codex. It creates the project folder, writes a bootstrap prompt into it,
and opens the agent there. The agent interviews you (structure, toolchain, framework,
data layer, auth, deploy target, UI styling), shows a plan, and builds the project only
after you approve it, using each tool's official generator.

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

## Options

| Flag                    | What it does                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------ |
| `--agent claude\|codex` | Agent to use. Without it, the CLI asks when both are installed                       |
| `--model <name>`        | Model passed through to the agent CLI                                                |
| `--defaults`            | Skip the interview and go straight to the plan with the cstack defaults              |
| `--config <file>`       | Reuse a `config.json` saved by an earlier run                                        |
| `--terminal`            | Stay in the terminal (the only mode so far)                                          |
| `--no-open`             | Don't open the browser automatically                                                 |
| `--ask-everything`      | Ask every question instead of using sensible defaults                                |
| `-- <args>`             | Everything after `--` goes to the agent CLI, e.g. `-- --permission-mode acceptEdits` |

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
   If neither agent is installed, it prints the file's path so you can paste it into
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

## Credits

Music: "Lofi Hip Hop Loop" by OMF-Games
([OpenGameArt](https://opengameart.org/content/lofi-hip-hop-loop), CC0), shipped as an
MP3 transcode.
