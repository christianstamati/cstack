import { describe, expect, test } from "vitest"
import { api, internal } from "./_generated/api"
import { setup, signedInAs } from "./test.setup"

const googleProvider = (profile: { name?: string; picture?: string }) => ({
  name: "google" as const,
  accountId: "google-account-id",
  profile: {
    id: "google-account-id",
    email: "ada@example.com",
    emailVerified: false,
    ...profile,
  },
})

describe("users.viewer", () => {
  test("returns null when signed out", async () => {
    const t = setup()
    expect(await t.query(api.users.viewer, {})).toBeNull()
  })

  test("returns the signed-in user", async () => {
    const t = setup()
    const { userId, as } = await signedInAs(t, "ada@example.com")
    const viewer = await as.query(api.users.viewer, {})
    expect(viewer?._id).toBe(userId)
    expect(viewer?.email).toBe("ada@example.com")
  })
})

describe("Google sign-in callbacks", () => {
  test("creates a user from the Google profile", async () => {
    const t = setup()
    const userId = await t.mutation(internal.users.createGoogleUser, {
      provider: googleProvider({ name: "Ada", picture: "https://img/ada" }),
    })
    const user = await t.run((ctx) => ctx.db.get("users", userId))
    expect(user).toMatchObject({
      name: "Ada",
      email: "ada@example.com",
      image: "https://img/ada",
    })
  })

  test("keeps the profile in sync on later sign-ins", async () => {
    const t = setup()
    const userId = await t.mutation(internal.users.createGoogleUser, {
      provider: googleProvider({ name: "Ada" }),
    })
    await t.mutation(internal.users.syncGoogleProfile, {
      userId,
      provider: googleProvider({ name: "Ada Lovelace" }),
    })
    const user = await t.run((ctx) => ctx.db.get("users", userId))
    expect(user?.name).toBe("Ada Lovelace")
  })
})
