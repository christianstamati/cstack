import { getAuthUserId } from "@convex-dev/auth/core"
import { vGoogleProfile } from "@convex-dev/auth/providers/oauth/google"
import { v } from "convex/values"
import { doc } from "convex-helpers/validators"
import { internalMutation, query } from "./_generated/server"
import { sendEmail } from "./lib/email"
import schema from "./schema"

const vGoogleProvider = v.object({
  name: v.literal("google"),
  accountId: v.string(),
  profile: vGoogleProfile,
})

/** The signed-in user, or null when signed out. */
export const viewer = query({
  args: {},
  returns: v.union(v.null(), doc(schema, "users")),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (userId === null) {
      return null
    }
    return await ctx.db.get("users", userId)
  },
})

/** Called by Convex Auth the first time a Google account signs in. */
export const createGoogleUser = internalMutation({
  args: { provider: vGoogleProvider },
  returns: v.id("users"),
  handler: async (ctx, { provider: { profile } }) => {
    const userId = await ctx.db.insert("users", {
      name: profile.name,
      email: profile.email,
      image: profile.picture,
    })

    if (profile.email && profile.emailVerified) {
      await sendEmail(ctx, {
        to: profile.email,
        subject: "Welcome to cstack",
        text: `Hi ${profile.name ?? "there"},\n\nThanks for signing up for cstack.`,
        html: `<p>Hi ${escapeHtml(profile.name ?? "there")},</p><p>Thanks for signing up for cstack.</p>`,
      })
    }

    return userId
  },
})

/** Called on every Google sign-in, so the profile stays current. */
export const syncGoogleProfile = internalMutation({
  args: { provider: vGoogleProvider, userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, { provider: { profile }, userId }) => {
    await ctx.db.patch("users", userId, {
      name: profile.name,
      email: profile.email,
      image: profile.picture,
    })
    return null
  },
})

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}
