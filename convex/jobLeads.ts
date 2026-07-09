import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

async function resolveConvexUserId(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");
  const user = await ctx.db.get(userId);
  return (user as any)?.convex_user_id || userId;
}

export const insertLead = internalMutation({
  args: {
    userId: v.string(),
    sourceAccountId: v.id("emailAccounts"),
    sourceType: v.union(v.literal("personal_outreach"), v.literal("digest_listing")),
    company: v.string(),
    role: v.string(),
    senderEmail: v.optional(v.string()),
    rawSnippet: v.string(),
    originalMessageId: v.string(),
    rfcMessageId: v.optional(v.string()),
    threadId: v.string(),
    status: v.union(v.literal("new"), v.literal("extracted")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("jobLeads", { ...args, createdAt: now, updatedAt: now });
  },
});

export const findByOriginalMessageId = internalQuery({
  args: { userId: v.string(), originalMessageId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("jobLeads")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("originalMessageId"), args.originalMessageId))
      .first();
  },
});

export const list = query({
  args: { status: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const convexUserId = await resolveConvexUserId(ctx);
    let q = ctx.db.query("jobLeads").withIndex("by_user_and_status", (idx) =>
      args.status ? idx.eq("userId", convexUserId).eq("status", args.status as any) : idx.eq("userId", convexUserId)
    );
    return await q.order("desc").collect();
  },
});

export const markClassificationError = internalMutation({
  args: { leadId: v.id("jobLeads") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.leadId, { classificationError: true, updatedAt: Date.now() });
  },
});

export const findSentLeadByThreadId = internalQuery({
  args: { userId: v.string(), threadId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("jobLeads")
      .withIndex("by_user_and_status", (q) => q.eq("userId", args.userId).eq("status", "sent"))
      .filter((q) => q.eq(q.field("threadId"), args.threadId))
      .first();
  },
});

export const markReplied = internalMutation({
  args: { leadId: v.id("jobLeads") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.leadId, { status: "replied" as const, updatedAt: Date.now() });
  },
});

export const attachDraft = internalMutation({
  args: {
    leadId: v.id("jobLeads"),
    draftResumeId: v.optional(v.id("resumes")),
    draftMessage: v.string(),
    isFollowUp: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.leadId, {
      draftResumeId: args.draftResumeId,
      draftMessage: args.draftMessage,
      isFollowUp: args.isFollowUp,
      status: "pending_approval" as const,
      updatedAt: Date.now(),
    });
  },
});

export const getById = internalQuery({
  args: { leadId: v.id("jobLeads") },
  handler: async (ctx, args) => await ctx.db.get(args.leadId),
});
