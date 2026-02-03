import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { sanitizeEmail, sanitizeInput } from "./inputSanitizer";

export const add = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    subject: v.string(),
    message: v.string(),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const sanitizedEmail = sanitizeEmail(args.email);
    const sanitizedName = sanitizeInput(args.name);
    const sanitizedSubject = sanitizeInput(args.subject);
    const sanitizedMessage = sanitizeInput(args.message);

    // Validate required fields
    if (!sanitizedEmail || sanitizedEmail === "") {
      return { success: false, message: "Invalid email address" };
    }

    if (!sanitizedName || sanitizedName === "") {
      return { success: false, message: "Name is required" };
    }

    if (!sanitizedSubject || sanitizedSubject === "") {
      return { success: false, message: "Subject is required" };
    }

    if (!sanitizedMessage || sanitizedMessage === "") {
      return { success: false, message: "Message is required" };
    }

    // Check if similar contact was submitted recently (spam prevention)
    // Look for contacts with same email within last hour
    const recentContacts = await ctx.db
      .query("contacts")
      .withIndex("by_email", (q) => q.eq("email", sanitizedEmail))
      .collect();

    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const recentCount = recentContacts.filter(
      (contact) => contact.createdAt > oneHourAgo
    ).length;

    // Limit to 3 submissions per hour per email
    if (recentCount >= 3) {
      return {
        success: false,
        message: "Too many submissions. Please try again later.",
      };
    }

    // Insert contact
    const id = await ctx.db.insert("contacts", {
      name: sanitizedName,
      email: sanitizedEmail,
      subject: sanitizedSubject,
      message: sanitizedMessage,
      ipAddress: args.ipAddress,
      userAgent: args.userAgent,
      createdAt: Date.now(),
    });

    return { success: true, id };
  },
});

// Admin query to list contacts (optional - for admin dashboard)
export const list = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 100;
    const contacts = await ctx.db
      .query("contacts")
      .order("desc")
      .take(limit);
    
    return contacts;
  },
});

// Count total contacts (for admin)
export const count = query({
  args: {},
  handler: async (ctx) => {
    const contacts = await ctx.db.query("contacts").collect();
    return contacts.length;
  },
});