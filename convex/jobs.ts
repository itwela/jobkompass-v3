import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

const PLAN_LIMITS: Record<string, number | null> = {
  free: 10,
  starter: 100,
  plus: 100,
  "plus-annual": 100,
  pro: null, // Unlimited
  "pro-annual": null, // Unlimited
};

function planLabelFromPlanId(planId: string) {
  if (planId === "free") return "Free";
  if (planId === "starter") return "Starter";
  if (planId === "plus" || planId === "plus-annual") return "Plus";
  if (planId === "pro" || planId === "pro-annual") return "Pro";
  return planId;
}

function upgradeSuggestionForPlan(planId: string) {
  if (planId === "free") return "Upgrade to Plus (100 jobs) or Pro (unlimited jobs).";
  if (planId === "starter" || planId === "plus" || planId === "plus-annual") {
    return "Upgrade to Pro for unlimited job tracking.";
  }
  return "Upgrade your plan to increase job limits.";
}


// ROS THIS IS GIVING ERRORS
async function resolveJobLimitForUser(ctx: any, convexUserId: string) {
  let subscription = await ctx.db
    .query("subscriptions")
    .withIndex("by_user", (q: any) => q.eq("userId", convexUserId))
    .first();
  if (!subscription) {
    const authUserId = await getAuthUserId(ctx);
    if (authUserId && authUserId !== convexUserId) {
      subscription = await ctx.db
        .query("subscriptions")
        .withIndex("by_user", (q: any) => q.eq("userId", authUserId))
        .first();
    }
  }

  const rawPlanId = (subscription?.planId || "free").toLowerCase();
  const rawStatus = (subscription?.status || "").toLowerCase();

  // Pro plans: NEVER demote to free. Pro members always get unlimited jobs.
  const isProPlan = rawPlanId === "pro" || rawPlanId === "pro-annual";
  if (isProPlan) {
    return {
      planId: rawPlanId,
      planLabel: "Pro",
      subscriptionStatus: rawStatus || "active",
      limit: null,
      upgradeSuggestion: "Upgrade your plan to increase job limits.",
    };
  }

  const isActive = rawStatus === "active" || rawStatus === "trialing" || rawStatus === "past_due" ||
                   (rawStatus === "" && rawPlanId !== "free");
  const planId = isActive ? rawPlanId : "free";
  const subscriptionStatus = isActive ? rawStatus || "active" : "inactive";
  const limit = PLAN_LIMITS[planId] ?? PLAN_LIMITS.free;

  return {
    planId,
    planLabel: planLabelFromPlanId(planId),
    subscriptionStatus,
    limit,
    upgradeSuggestion: upgradeSuggestionForPlan(planId),
  };
}

async function enforceJobLimitOrThrow(ctx: any, convexUserId: string) {
  const { planId, planLabel, subscriptionStatus, limit, upgradeSuggestion } =
    await resolveJobLimitForUser(ctx, convexUserId);

  if (limit === null) return;

  const jobsCount = (
    await ctx.db.query("jobs").withIndex("by_user", (q: any) => q.eq("userId", convexUserId)).collect()
  ).length;

  if (jobsCount >= limit) {
    const statusNote =
      subscriptionStatus === "inactive"
        ? " Your subscription is not active, so you're currently treated as Free for limits."
        : "";

    throw new Error(
      `Job limit reached. You can track up to ${limit} jobs on your ${planLabel} plan.` +
        statusNote +
        ` ${upgradeSuggestion}`
    );
  }
}

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
    const jobs = await ctx.db
      .query("jobs")
      .withIndex("by_user", (q) => q.eq("userId", convexUserId))
      .collect();
    
    // Sort by updatedAt descending (most recently updated first)
    return jobs.sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

// Mark job as seen
export const markJobAsSeen = mutation({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Get user to access convex_user_id
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");

    const convexUserId = (user as any).convex_user_id || userId;

    const job = await ctx.db.get(args.jobId);
    if (!job || job.userId !== convexUserId) {
      throw new Error("Job not found or access denied");
    }
    
    await ctx.db.patch(args.jobId, {
      seenAt: Date.now(),
    });
  },
});

// Count new jobs
export const countNewJobs = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return 0;

    // Get user to access convex_user_id
    const user = await ctx.db.get(userId);
    if (!user) return 0;

    const convexUserId = (user as any).convex_user_id || userId;

    const jobs = await ctx.db
      .query("jobs")
      .withIndex("by_user", (q) => q.eq("userId", convexUserId))
      .collect();

    // Count jobs where seenAt is null (never seen)
    return jobs.filter(job => !job.seenAt).length;
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
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");

    const convexUserId = (user as any).convex_user_id || userId;
    await enforceJobLimitOrThrow(ctx, convexUserId);

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
    await enforceJobLimitOrThrow(ctx, userId);
    const now = Date.now();
    return await ctx.db.insert("jobs", {
      userId, // Use convex_user_id as the sole identifier
      ...jobData,
      createdAt: now,
      updatedAt: now,
    });
  },
});

///TODO
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
    await enforceJobLimitOrThrow(ctx, userId);
    const now = Date.now();
    return await ctx.db.insert("jobs", {
      userId, // Use convex_user_id as the sole identifier
      ...jobData,
      createdAt: now,
      updatedAt: now,
    });
  },
});

