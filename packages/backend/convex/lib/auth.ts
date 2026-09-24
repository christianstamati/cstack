import { getAuthUserId } from "@convex-dev/auth/core"
import { ConvexError } from "convex/values"
import type { QueryCtx } from "../_generated/server"

/** Returns the signed-in user's id, or throws if nobody is signed in. */
export async function requireUserId(ctx: QueryCtx) {
  const userId = await getAuthUserId(ctx)
  if (userId === null) {
    throw new ConvexError("You must be signed in")
  }
  return userId
}
