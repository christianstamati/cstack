# Project conventions

Bun + Turborepo monorepo. See README.md for commands and deployment.

- `apps/web`: TanStack Start (React 19), file routes in `src/routes`
- `packages/backend`: Convex functions in `convex/`, imported by the web app as `@workspace/backend/api`
- `packages/ui`: shadcn/ui components (Base UI primitives, Tailwind CSS 4), imported as `@workspace/ui/components/<name>`

Before finishing a change, run `bun run check:fix`, `bun run lint`, `bun run typecheck` and `bun run test`, and fix every error.

## Backend (Convex)

- Every public or internal function declares `args` and `returns` validators. Use `doc(schema, "table")` from `convex-helpers/validators` for document return types.
- Query with indexes (`withIndex`), never `filter` over a whole table.
- Get the caller with `getAuthUserId(ctx)` from `@convex-dev/auth/core` (returns the `users` id or null), or `requireUserId(ctx)` from `convex/lib/auth.ts`. Check ownership before reading or writing another user's documents.
- Throw `ConvexError("message")` for errors the user should see; other errors are redacted in production.
- Queries that the UI subscribes to return an empty value for signed-out callers instead of throwing.
- Test with convex-test: `setup()` and `signedInAs(t, email)` from `convex/test.setup.ts`. Test files are `*.test.ts` next to the code.
- Deployment env vars are validated in `convex/convex.config.ts`. Add new required ones there.
- Auth is Convex Auth v2 (alpha, no written docs yet). The API reference is the examples at https://github.com/get-convex/convex-auth/tree/v2.0.0-alpha.2/examples.

## Web

- Read data with `useSuspenseQuery(convexQuery(api.module.fn, args))` or `useQuery(...)`: these are live subscriptions.
- Write with `useMutation({ mutationFn: useConvexMutation(api.module.fn), onError: toastError })` (`toastError` is in `@/lib/errors`).
- Confirm creates and deletes with a short `toast.success("Task added")`. Put the callback on `useMutation` when the component unmounts on success (a deleted row), since `mutate()` callbacks don't run after unmount.
- Show empty states (no data, not found) with `Empty` from `@workspace/ui/components/empty`.
- Routes under `src/routes/_authed/` require a signed-in user and render on the client only (the session lives in the browser).
- Add UI components with `bun run ui:add <name>` rather than writing them by hand. Files in `packages/ui/src/components` are vendored from shadcn; keep edits minimal.
- Import app code with the `@/` alias (`apps/web/src`).

### Components

- One component per file in `apps/web/src/components/<feature>/`, and the file is named after the component in PascalCase: `TaskList.tsx` exports `TaskList`. Biome enforces the file names. Feature folders are lowercase (`tasks`, `auth`, `layout`).
- Name components after what they render: `TaskList` renders tasks, `AddTaskForm` adds one, `InvoiceTable` renders a table.
- Components fetch their own data and own their mutations, so a page doesn't pass query results or callbacks down.
- Route files in `src/routes` keep route config (search params, `head`, `ssr`) and a page component that only lays out feature components.
- shadcn primitives in `packages/ui` keep their kebab-case names.

## Design system

`bun run lint` runs [@shadcn/lint](https://github.com/shadcn-ui/lint) through Oxlint (`.oxlintrc.json`) to keep the UI consistent. Fix what it reports instead of silencing it; its messages name the variant, size or token to use.

- Style a component through its props (`variant`, `size`), not `className`. Call sites may only add layout classes (margin, width, flex, position). `Card`, and any component whose name ends in `Content`, `Header` or `Footer` (`CardContent`, `DialogFooter`), also accepts spacing.
- Colors come from theme tokens (`bg-primary`, `text-muted-foreground`), never the Tailwind palette (`bg-zinc-100`).
- No arbitrary values (`p-[13px]`, `w-[420px]`). Use the scale (`p-3.25`, `w-105`).
- No inline `style`, and no class strings built at runtime on components.
- When a design needs a look no variant provides, add a variant (or a token in `packages/ui/src/styles/globals.css`) and call it out as a design decision. Changing the policy in `.oxlintrc.json` is also a design decision.

## Tooling

- TypeScript 7: `tsc` is the Go-based compiler. There is no TypeScript JS API, so avoid tools that need one.
- Biome replaces ESLint and Prettier. Oxlint runs only the shadcn rules; its own rules are off so the two never overlap. lefthook runs both on staged files before each commit.
- Generated files, don't edit: `apps/web/src/routeTree.gen.ts`, `packages/backend/convex/_generated/`.
