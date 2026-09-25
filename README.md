<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://shieldcn.dev/header/grid.svg?title=cstack&subtitle=TypeScript+starter+on+TanStack+Start+and+Convex&mode=dark">
  <img alt="cstack" src="https://shieldcn.dev/header/grid.svg?title=cstack&subtitle=TypeScript+starter+on+TanStack+Start+and+Convex&mode=light">
</picture>

cstack is a template for full-stack TypeScript apps, plus a CLI that turns it
into a new project. The template is a small working app: Google sign-in, a
task list that updates live across tabs, tests and CI.
`bunx github:christianstamati/cstack my-app` copies it, gives it a local Convex
backend that needs no account, and makes the first commit in a local git repo.
GitHub, Convex Cloud and Vercel come later, when the project is ready for
them.

The task list is an example. Delete `convex/tasks.ts`, the `tasks` table,
`apps/web/src/components/tasks` and the dashboard page when a real project
starts.

- `apps/web` the TanStack Start app, deployed to Vercel
- `packages/backend` Convex schema, functions and their tests
- `packages/ui` shadcn components on Base UI, shared by the app
- `cli` the project generator. It never ends up in a generated project

## Stack

| Concern | Tool |
| --- | --- |
| Monorepo | [Turborepo](https://turborepo.com) and [Bun](https://bun.sh) workspaces |
| Language | [TypeScript 7](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/), the Go port of the compiler |
| Web app | [TanStack Start](https://tanstack.com/start) with React 19 and Vite 8, built for Vercel by [Nitro](https://nitro.build) |
| Data fetching | [TanStack Query](https://tanstack.com/query) through the [Convex adapter](https://docs.convex.dev/client/tanstack/tanstack-query). Every query is a live subscription |
| Backend | [Convex](https://convex.dev). New projects develop against a [local deployment](https://docs.convex.dev/cli/local-deployments) and use Convex Cloud for production |
| Auth | [Convex Auth](https://github.com/get-convex/convex-auth) v2 (alpha) with Google sign-in |
| UI | [shadcn/ui](https://ui.shadcn.com) on [Base UI](https://base-ui.com) with Tailwind CSS 4 |
| Tests | [Vitest](https://vitest.dev) and [convex-test](https://docs.convex.dev/testing/convex-test) |
| Lint and format | [Biome](https://biomejs.dev), run on staged files by [lefthook](https://github.com/evilmartians/lefthook) before each commit |
| Design system | [@shadcn/lint](https://github.com/shadcn-ui/lint) through [Oxlint](https://oxc.rs). Components are styled through their variants, colors come from theme tokens, sizes from the scale |
| Dependencies | [Renovate](https://docs.renovatebot.com), grouped weekly PRs. Stable minor and patch updates merge once CI passes |

Convex Auth v2 has no written docs yet. The
[examples in its repo](https://github.com/get-convex/convex-auth/tree/v2.0.0-alpha.2/examples)
are the reference, and the version is pinned so an alpha release can't change
under you.

## Prerequisites

| Tool | Version | Needed for |
| --- | --- | --- |
| [Bun](https://bun.sh) | 1.4 or later | Everything |
| [Node](https://nodejs.org) | 22 or later | Vite and the Convex CLI run on it |
| Convex and Vercel accounts | | Only to deploy. New projects run without them |

Turborepo, Biome, Oxlint and lefthook are dev dependencies, so `bun install`
brings them. It also installs the git hooks.

## Quick start

```bash
bun install
bun dev
```

`bun dev` runs `convex dev` and Vite together. The app is on
http://localhost:3000 and talks to the Convex dev deployment named in
`packages/backend/.env.local`, which is gitignored. On a new machine, link it
first:

```bash
cd packages/backend
bunx convex dev --once --configure existing --project cstack
```

| Command | What it does |
| --- | --- |
| `bun dev` | Backend and web app in watch mode |
| `bun run test` | Backend tests |
| `bun run typecheck` | `tsc` in every package |
| `bun run check` | Biome lint and format check. `check:fix` applies the fixes |
| `bun run lint` | Design-system rules (@shadcn/lint) |
| `bun run ci` | What CI runs: Biome, design-system rules, typecheck and tests |
| `bun run build` | Production build of the web app |

## Creating a project

From any directory, no install or clone needed:

```bash
bunx github:christianstamati/cstack my-app
```

`bunx` downloads this repo from GitHub and runs `cli/src/index.ts`. It keeps
that download and reuses it on later runs, so the CLI checks `main` with
`git ls-remote` on start and switches to the newest commit when the cached one
is behind. To pin a version instead, add a tag or commit:
`github:christianstamati/cstack#v1.0.0`. For a shorter command, add an alias
to `~/.zshrc`:

```bash
alias create-cstack-app="bunx github:christianstamati/cstack"
```

It copies the template into `./my-app`, leaving out `cli/`, and renames
`cstack` to `my-app`. Then it runs `git init` and `bun install`. Next it creates
a local Convex deployment: the backend runs inside `bun dev`, keeps its data in
`packages/backend/.convex`, and needs no Convex account. It generates the auth
signing keys, sets the env vars, pushes the backend and makes the first commit.
Nothing leaves your machine. Add a GitHub remote when you want one.

Before setting env vars it asks for a Google OAuth client and prints the
redirect URI to register, such as
`http://127.0.0.1:3211/oauth/google/callback`. The client is optional; without
one, sign-in fails at Google until you set it. `-y` skips the prompts, and
exporting `CSTACK_GOOGLE_CLIENT_ID` and `CSTACK_GOOGLE_CLIENT_SECRET` answers
them. One Google client can serve every project once each project's redirect
URIs are on it.

To try changes to the template before pushing them, run the CLI from this
checkout. It copies your working tree, including uncommitted files:

```bash
bun ~/dev/cstack/cli/src/index.ts my-app
```

## Deploying

A generated project deploys to Vercel, with its backend on Convex Cloud. Its
README walks through the one-time setup: a GitHub remote, a Convex project and
deploy key, and a Vercel project for `apps/web`. The source is
[`cli/template/README.md`](cli/template/README.md). After that, every push to
`main` deploys: `apps/web/vercel.json` runs `convex deploy`, which pushes the
backend to production with `CONVEX_DEPLOY_KEY` and then builds the web app
against it.

### Environment variables

These live on the Convex deployment, not in files. Set them in
`packages/backend` with `bunx convex env set NAME`. Add `--prod` for
production. `convex.config.ts` refuses a push until the auth keys and the
Google client are set.

| Variable | |
| --- | --- |
| `AUTH_PRIVATE_KEY`, `AUTH_JWKS` | Signing keys for Convex Auth. The CLI generates them |
| `AUTH_GOOGLE_CLIENT_ID`, `AUTH_GOOGLE_CLIENT_SECRET` | The Google OAuth client |
| `SITE_URL` | Where sign-in may send users back to: `http://localhost:3000` in dev, the Vercel URL in production |

### Google sign-in

Google is the only sign-in method. The OAuth client (type Web application)
needs one authorized redirect URI per Convex deployment:

```
<CONVEX_SITE_URL>/oauth/google/callback
```

`CONVEX_SITE_URL` is `VITE_CONVEX_SITE_URL` in `packages/backend/.env.local`:
`http://127.0.0.1:<port>` for a local deployment, and the `.convex.site` address
for a cloud one. The path is `/oauth/google/callback`, not v1's `/api/auth/callback/google`.
Google answers a wrong one with `redirect_uri_mismatch`.

While the consent screen is in testing, only accounts listed as test users
can sign in.

## Design system rules

`.oxlintrc.json` runs the six [@shadcn/lint](https://github.com/shadcn-ui/lint)
rules as errors and turns every built-in Oxlint rule off, so it never
overlaps with Biome. The pre-commit hook and CI both run it.

A page styles a component through `variant` and `size`. Its `className` may
only add layout, like margin, width or position. `Card` and components whose
names end in `Content`, `Header` or `Footer` also take padding and gap. Colors
must be theme tokens, sizes must be on the scale, and there are no inline
styles. The components in `packages/ui/src/components` are exempt from the
restyle, arbitrary-value and static-class rules, since they define the look.

When a design needs something no variant gives, add the variant or theme token
in `packages/ui`, or widen a contract in `.oxlintrc.json`. The
[design system guide](https://github.com/shadcn-ui/lint/blob/main/docs/design-systems.md)
shows the options. For warnings in the editor, install the
[Oxc extension](https://marketplace.visualstudio.com/items?itemName=oxc.oxc-vscode).

## Testing

Tests live next to the functions as `packages/backend/convex/*.test.ts` and
run against an in-memory Convex through `convex-test`:

```bash
bun run test
bun run --cwd packages/backend test:watch
```

`convex/test.setup.ts` has `setup()`, which builds the test backend, and
`signedInAs(t, email)`, which creates a user and returns a client acting as
them.

## Adding UI components

```bash
bun run ui:add button
```

Components land in `packages/ui/src/components` and are imported as:

```tsx
import { Button } from "@workspace/ui/components/button"
```
