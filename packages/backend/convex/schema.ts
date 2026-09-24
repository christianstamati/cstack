import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

export default defineSchema({
  // App users. Convex Auth keeps accounts and sessions in its own component
  // and maps them to rows here through the callbacks in convex/users.ts.
  users: defineTable({
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    image: v.optional(v.string()),
  }).index("by_email", ["email"]),

  // Example feature. Delete it (and convex/tasks.ts) once you have your own.
  tasks: defineTable({
    userId: v.id("users"),
    text: v.string(),
    completed: v.boolean(),
  }).index("by_user", ["userId"]),
})
