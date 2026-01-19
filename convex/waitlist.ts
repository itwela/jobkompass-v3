import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { sanitizeEmail, sanitizeInput } from "./inputSanitizer";

// Add email to waitlist
export const add = mutation({
  args: {
    email: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Sanitize inputs on server side
    const sanitizedEmail = sanitizeEmail(args.email);
    const sanitizedName = args.name ? sanitizeInput(args.name) : undefined;

    // Validate email after sanitization
    if (!sanitizedEmail || sanitizedEmail === '') {
      return { success: false, message: "Invalid email address" };
    }

    // Check if email already exists
    const existing = await ctx.db
      .query("waitlist")
      .withIndex("by_email", (q) => q.eq("email", sanitizedEmail))
      .first();

    if (existing) {
      return { success: false, message: "Email already on waitlist" };
    }

    // Add to waitlist with sanitized values
    const waitlistId = await ctx.db.insert("waitlist", {
      email: sanitizedEmail,
      name: sanitizedName,
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
