import {
  customCtx,
  customMutation,
  customQuery,
} from "convex-helpers/server/customFunctions";
import { ConvexError } from "convex/values";

import { mutation, query, type QueryCtx } from "../_generated/server";
import { authComponent } from "../auth";

async function requireWorkspace(ctx: QueryCtx) {
  const authUser = await authComponent.getAuthUser(ctx);
  // Users have one workspace for now. unique() throws on a second membership,
  // so supporting several has to start here.
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_authUserId", (q) => q.eq("authUserId", authUser._id))
    .unique();
  if (!membership) {
    throw new ConvexError("No workspace");
  }
  const workspace = await ctx.db.get("workspaces", membership.workspaceId);
  if (!workspace) {
    throw new ConvexError("No workspace");
  }
  return { workspace, membership };
}

// Public functions that touch workspace data use these instead of query and
// mutation, and scope every read and write to ctx.workspace._id.
export const workspaceQuery = customQuery(query, customCtx(requireWorkspace));
export const workspaceMutation = customMutation(mutation, customCtx(requireWorkspace));
