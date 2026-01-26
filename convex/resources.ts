import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    // Get user to access convex_user_id
    const user = await ctx.db.get(userId);
    if (!user) return null;

    const convexUserId = (user as any).convex_user_id || userId;

    // Get resources by userId (convex_user_id) only
    return await ctx.db
      .query("resources")
      .withIndex("by_user", (q) => q.eq("userId", convexUserId))
      .collect();
  },
});

export const add = mutation({
  args: {
    type: v.string(),
    title: v.string(),
    url: v.string(),
    description: v.optional(v.string()),
    notes: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");

    const convexUserId = (user as any).convex_user_id || userId;

    const now = Date.now();
    return await ctx.db.insert("resources", {
      userId: convexUserId, // Use convex_user_id as the sole identifier
      ...args,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("resources"),
    type: v.string(),
    title: v.string(),
    url: v.string(),
    description: v.optional(v.string()),
    notes: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Get user to access convex_user_id
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");

    const convexUserId = (user as any).convex_user_id || userId;

    const { id, ...updates } = args;
    
    // Verify ownership by userId (convex_user_id) only
    const resource = await ctx.db.get(id);
    if (!resource || resource.userId !== convexUserId) {
      throw new Error("Not authorized");
    }

    await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: {
    id: v.id("resources"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Get user to access convex_user_id
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");

    const convexUserId = (user as any).convex_user_id || userId;

    // Verify ownership by userId (convex_user_id) only
    const resource = await ctx.db.get(args.id);
    if (!resource || resource.userId !== convexUserId) {
      throw new Error("Not authorized");
    }

    await ctx.db.delete(args.id);
  },
});

// Internal mutation for agent to add resources (bypasses auth since HTTP action handles it)
export const addInternal = internalMutation({
  args: {
    userId: v.string(), // Required: convex_user_id
    type: v.string(),
    title: v.string(),
    url: v.string(),
    description: v.optional(v.string()),
    notes: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // userId must be the convex_user_id
    const { userId, ...resourceData } = args;
    const now = Date.now();
    return await ctx.db.insert("resources", {
      userId, // Use convex_user_id as the sole identifier
      ...resourceData,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Public mutation for agent tool to add resources with userId
export const addForAgent = mutation({
  args: {
    userId: v.string(), // Required: convex_user_id
    type: v.string(),
    title: v.string(),
    url: v.string(),
    description: v.optional(v.string()),
    notes: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Note: This is a special mutation for the agent
    // userId must be the convex_user_id
    const { userId, ...resourceData } = args;
    const now = Date.now();
    return await ctx.db.insert("resources", {
      userId, // Use convex_user_id as the sole identifier
      ...resourceData,
      createdAt: now,
      updatedAt: now,
    });
  },
});

