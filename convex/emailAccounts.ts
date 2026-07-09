import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery, action } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const user = await ctx.db.get(userId);
    const convexUserId = (user as any)?.convex_user_id || userId;

    const accounts = await ctx.db
      .query("emailAccounts")
      .withIndex("by_user", (q) => q.eq("userId", convexUserId))
      .collect();

    return accounts.map((a) => ({
      _id: a._id,
      email: a.email,
      status: a.status,
      connectedAt: a.connectedAt,
    }));
  },
});

export const disconnect = mutation({
  args: { accountId: v.id("emailAccounts") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const user = await ctx.db.get(userId);
    const convexUserId = (user as any)?.convex_user_id || userId;

    const account = await ctx.db.get(args.accountId);
    if (!account || account.userId !== convexUserId) {
      throw new Error("Account not found");
    }
    await ctx.db.patch(args.accountId, { status: "revoked" as const });
    return { success: true };
  },
});

export const saveTokens = internalMutation({
  args: {
    userId: v.string(),
    email: v.string(),
    accessToken: v.string(),
    refreshToken: v.string(),
    tokenExpiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("emailAccounts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("email"), args.email))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        accessToken: args.accessToken,
        refreshToken: args.refreshToken,
        tokenExpiresAt: args.tokenExpiresAt,
        status: "active" as const,
      });
      return existing._id;
    }

    return await ctx.db.insert("emailAccounts", {
      userId: args.userId,
      email: args.email,
      accessToken: args.accessToken,
      refreshToken: args.refreshToken,
      tokenExpiresAt: args.tokenExpiresAt,
      status: "active" as const,
      connectedAt: Date.now(),
    });
  },
});

// Public wrapper around saveTokens.
//
// saveTokens is intentionally an internalMutation (per the plan) so other Convex
// functions can call it via ctx.runMutation without exposing raw token-writing to
// clients. But the Next.js OAuth callback route (app/api/gmail/oauth/callback/route.ts)
// runs OUTSIDE Convex and talks to the deployment only over the public HTTP client -
// Convex rejects any attempt to invoke an internalMutation/internalQuery/internalAction
// that way ("Internal functions can only be called by other Convex functions"). This
// thin action is the sanctioned bridge for that one trusted caller.
//
// connectAccount must never trust a caller-supplied userId: unlike the earlier version
// of this action, it no longer accepts a userId argument at all. Instead it resolves the
// acting user's identity itself, the same way list/disconnect above do (getAuthUserId ->
// users row -> convex_user_id fallback) - here via api.auth.getConvexUserId, which
// performs that exact resolution and is already the source of truth the callback route
// used to verify the caller before this fix. ctx.runQuery propagates the action's own
// auth context, so this reflects only the identity of whoever is actually calling this
// action, never a client-supplied value. Without this, any caller could pass an
// arbitrary userId and overwrite another user's stored Gmail tokens via saveTokens'
// existing-row lookup. This also matches convex/jobs.ts's add mutation, which never
// accepts a client-supplied userId either.
export const connectAccount = action({
  args: {
    email: v.string(),
    accessToken: v.string(),
    refreshToken: v.string(),
    tokenExpiresAt: v.number(),
  },
  handler: async (ctx, args): Promise<Id<"emailAccounts">> => {
    const convexUserId = await ctx.runQuery(api.auth.getConvexUserId, {});
    if (!convexUserId) throw new Error("Not authenticated");

    return await ctx.runMutation(internal.emailAccounts.saveTokens, {
      ...args,
      userId: convexUserId,
    });
  },
});

export const getActiveAccounts = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("emailAccounts")
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();
  },
});

export const updateTokens = internalMutation({
  args: {
    accountId: v.id("emailAccounts"),
    accessToken: v.string(),
    tokenExpiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.accountId, {
      accessToken: args.accessToken,
      tokenExpiresAt: args.tokenExpiresAt,
    });
  },
});

export const updateHistoryId = internalMutation({
  args: { accountId: v.id("emailAccounts"), historyId: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.accountId, { historyId: args.historyId });
  },
});

export const markRevoked = internalMutation({
  args: { accountId: v.id("emailAccounts") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.accountId, { status: "revoked" as const });
  },
});
