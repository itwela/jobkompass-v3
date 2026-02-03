import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

// Get user's usage stats for feature gating
export const getUserUsage = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    // Get user to access convex_user_id
    const user = await ctx.db.get(userId);
    if (!user) {
      return null;
    }

    const convexUserId = (user as any).convex_user_id || userId;

    // Get current month start timestamp
    const now = Date.now();
    const currentMonth = new Date(now);
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);
    const monthStart = currentMonth.getTime();

    // Count AI-generated documents this month (resumes and cover letters with fileId)
    const allResumes = await ctx.db
      .query("resumes")
      .withIndex("by_user", (q) => q.eq("userId", convexUserId))
      .collect();

    const allCoverLetters = await ctx.db
      .query("coverLetters")
      .withIndex("by_user", (q) => q.eq("userId", convexUserId))
      .collect();

    // Count generated documents (have fileId and created this month)
    const generatedResumesThisMonth = allResumes.filter(
      (r) => r.fileId && r.createdAt >= monthStart
    ).length;

    const generatedCoverLettersThisMonth = allCoverLetters.filter(
      (c) => c.fileId && c.createdAt >= monthStart
    ).length;

    const documentsGeneratedThisMonth =
      generatedResumesThisMonth + generatedCoverLettersThisMonth;

    // Count total jobs - use userId (convex_user_id) only
    const allJobs = await ctx.db
      .query("jobs")
      .withIndex("by_user", (q) => q.eq("userId", convexUserId))
      .collect();

    const jobsCount = allJobs.length;

    return {
      documentsGeneratedThisMonth,
      jobsCount,
      monthStart,
    };
  },
});

// Check if user can generate a document (server-side)
export const canGenerateDocument = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return { allowed: false, reason: "Not authenticated" };
    }

    // Get user and subscription
    const user = await ctx.db.get(userId);
    if (!user) {
      return { allowed: false, reason: "User not found" };
    }

    const convexUserId = (user as any).convex_user_id || userId;

    // Get subscription - try both convexUserId and userId
    let subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", convexUserId))
      .first();
    if (!subscription && convexUserId !== userId) {
      subscription = await ctx.db
        .query("subscriptions")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .first();
    }

    const planKey = (subscription?.planId || "free").toLowerCase();

    // Define limits
    const PLAN_LIMITS: Record<string, number> = {
      free: 3,
      starter: 10,
      plus: 60,
      "plus-annual": 60,
      pro: 180,
      "pro-annual": 180,
    };

    const limit = PLAN_LIMITS[planKey] || PLAN_LIMITS.free;

    // Calculate usage inline (can't call other queries from within a query)
    // Get current month start timestamp
    const now = Date.now();
    const currentMonth = new Date(now);
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);
    const monthStart = currentMonth.getTime();

    // Count AI-generated documents this month
    const allResumes = await ctx.db
      .query("resumes")
      .withIndex("by_user", (q) => q.eq("userId", convexUserId))
      .collect();

    const allCoverLetters = await ctx.db
      .query("coverLetters")
      .withIndex("by_user", (q) => q.eq("userId", convexUserId))
      .collect();

    const generatedResumesThisMonth = allResumes.filter(
      (r) => r.fileId && r.createdAt >= monthStart
    ).length;

    const generatedCoverLettersThisMonth = allCoverLetters.filter(
      (c) => c.fileId && c.createdAt >= monthStart
    ).length;

    const used = generatedResumesThisMonth + generatedCoverLettersThisMonth;

    if (used >= limit) {
      return {
        allowed: false,
        reason: "Document limit reached",
        used,
        limit,
        planId: planKey,
      };
    }

    return { allowed: true, used, limit };
  },
});

// Check if user can add a job (server-side)
export const canAddJob = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return { allowed: false, reason: "Not authenticated" };
    }

    const user = await ctx.db.get(userId);
    if (!user) {
      return { allowed: false, reason: "User not found" };
    }

    const convexUserId = (user as any).convex_user_id || userId;

    // Get subscription - try both convexUserId and userId
    let subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", convexUserId))
      .first();
    if (!subscription && convexUserId !== userId) {
      subscription = await ctx.db
        .query("subscriptions")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .first();
    }

    const rawPlanId = (subscription?.planId || "free").toLowerCase();
    const rawStatus = (subscription?.status || "").toLowerCase();

    // Pro plans: NEVER demote to free. Pro members always get unlimited jobs.
    const isProPlan = rawPlanId === "pro" || rawPlanId === "pro-annual";
    if (isProPlan) {
      return {
        allowed: true,
        used: null,
        limit: null,
        planId: rawPlanId,
        planLabel: "Pro",
        subscriptionStatus: rawStatus || "active",
      };
    }

    // Consider subscription active if status is active, trialing, or past_due
    const isActive = rawStatus === "active" || rawStatus === "trialing" || rawStatus === "past_due" ||
                     (rawStatus === "" && rawPlanId !== "free");

    const planId = isActive ? rawPlanId : "free";
    const status = isActive ? rawStatus || "active" : "inactive";

    const PLAN_LIMITS: Record<string, number | null> = {
      free: 10,
      starter: 100,
      plus: 100,
      "plus-annual": 100,
      pro: null,
      "pro-annual": null,
    };

    const limit = PLAN_LIMITS[planId] ?? PLAN_LIMITS.free;

    const planLabel =
      planId === "free" ? "Free"
        : planId === "starter" ? "Starter"
        : planId === "plus" || planId === "plus-annual" ? "Plus"
        : planId === "pro" || planId === "pro-annual" ? "Pro"
        : planId;

    const upgradeSuggestion =
      planId === "free"
        ? "Upgrade to Plus (100 jobs) or Pro (unlimited jobs)."
        : planId === "starter" || planId === "plus" || planId === "plus-annual"
          ? "Upgrade to Pro for unlimited job tracking."
          : "Upgrade your plan to increase job limits.";

    if (limit === null) {
      return { allowed: true, used: null, limit: null, planId, planLabel, subscriptionStatus: status };
    }

    const allJobs = await ctx.db
      .query("jobs")
      .withIndex("by_user", (q) => q.eq("userId", convexUserId))
      .collect();
    const used = allJobs.length;

    if (used >= limit) {
      return {
        allowed: false,
        reason: "Job limit reached",
        used,
        limit,
        planId,
        planLabel,
        subscriptionStatus: status,
        upgradeSuggestion,
      };
    }

    return { allowed: true, used, limit, planId, planLabel, subscriptionStatus: status };
  },
});
