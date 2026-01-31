import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Record a successful free resume generation.
 * Called from the API route after PDF is generated.
 */
export const recordGeneration = mutation({
  args: {
    inputType: v.union(v.literal("text"), v.literal("pdf")),
    textCharacterCount: v.number(),
    pdfSizeBytes: v.optional(v.number()),
    templateId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("freeResumeGenerations", {
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
