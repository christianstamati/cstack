import { ConvexError } from "convex/values"

/**
 * User-facing message for an error thrown by a Convex function.
 * Only `ConvexError`s carry messages meant for users; anything else is
 * redacted in production, so fall back to a generic message.
 */
export function errorMessage(
  error: unknown,
  fallback = "Something went wrong"
) {
  if (error instanceof ConvexError && typeof error.data === "string") {
    return error.data
  }
  return fallback
}
