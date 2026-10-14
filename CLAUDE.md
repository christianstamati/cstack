# Project conventions

<!-- cstack:if repo=true -->
This repo is the cstack template and the `create-cstack-app` CLI (`cli/`). It is itself the TanStack Start + Convex project. The CLI derives the other stacks (`--frontend`, `--backend`) by removing what doesn't apply (`cli/src/stack.ts`) and copying files from `cli/template/variants/` over the result. Text between `<!-- cstack:if name=value -->` and `<!-- cstack:end -->` only goes into projects of that stack; in this repo, follow the `frontend=tanstack-start` and `backend=convex` parts.

- When you change something a variant also has (a dependency, a component, a convention), update the variant too. Dependency versions marked `"repo"` in a variant's `package.json` come from `apps/web/package.json`.
- Run `bun run --cwd cli verify` after changing the template or the CLI. It generates every stack and installs, checks, tests and builds each one.

<!-- cstack:end -->
Bun workspaces monorepo on [Vite+](https://viteplus.dev) (`vp`). See README.md for commands and deployment.

<!-- cstack:if frontend=tanstack-start -->
- `apps/web`: TanStack Start (React 19), file routes in `src/routes`
<!-- cstack:end -->
<!-- cstack:if frontend=nextjs -->
- `apps/web`: Next.js (React 19, App Router), routes in `src/app`
<!-- cstack:end -->
<!-- cstack:if backend=convex -->
- `packages/backend`: Convex functions in `convex/`, imported by the web app as `@workspace/backend/api`
<!-- cstack:end -->
- `packages/ui`: shadcn/ui components (Base UI primitives, Tailwind CSS 4), imported as `@workspace/ui/components/<name>`

<!-- cstack:if backend=convex -->
Before finishing a change, run `bun run check:fix` and `bun run test`, and fix every error.

## Backend (Convex)

- Every public or internal function declares `args` and `returns` validators. Use `doc(schema, "table")` from `convex-helpers/validators` for document return types.
- Query with indexes (`withIndex`), never `filter` over a whole table.
- Get the caller with `getAuthUserId(ctx)` from `@convex-dev/auth/core` (returns the `users` id or null), or `requireUserId(ctx)` from `convex/lib/auth.ts`. Check ownership before reading or writing another user's documents.
- Throw `ConvexError("message")` for errors the user should see; other errors are redacted in production.
- Queries that the UI subscribes to return an empty value for signed-out callers instead of throwing.
- Test with convex-test: `setup()` and `signedInAs(t, email)` from `convex/test.setup.ts`. Test files are `*.test.ts` next to the code.
- Deployment env vars are validated in `convex/convex.config.ts`. Add new required ones there.
- Auth is Convex Auth v2 (alpha, no written docs yet). The API reference is the examples at https://github.com/get-convex/convex-auth/tree/v2.0.0-alpha.2/examples.
<!-- cstack:end -->
<!-- cstack:if backend=none -->
Before finishing a change, run `bun run check:fix` and fix every error.
<!-- cstack:end -->

## Web

<!-- cstack:if backend=convex -->
- Read data with `useSuspenseQuery(convexQuery(api.module.fn, args))` or `useQuery(...)`: these are live subscriptions.
- Write with `useMutation({ mutationFn: useConvexMutation(api.module.fn), onError: toastError })` (`toastError` is in `@/lib/errors`).
- Confirm creates and deletes with a short `toast.success("Task added")`. Put the callback on `useMutation` when the component unmounts on success (a deleted row), since `mutate()` callbacks don't run after unmount.
<!-- cstack:end -->
- Show empty states (no data, not found) with `Empty` from `@workspace/ui/components/empty`.
<!-- cstack:if frontend=tanstack-start -->
<!-- cstack:if backend=convex -->
- Routes under `src/routes/_authed/` require a signed-in user and render on the client only (the session lives in the browser).
<!-- cstack:end -->
<!-- cstack:end -->
<!-- cstack:if frontend=nextjs -->
<!-- cstack:if backend=convex -->
- Pages in the `src/app/(authed)/` route group require a signed-in user and render on the client only (the session lives in the browser).
<!-- cstack:end -->
- Components are Server Components unless they say otherwise. Put `"use client"` only on the files that are entry points into client code (a page, a layout, or a component a Server Component renders) when they use state, effects or browser APIs; everything they import is client code already.
- Client pages can't export `metadata`; set their title in a server `layout.tsx` next to them.
<!-- cstack:end -->
- Add UI components with `bun run ui:add <name>` rather than writing them by hand. Files in `packages/ui/src/components` are vendored from shadcn; keep edits minimal.
- Import app code with the `@/` alias (`apps/web/src`).

### Components

- One component per file in `apps/web/src/components/<feature>/`, and the file is named after the component in PascalCase: `TaskList.tsx` exports `TaskList`. Oxlint enforces the file names. Feature folders are lowercase (`tasks`, `auth`, `layout`).
- Name components after what they render: `TaskList` renders tasks, `AddTaskForm` adds one, `InvoiceTable` renders a table.
- Components fetch their own data and own their mutations, so a page doesn't pass query results or callbacks down.
<!-- cstack:if frontend=tanstack-start -->
- Route files in `src/routes` keep route config (search params, `head`, `ssr`) and a page component that only lays out feature components.
<!-- cstack:end -->
<!-- cstack:if frontend=nextjs -->
- `page.tsx` and `layout.tsx` files in `src/app` keep route config (`metadata`, params) and only lay out feature components.
<!-- cstack:end -->
- shadcn primitives in `packages/ui` keep their kebab-case names.

## Design system

`bun run check` runs [@shadcn/lint](https://github.com/shadcn-ui/lint) through Oxlint (the `lint` block in the root `vite.config.ts`) to keep the UI consistent. Fix what it reports instead of silencing it; its messages name the variant, size or token to use.

- Style a component through its props (`variant`, `size`), not `className`. Call sites may only add layout classes (margin, width, flex, position). `Card`, and any component whose name ends in `Content`, `Header` or `Footer` (`CardContent`, `DialogFooter`), also accepts spacing.
- Colors come from theme tokens (`bg-primary`, `text-muted-foreground`), never the Tailwind palette (`bg-zinc-100`).
- No arbitrary values (`p-[13px]`, `w-[420px]`). Use the scale (`p-3.25`, `w-105`).
- No inline `style`, and no class strings built at runtime on components.
- When a design needs a look no variant provides, add a variant (or a token in `packages/ui/src/styles/globals.css`) and call it out as a design decision. Changing the policy in `vite.config.ts` is also a design decision.

## Tooling

- TypeScript 7: `tsc` is the Go-based compiler. There is no TypeScript JS API, so avoid tools that need one.
- Vite+ replaces Turborepo, Biome and lefthook. `vp check` formats with Oxfmt, lints with Oxlint and type-checks every package with tsgolint (TypeScript 7, each package's own tsconfig); its config is the `fmt` and `lint` blocks of the root `vite.config.ts`. `vp run -r` runs package scripts in dependency order. A pre-commit hook in `.vite-hooks/` runs `vp staged`.
- Import Vite and Vitest APIs from `vite-plus` and `vite-plus/test`, not `vite` or `vitest`. `vite` and `vite-plus` versions come from the `catalog` in the root `package.json`; keep them in step.
<!-- cstack:if frontend=nextjs -->
- Next.js builds with Turbopack, not Vite. `next build` skips its own type check (`typescript.ignoreBuildErrors`), because it needs the TypeScript JS API; `vp check` covers it.
<!-- cstack:end -->
<!-- cstack:if frontend=tanstack-start -->
<!-- cstack:if backend=convex -->
- Generated files, don't edit: `apps/web/src/routeTree.gen.ts`, `packages/backend/convex/_generated/`.
<!-- cstack:end -->
<!-- cstack:if backend=none -->
- Generated file, don't edit: `apps/web/src/routeTree.gen.ts`.
<!-- cstack:end -->
<!-- cstack:end -->
<!-- cstack:if frontend=nextjs -->
<!-- cstack:if backend=convex -->
- Generated files, don't edit: `packages/backend/convex/_generated/`, `apps/web/next-env.d.ts`.
<!-- cstack:end -->
<!-- cstack:if backend=none -->
- Generated file, don't edit: `apps/web/next-env.d.ts`.
<!-- cstack:end -->
<!-- cstack:end -->
