import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";

/** The caller's stored "What JobKompass sees" observations, or null when none were written yet. */
export const getMine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const row = await ctx.db.query("performanceInsights").withIndex("by_user", (q) => q.eq("userId", userId)).first();
    return row ? { factsKey: row.factsKey, items: row.items, updatedAt: row.updatedAt } : null;
  },
});

/** Stores the observations with the fingerprint of the numbers they came from. One row per user. */
export const saveMine = mutation({
  args: {
    factsKey: v.string(),
    items: v.array(v.object({ headline: v.string(), evidence: v.string(), count: v.optional(v.number()), total: v.optional(v.number()) })),
  },
  handler: async (ctx, { factsKey, items }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    const row = await ctx.db.query("performanceInsights").withIndex("by_user", (q) => q.eq("userId", userId)).first();
    const doc = { factsKey, items: items.slice(0, 3), updatedAt: Date.now() };
    if (row) await ctx.db.patch(row._id, doc);
    else await ctx.db.insert("performanceInsights", { userId, ...doc });
    return null;
  },
});
