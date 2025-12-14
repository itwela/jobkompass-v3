import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Add email to waitlist
export const add = mutation({
  args: {
    email: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if email already exists
    const existing = await ctx.db
      .query("waitlist")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (existing) {
      return { success: false, message: "Email already on waitlist" };
    }

    // Add to waitlist
    const waitlistId = await ctx.db.insert("waitlist", {
      email: args.email,
      name: args.name,
      createdAt: Date.now(),
    });

    return { success: true, id: waitlistId };
  },
});

// Get all waitlist entries (admin query - can be protected later)
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("waitlist").order("desc").collect();
  },
});
