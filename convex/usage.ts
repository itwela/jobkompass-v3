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

    // Get subscription
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", convexUserId))
      .first();

    const planId = subscription?.planId || "free";

    // Define limits
    const PLAN_LIMITS: Record<string, number> = {
      free: 3,
      starter: 10,
      plus: 60,
      "plus-annual": 60,
      pro: 180,
      "pro-annual": 180,
    };

    const limit = PLAN_LIMITS[planId] || PLAN_LIMITS.free;

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
        planId,
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

    // Get user and subscription
    const user = await ctx.db.get(userId);
    if (!user) {
      return { allowed: false, reason: "User not found" };
    }

    const convexUserId = (user as any).convex_user_id || userId;

    // Get subscription
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", convexUserId))
      .first();

    const rawPlanId = subscription?.planId || "free";
    const rawStatus = subscription?.status || null;

    // Consider subscription active if status is active, trialing, or past_due (grace period)
    // Also treat missing status with a paid plan as active (for backwards compatibility)
    const isActive = rawStatus === "active" || rawStatus === "trialing" || rawStatus === "past_due" ||
                     (rawStatus === null && rawPlanId !== "free");

    // If subscription isn't active, treat as free (even if planId says pro/plus/etc).
    const planId = isActive ? rawPlanId : "free";
    const status = isActive ? rawStatus : "inactive";

    const PLAN_LIMITS: Record<string, number | null> = {
      free: 10,
      starter: 100,
      plus: 100,
      "plus-annual": 100,
      pro: null, // Unlimited
      "pro-annual": null, // Unlimited
    };

    const limit = PLAN_LIMITS[planId] ?? PLAN_LIMITS.free;

    const planLabel =
      planId === "free"
        ? "Free"
        : planId === "starter"
          ? "Starter"
          : planId === "plus" || planId === "plus-annual"
            ? "Plus"
            : planId === "pro" || planId === "pro-annual"
              ? "Pro"
              : planId;

    const upgradeSuggestion =
      planId === "free"
        ? "Upgrade to Plus (100 jobs) or Pro (unlimited jobs)."
        : planId === "starter" || planId === "plus" || planId === "plus-annual"
          ? "Upgrade to Pro for unlimited job tracking."
          : "Upgrade your plan to increase job limits.";

    // Unlimited plans
    if (limit === null) {
      return {
        allowed: true,
        used: null,
        limit: null,
        planId,
        planLabel,
        subscriptionStatus: status,
      };
    }

    // Calculate jobs count inline (can't call other queries from within a query)
    // Get jobs by userId (convex_user_id) only
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

    return {
      allowed: true,
      used,
      limit,
      planId,
      planLabel,
      subscriptionStatus: status,
    };
  },
});
