/// <reference types="vite/client" />
import { convexTest } from "convex-test"
import type { Id } from "./_generated/dataModel"
import schema from "./schema"

// Every Convex module except tests, configs and this file (names with extra
// dots). Vite 8 globs don't support extglobs like `!(*.*.*)`, hence the array.
export const modules = import.meta.glob(["./**/*.*s", "!./**/*.*.*s"])

export function setup() {
  return convexTest(schema, modules)
}

export type TestConvex = ReturnType<typeof setup>

/** Creates a user and returns a client authenticated as them. */
export async function signedInAs(t: TestConvex, email: string) {
  const userId: Id<"users"> = await t.run((ctx) =>
    ctx.db.insert("users", { email })
  )
  // Convex Auth uses the user's id as the token subject.
  return { userId, as: t.withIdentity({ subject: userId }) }
}
