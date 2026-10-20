<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Built-in Commands vs Scripts

`vp <name>` runs a built-in command. `vp run <name>` runs a `package.json` script or a `vite.config.ts` task. Scripts cannot overwrite built-ins, so `vp dev` and `vp run dev` may do different things. Check `package.json` and `vite.config.ts` first, and run `vp run <name>` when the project defines a script or task with that name.

## Tool Versions

Run `vp toolchain` to show versions and relationships in the active Vite+
release. Add a tool name to select part of the graph. For example, run
`vp toolchain vite`. Use `--global` to ignore the local `vite-plus` package. Use
`vp why <package>` to show the package-manager dependency graph.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include its output when asking for help.

<!--VITE PLUS END-->

# This repo

This repo is only the `town` CLI (`@cstack-dev/town`), published to npm and run with
`npx @cstack-dev/town create <dir>`. Plain TypeScript with no runtime dependencies; `vp pack`
bundles `src/index.ts` into `dist/index.mjs`, the published bin, which runs on Node.

- The bootstrap prompt is `.github/BOOTSTRAP.md`. Edit that file, then run
  `bun run sync-prompt` to regenerate `src/bootstrap-prompt.ts`. Never edit the
  generated file by hand.
- Placeholders in the prompt (`{{PROJECT_DIR}}`, etc.) are filled by
  `fillBootstrapPrompt` in `src/prompt.ts`; a new placeholder needs a value there.
- The "cstack defaults" JSON in the prompt must match `defaultConfig` in `src/prompt.ts`.

## Town layout

`town create` opens a 3D page in the browser (town mode); `--terminal` and the automatic
fallback keep the plain text interview.

- `src/town/` is the Node side: `server.ts` (local HTTP server, token in the URL, events
  and answers), `mcp.ts` (the `cstack` MCP tools), `store.ts` (session state),
  `launch.ts` (per-agent flags and permission policy), `run.ts`, `fallback.ts`.
  `src/create.ts` loads `./town/run.ts` only through a dynamic `import()`, so the text
  path never loads the server or the MCP SDK. Keep it that way: `dist/index.mjs` must not
  contain `@modelcontextprotocol` or `three`.
- `ui/` is the React Three Fiber page with its own `tsconfig.json` and `vite.config.ts`.
  It builds into `dist/ui`. `src/town/protocol.ts` is shared by both sides, so it must not
  import Node modules.
- The town-mode prompt is `.github/TOWN.md`. Same rule as the bootstrap prompt: edit that
  file, then run `bun run sync-prompt` to regenerate `src/town-prompt.ts`.
- `build` is `vp pack && vp run build:ui` (pack cleans `dist/`, so the page is built
  after it). `bun scripts/check-pack-size.ts` fails if the npm tarball is over 3 MB;
  `prepublishOnly` runs it.
- `package.json` keeps no runtime `dependencies`: the MCP SDK, zod, React and three are
  devDependencies bundled into the output.
