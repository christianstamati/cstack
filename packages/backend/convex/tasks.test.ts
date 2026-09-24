import { describe, expect, test } from "vitest"
import { api } from "./_generated/api"
import { setup, signedInAs } from "./test.setup"

describe("tasks", () => {
  test("signed-out users see an empty list and cannot create tasks", async () => {
    const t = setup()
    expect(await t.query(api.tasks.list, {})).toEqual([])
    await expect(t.mutation(api.tasks.create, { text: "Hi" })).rejects.toThrow(
      "You must be signed in"
    )
  })

  test("creates, toggles and removes a task", async () => {
    const t = setup()
    const { as } = await signedInAs(t, "ada@example.com")

    const id = await as.mutation(api.tasks.create, { text: "  Ship it  " })
    expect(await as.query(api.tasks.list, {})).toMatchObject([
      { _id: id, text: "Ship it", completed: false },
    ])

    await as.mutation(api.tasks.toggle, { id })
    expect(await as.query(api.tasks.list, {})).toMatchObject([
      { completed: true },
    ])

    await as.mutation(api.tasks.remove, { id })
    expect(await as.query(api.tasks.list, {})).toEqual([])
  })

  test("rejects empty tasks", async () => {
    const t = setup()
    const { as } = await signedInAs(t, "ada@example.com")
    await expect(
      as.mutation(api.tasks.create, { text: "   " })
    ).rejects.toThrow("between 1 and 500")
  })

  test("users only see and change their own tasks", async () => {
    const t = setup()
    const ada = await signedInAs(t, "ada@example.com")
    const bob = await signedInAs(t, "bob@example.com")

    const id = await ada.as.mutation(api.tasks.create, { text: "Private" })

    expect(await bob.as.query(api.tasks.list, {})).toEqual([])
    await expect(bob.as.mutation(api.tasks.toggle, { id })).rejects.toThrow(
      "Task not found"
    )
    await expect(bob.as.mutation(api.tasks.remove, { id })).rejects.toThrow(
      "Task not found"
    )
    expect(await ada.as.query(api.tasks.list, {})).toHaveLength(1)
  })
})
