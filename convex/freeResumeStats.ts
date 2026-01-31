import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const FREE_RESUME_LIMIT = 2;

/**
 * Get count of free resume generations for an email (for limit enforcement).
 */
export const getCountByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const normalized = args.email.trim().toLowerCase();
    const all = await ctx.db
      .query("freeResumeGenerations")
      .withIndex("by_email", (q) => q.eq("email", normalized))
      .collect();
    return all.length;
  },
});

/**
 * Check if user can generate a free resume (under limit or plus/pro customer).
 * Returns { canGenerate, count, limit, reason, isPlusOrPro }.
 * isPlusOrPro: true if user has active Plus or Pro subscription (unlimited, don't count).
 */
export const checkFreeResumeLimit = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const normalized = args.email.trim().toLowerCase();
    const count = (await ctx.db
      .query("freeResumeGenerations")
      .withIndex("by_email", (q) => q.eq("email", normalized))
      .collect()).length;

    // Find user in users table by email (jobkompass accounts)
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", normalized))
      .first();

    let isPlusOrPro = false;
    if (user) {
      // Subscriptions use userId = convex_user_id (or sometimes user _id)
      const convexUserId = (user as any).convex_user_id;
      const possibleUserIds = [
        convexUserId ? String(convexUserId) : null,
        String(user._id),
      ].filter(Boolean) as string[];

      for (const uid of possibleUserIds) {
        const sub = await ctx.db
          .query("subscriptions")
          .withIndex("by_user", (q) => q.eq("userId", uid))
          .first();
        if (!sub) continue;
        const planId = (sub.planId || "free").toLowerCase();
        const status = (sub.status || "").toLowerCase();
        const isActive = ["active", "trialing", "past_due"].includes(status);
        if (isActive && (planId.includes("plus") || planId.includes("pro"))) {
          isPlusOrPro = true;
          break;
        }
      }

      if (isPlusOrPro) {
        return {
          canGenerate: true,
          count,
          limit: null,
          reason: "plus_or_pro",
          isPlusOrPro: true,
        };
      }
    }

    if (count >= FREE_RESUME_LIMIT) {
      return {
        canGenerate: false,
        count,
        limit: FREE_RESUME_LIMIT,
        reason: "limit_reached",
        isPlusOrPro: false,
      };
    }
    return {
      canGenerate: true,
      count,
      limit: FREE_RESUME_LIMIT,
      reason: "under_limit",
      isPlusOrPro: false,
    };
  },
});

/**
 * Record a successful free resume generation.
 * Called from the API route after PDF is generated.
 */
export const recordGeneration = mutation({
  args: {
    email: v.optional(v.string()),
    inputType: v.union(v.literal("text"), v.literal("pdf")),
    textCharacterCount: v.number(),
    pdfSizeBytes: v.optional(v.number()),
    templateId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("freeResumeGenerations", {
      email: args.email ? args.email.trim().toLowerCase() : undefined,
      createdAt: Date.now(),
      inputType: args.inputType,
      textCharacterCount: args.textCharacterCount,
      pdfSizeBytes: args.pdfSizeBytes,
      templateId: args.templateId,
    });
  },
});

/**
 * Get aggregated stats for the free resume generator.
 * Perfect for dashboards, portfolios, and "look good on resume" numbers.
 */
export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db
      .query("freeResumeGenerations")
      .order("desc")
      .collect();

    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const sevenDaysAgo = now - 7 * oneDayMs;
    const thirtyDaysAgo = now - 30 * oneDayMs;

    const textGenerations = all.filter((g) => g.inputType === "text");
    const pdfGenerations = all.filter((g) => g.inputType === "pdf");

    const totalTextChars = all.reduce((sum, g) => sum + g.textCharacterCount, 0);
    const totalPdfSizeBytes = all.reduce(
      (sum, g) => sum + (g.pdfSizeBytes ?? 0),
      0
    );

    const last7Days = all.filter((g) => g.createdAt >= sevenDaysAgo);
    const last30Days = all.filter((g) => g.createdAt >= thirtyDaysAgo);

    const firstGenerationAt =
      all.length > 0 ? Math.min(...all.map((g) => g.createdAt)) : null;
    const lastGenerationAt =
      all.length > 0 ? Math.max(...all.map((g) => g.createdAt)) : null;

    return {
      totalGenerations: all.length,
      totalTextInputGenerations: textGenerations.length,
      totalPdfProcessed: pdfGenerations.length,
      totalTextCharactersProcessed: totalTextChars,
      totalPdfBytesProcessed: totalPdfSizeBytes,
      generationsLast7Days: last7Days.length,
      generationsLast30Days: last30Days.length,
      firstGenerationAt,
      lastGenerationAt,
    };
  },
});
