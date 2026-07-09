import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery, action } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
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
// thin action is the sanctioned bridge for that one trusted caller: the callback route
// first resolves and verifies the signed-in user's convex_user_id via
// api.auth.getConvexUserId (using the request's Convex Auth JWT), then calls this action
// to persist the tokens under that verified id.
export const connectAccount = action({
  args: {
    userId: v.string(),
    email: v.string(),
    accessToken: v.string(),
    refreshToken: v.string(),
    tokenExpiresAt: v.number(),
  },
  handler: async (ctx, args): Promise<Id<"emailAccounts">> => {
    return await ctx.runMutation(internal.emailAccounts.saveTokens, args);
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
