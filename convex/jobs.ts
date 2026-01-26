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

    // Get jobs by userId (convex_user_id) only
    return await ctx.db
      .query("jobs")
      .withIndex("by_user", (q) => q.eq("userId", convexUserId))
      .collect();
  },
});

export const get = query({
  args: { id: v.id("jobs") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    // Get user to access convex_user_id
    const user = await ctx.db.get(userId);
    if (!user) return null;

    const convexUserId = (user as any).convex_user_id || userId;

    const job = await ctx.db.get(args.id);
    if (!job) return null;

    // Verify ownership by userId (convex_user_id) only
    if (job.userId !== convexUserId) {
      return null;
    }

    return job;
  },
});

export const add = mutation({
  args: {
    company: v.string(),
    title: v.string(),
    link: v.string(),
    status: v.string(),
    compensation: v.optional(v.string()),
    keywords: v.optional(v.array(v.string())),
    skills: v.optional(v.array(v.string())),
    description: v.optional(v.string()),
    dateApplied: v.optional(v.string()),
    interviewed: v.optional(v.boolean()),
    easyApply: v.optional(v.string()),
    resumeUsed: v.optional(v.string()),
    coverLetterUsed: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if user can add jobs
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");

    const convexUserId = (user as any).convex_user_id || userId;

    // Get subscription
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", convexUserId))
      .first();

    const planId = subscription?.planId || "free";

    // Define limits (null means unlimited)
    const PLAN_LIMITS: Record<string, number | null> = {
      free: 10,
      starter: 100,
      plus: 100,
      "plus-annual": 100,
      pro: null, // Unlimited
      "pro-annual": null, // Unlimited
    };

    const limit = PLAN_LIMITS[planId] ?? PLAN_LIMITS.free;

    // If not unlimited, check limit
    if (limit !== null) {
      const allJobs = await ctx.db
        .query("jobs")
        .withIndex("by_user", (q) => q.eq("userId", convexUserId))
        .collect();

      const jobsCount = allJobs.length;

      if (jobsCount >= limit) {
        throw new Error(`Job limit reached. You can track up to ${limit} jobs on your current plan. Upgrade to Pro for unlimited job tracking.`);
      }
    }

    const now = Date.now();
    return await ctx.db.insert("jobs", {
      userId: convexUserId, // Use convex_user_id as the sole identifier
      ...args,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("jobs"),
    company: v.optional(v.string()),
    title: v.optional(v.string()),
    link: v.optional(v.string()),
    status: v.optional(v.string()),
    compensation: v.optional(v.string()),
    keywords: v.optional(v.array(v.string())),
    skills: v.optional(v.array(v.string())),
    description: v.optional(v.string()),
    dateApplied: v.optional(v.string()),
    interviewed: v.optional(v.boolean()),
    easyApply: v.optional(v.string()),
    resumeUsed: v.optional(v.string()),
    coverLetterUsed: v.optional(v.string()),
    notes: v.optional(v.string()),
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
    const job = await ctx.db.get(id);
    if (!job || job.userId !== convexUserId) {
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
    id: v.id("jobs"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Get user to access convex_user_id
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");

    const convexUserId = (user as any).convex_user_id || userId;

    // Verify ownership by userId (convex_user_id) only
    const job = await ctx.db.get(args.id);
    if (!job || job.userId !== convexUserId) {
      throw new Error("Not authorized");
    }

    await ctx.db.delete(args.id);
  },
});

// Internal mutation for agent to add jobs (bypasses auth since HTTP action handles it)
export const addInternal = internalMutation({
  args: {
    userId: v.string(), // Required: convex_user_id
    company: v.string(),
    title: v.string(),
    link: v.string(),
    status: v.string(),
    keywords: v.optional(v.array(v.string())),
    skills: v.optional(v.array(v.string())),
    description: v.optional(v.string()),
    dateApplied: v.optional(v.string()),
    interviewed: v.optional(v.boolean()),
    easyApply: v.optional(v.string()),
    resumeUsed: v.optional(v.string()),
    coverLetterUsed: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // userId must be the convex_user_id
    const { userId, ...jobData } = args;
    const now = Date.now();
    return await ctx.db.insert("jobs", {
      userId, // Use convex_user_id as the sole identifier
      ...jobData,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Public mutation for agent tool to add jobs with userId
export const addForAgent = mutation({
  args: {
    userId: v.string(), // Required: convex_user_id
    company: v.string(),
    title: v.string(),
    link: v.string(),
    status: v.string(),
    compensation: v.optional(v.string()),
    keywords: v.optional(v.array(v.string())),
    skills: v.optional(v.array(v.string())),
    description: v.optional(v.string()),
    dateApplied: v.optional(v.string()),
    interviewed: v.optional(v.boolean()),
    easyApply: v.optional(v.string()),
    resumeUsed: v.optional(v.string()),
    coverLetterUsed: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Note: This is a special mutation for the agent
    // userId must be the convex_user_id
    const { userId, ...jobData } = args;
    const now = Date.now();
    return await ctx.db.insert("jobs", {
      userId, // Use convex_user_id as the sole identifier
      ...jobData,
      createdAt: now,
      updatedAt: now,
    });
  },
});

