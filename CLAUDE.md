# Project conventions

Bun + Turborepo monorepo. See README.md for commands and deployment.

- `apps/web`: TanStack Start (React 19), file routes in `src/routes`
- `packages/backend`: Convex functions in `convex/`, imported by the web app as `@workspace/backend/api`
- `packages/ui`: shadcn/ui components (Base UI primitives, Tailwind CSS 4), imported as `@workspace/ui/components/<name>`

Before finishing a change, run `bun run check:fix`, `bun run typecheck` and `bun run test`.

## Backend (Convex)

- Every public or internal function declares `args` and `returns` validators. Use `doc(schema, "table")` from `convex-helpers/validators` for document return types.
- Query with indexes (`withIndex`), never `filter` over a whole table.
- Get the caller with `getAuthUserId(ctx)` from `@convex-dev/auth/core` (returns the `users` id or null), or `requireUserId(ctx)` from `convex/lib/auth.ts`. Check ownership before reading or writing another user's documents.
- Throw `ConvexError("message")` for errors the user should see; other errors are redacted in production.
- Queries that the UI subscribes to return an empty value for signed-out callers instead of throwing.
- Send email with `sendEmail(ctx, ...)` from `convex/lib/email.ts`.
- Test with convex-test: `setup()` and `signedInAs(t, email)` from `convex/test.setup.ts`. Test files are `*.test.ts` next to the code.
- Deployment env vars are validated in `convex/convex.config.ts`. Add new required ones there.
- Auth is Convex Auth v2 (alpha, no written docs yet). The API reference is the examples at https://github.com/get-convex/convex-auth/tree/v2.0.0-alpha.2/examples.

## Web

- Read data with `useSuspenseQuery(convexQuery(api.module.fn, args))` or `useQuery(...)`: these are live subscriptions.
- Write with `useMutation({ mutationFn: useConvexMutation(api.module.fn) })`, and show failures with `toast.error(errorMessage(error))`.
- Routes under `src/routes/_authed/` require a signed-in user and render on the client only (the session lives in the browser).
- Add UI components with `bun run ui:add <name>` rather than writing them by hand. Files in `packages/ui/src/components` are vendored from shadcn; keep edits minimal.
- Import app code with the `@/` alias (`apps/web/src`).

## Tooling

- TypeScript 7: `tsc` is the Go-based compiler. There is no TypeScript JS API, so avoid tools that need one.
- Biome replaces ESLint and Prettier. lefthook runs it on staged files before each commit.
- Generated files, don't edit: `apps/web/src/routeTree.gen.ts`, `packages/backend/convex/_generated/`.
