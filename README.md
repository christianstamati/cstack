<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://shieldcn.dev/header/grid.svg?title=cstack&subtitle=TypeScript+starter+on+TanStack+Start+and+Convex&mode=dark">
  <img alt="cstack" src="https://shieldcn.dev/header/grid.svg?title=cstack&subtitle=TypeScript+starter+on+TanStack+Start+and+Convex&mode=light">
</picture>

cstack is a template for full-stack TypeScript apps, plus a CLI that turns it
into a new project. The template is a small working app: Google sign-in, a
task list that updates live across tabs, email through Resend, tests and CI.
`cstack new my-app` copies it, creates the Convex project, the GitHub repo and
the Vercel project, and pushes. The first production deploy starts before the
command exits.

The task list is an example. Delete `convex/tasks.ts`, the `tasks` table and
the dashboard page when a real project starts.

- `apps/web` the TanStack Start app, deployed to Vercel
- `packages/backend` Convex schema, functions and their tests
- `packages/ui` shadcn components on Base UI, shared by the app
- `cli` the `cstack` command. It never ends up in a generated project

## Stack

| Concern | Tool |
| --- | --- |
| Monorepo | [Turborepo](https://turborepo.com) and [Bun](https://bun.sh) workspaces |
| Language | [TypeScript 7](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/), the Go port of the compiler |
| Web app | [TanStack Start](https://tanstack.com/start) with React 19 and Vite 8, built for Vercel by [Nitro](https://nitro.build) |
| Data fetching | [TanStack Query](https://tanstack.com/query) through the [Convex adapter](https://docs.convex.dev/client/tanstack/tanstack-query). Every query is a live subscription |
| Backend | [Convex](https://convex.dev) Cloud, one dev deployment per developer and one production deployment |
| Auth | [Convex Auth](https://github.com/get-convex/convex-auth) v2 (alpha) with Google sign-in |
| Email | [Resend](https://resend.com) through the [Convex component](https://www.convex.dev/components/resend) |
| UI | [shadcn/ui](https://ui.shadcn.com) on [Base UI](https://base-ui.com) with Tailwind CSS 4 |
| Tests | [Vitest](https://vitest.dev) and [convex-test](https://docs.convex.dev/testing/convex-test) |
| Lint and format | [Biome](https://biomejs.dev), run on staged files by [lefthook](https://github.com/evilmartians/lefthook) before each commit |
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
| Convex account | | Dev and production deployments. Log in with `bunx convex login` |
| [GitHub CLI](https://cli.github.com) | logged in | `cstack new` creates the repo |
| [Vercel CLI](https://vercel.com/docs/cli) | logged in | `cstack new` creates the Vercel project |

Turborepo, Biome and lefthook are dev dependencies, so `bun install` brings
them. It also installs the git hooks.

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
| `bun run ci` | What CI runs: Biome, typecheck and tests |
| `bun run build` | Production build of the web app |

## Creating a project

Link the CLI once, from this repo:

```bash
cd cli
bun link
```

Then, from any directory:

```bash
cstack new my-app
```

It copies this repo's working tree into `./my-app`, leaving out `cli/` and
anything gitignored, and renames `cstack` to `my-app`. Then it runs
`git init` and `bun install`. Next it creates a Convex project with a dev and
a production deployment, generates the auth signing keys, and sets every
env var. It commits, creates a private GitHub repo and a Vercel project for
`apps/web`, and pushes.

Before setting env vars it asks for a Google OAuth client and a Resend API
key. Both are optional. It also prints the Google redirect URIs to register.
Without a Google client, sign-in fails at Google until you set one.

| Option | |
| --- | --- |
| `--team <slug>` | Convex team. Asked for when you're in more than one |
| `--local` | A local Convex backend with no account, and no GitHub or Vercel |
| `--no-github`, `--no-vercel` | Skip those steps. No GitHub means no Vercel |
| `--public` | Public GitHub repo |
| `-y`, `--yes` | Don't prompt for credentials or confirmation |

Exporting `CSTACK_GOOGLE_CLIENT_ID`, `CSTACK_GOOGLE_CLIENT_SECRET`,
`CSTACK_RESEND_API_KEY`, `CSTACK_EMAIL_FROM` or `CSTACK_CONVEX_TEAM` skips the
matching prompt. One Google client can serve every project once each
project's redirect URIs are on it.

Vercel's GitHub integration and the [Renovate app](https://github.com/apps/renovate)
need access to each new repo. Granting both "All repositories" once covers
every project after it.

## Deploying

A push to `main` deploys to Vercel. `apps/web/vercel.json` runs
`convex deploy`, which pushes the backend to the production deployment with
`CONVEX_DEPLOY_KEY` and then builds the web app against it.

Preview deployments are off, because only production has a deploy key.
GitHub Actions checks pull requests instead. To turn previews on, add a Convex
preview deploy key as `CONVEX_DEPLOY_KEY` for Vercel's Preview environment.

### Environment variables

These live on the Convex deployment, not in files. Set them in
`packages/backend` with `bunx convex env set NAME`. Add `--prod` for
production. `convex.config.ts` refuses a push until the auth keys and the
Google client are set.

| Variable | |
| --- | --- |
| `AUTH_PRIVATE_KEY`, `AUTH_JWKS` | Signing keys for Convex Auth. `cstack new` generates them |
| `AUTH_GOOGLE_CLIENT_ID`, `AUTH_GOOGLE_CLIENT_SECRET` | The Google OAuth client |
| `SITE_URL` | Where sign-in may send users back to: `http://localhost:3000` in dev, the Vercel URL in production |
| `RESEND_API_KEY` | Without it, emails go to the Convex logs instead of being sent |
| `EMAIL_FROM` | Sender, like `My App <hello@example.com>` |
| `RESEND_WEBHOOK_SECRET` | Optional. Delivery status from Resend, posted to `/resend-webhook` |

### Google sign-in

Google is the only sign-in method. The OAuth client (type Web application)
needs one authorized redirect URI per Convex deployment:

```
<CONVEX_SITE_URL>/oauth/google/callback
```

`CONVEX_SITE_URL` is the deployment's `.convex.site` address. For the dev
deployment it's `VITE_CONVEX_SITE_URL` in `packages/backend/.env.local`. The
path is `/oauth/google/callback`, not v1's `/api/auth/callback/google`.
Google answers a wrong one with `redirect_uri_mismatch`.

While the consent screen is in testing, only accounts listed as test users
can sign in.

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
