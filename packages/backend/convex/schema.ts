import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  workspaces: defineTable({
    name: v.string(),
  }),
  // authUserId is a string because Better Auth's tables live in its component,
  // which v.id() can't reference. Keep it here rather than on other tables.
  memberships: defineTable({
    workspaceId: v.id("workspaces"),
    authUserId: v.string(),
    role: v.literal("owner"),
  }).index("by_authUserId", ["authUserId"]),
});
