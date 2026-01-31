import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { sanitizeEmail, sanitizeInput } from "./inputSanitizer";

export const submissionTypes = {
  FREE_RESUME: "free-resume",
  WAITLIST: "waitlist",
} as const;

// Add email to email list with a submission type
export const add = mutation({
  args: {
    email: v.string(),
    name: v.string(),
    submissionType: v.string(),
  },
  handler: async (ctx, args) => {
    const sanitizedEmail = sanitizeEmail(args.email);
    const sanitizedName = sanitizeInput(args.name);

    if (!sanitizedEmail || sanitizedEmail === "") {
      return { success: false, message: "Invalid email address" };
    }

    if (!sanitizedName || sanitizedName === "") {
      return { success: false, message: "Name is required" };
    }

    // Check if email already exists for this submission type
    const existing = await ctx.db
      .query("emailList")
      .withIndex("by_email_and_type", (q) =>
        q.eq("email", sanitizedEmail).eq("submissionType", args.submissionType)
      )
      .first();

    if (existing) {
      // Already on list - return success (idempotent)
      return { success: true, id: existing._id, alreadyExisted: true };
    }

    const id = await ctx.db.insert("emailList", {
      email: sanitizedEmail,
      name: sanitizedName,
      submissionType: args.submissionType,
      createdAt: Date.now(),
    });

    return { success: true, id, alreadyExisted: false };
  },
});

// Check if email exists for a given submission type (for "I already signed up" flow)
export const checkEmail = query({
  args: {
    email: v.string(),
    submissionType: v.string(),
  },
  handler: async (ctx, args) => {
    const sanitizedEmail = sanitizeEmail(args.email);
    if (!sanitizedEmail) return { found: false };

    const existing = await ctx.db
      .query("emailList")
      .withIndex("by_email_and_type", (q) =>
        q.eq("email", sanitizedEmail).eq("submissionType", args.submissionType)
      )
      .first();

    return { found: !!existing };
  },
});

// List all email list entries (admin - can be protected later)
export const list = query({
  args: {
    submissionType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.submissionType) {
      return await ctx.db
        .query("emailList")
        .withIndex("by_submission_type", (q) =>
          q.eq("submissionType", args.submissionType!)
        )
        .order("desc")
        .collect();
    }
    return await ctx.db.query("emailList").order("desc").collect();
  },
});
