import { ConvexError, v } from "convex/values";

import { components } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import { workspaceQuery } from "./lib/workspaceFunctions";

export const current = workspaceQuery({
  args: {},
  handler: async (ctx) => {
    return {
      _id: ctx.workspace._id,
      name: ctx.workspace.name,
      role: ctx.membership.role,
    };
  },
});

// Gives an existing account its workspace. Run once per deployment:
// npx convex run workspaces:bootstrap '{"email": "...", "name": "..."}'
export const bootstrap = internalMutation({
  args: { email: v.string(), name: v.string() },
  handler: async (ctx, args) => {
    const authUser = await ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: "user",
      where: [{ field: "email", value: args.email }],
    });
    if (!authUser) {
      throw new ConvexError(`No account for ${args.email}`);
    }
    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_authUserId", (q) => q.eq("authUserId", authUser._id))
      .unique();
    if (membership) {
      return membership.workspaceId;
    }
    const workspaceId = await ctx.db.insert("workspaces", { name: args.name });
    await ctx.db.insert("memberships", {
      workspaceId,
      authUserId: authUser._id,
      role: "owner",
    });
    return workspaceId;
  },
});
