import { v } from "convex/values";
import { mutation, query, internalQuery, internalMutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// Generate a simple API key: jk_[random hex]
function generateApiKey(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let key = "jk_";
  for (let i = 0; i < 32; i++) {
    key += chars[Math.floor(Math.random() * chars.length)];
  }
  return key;
}

// Generate a new API key for the authenticated user
export const generate = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");

    const convexUserId = (user as any).convex_user_id || userId;

    // Revoke any existing keys for this user
    const existingKeys = await ctx.db
      .query("extensionApiKeys")
      .withIndex("by_user", (q: any) => q.eq("userId", convexUserId))
      .collect();

    for (const key of existingKeys) {
      await ctx.db.patch(key._id, { isActive: false });
    }

    // Create new key
    const apiKey = generateApiKey();
    const now = Date.now();

    await ctx.db.insert("extensionApiKeys", {
      userId: convexUserId,
      key: apiKey,
      isActive: true,
      createdAt: now,
      lastUsedAt: now,
    });

    return apiKey;
  },
});

// Get the current active API key for the authenticated user
export const get = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const user = await ctx.db.get(userId);
    if (!user) return null;

    const convexUserId = (user as any).convex_user_id || userId;

    const activeKey = await ctx.db
      .query("extensionApiKeys")
      .withIndex("by_user", (q: any) => q.eq("userId", convexUserId))
      .filter((q: any) => q.eq(q.field("isActive"), true))
      .first();

    if (!activeKey) return null;

    return {
      key: activeKey.key,
      createdAt: activeKey.createdAt,
      lastUsedAt: activeKey.lastUsedAt,
    };
  },
});

// Revoke the current API key
export const revoke = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");

    const convexUserId = (user as any).convex_user_id || userId;

    const activeKeys = await ctx.db
      .query("extensionApiKeys")
      .withIndex("by_user", (q: any) => q.eq("userId", convexUserId))
      .filter((q: any) => q.eq(q.field("isActive"), true))
      .collect();

    for (const key of activeKeys) {
      await ctx.db.patch(key._id, { isActive: false });
    }

    return { success: true };
  },
});

// Internal: Look up a user by API key (used by HTTP endpoint)
export const lookupByKey = internalQuery({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const apiKeyRecord = await ctx.db
      .query("extensionApiKeys")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();

    if (!apiKeyRecord || !apiKeyRecord.isActive) {
      return null;
    }

    return {
      _id: apiKeyRecord._id,
      userId: apiKeyRecord.userId,
    };
  },
});

// Internal: Update lastUsedAt timestamp (called from extension action)
export const markUsed = internalMutation({
  args: { keyId: v.id("extensionApiKeys") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.keyId, { lastUsedAt: Date.now() });
  },
});
