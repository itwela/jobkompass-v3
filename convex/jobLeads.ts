import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

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
    const leadId = await ctx.db.insert("jobLeads", { ...args, createdAt: now, updatedAt: now });
    await ctx.scheduler.runAfter(0, internal.emailAgent.mirror.pushLead, { leadId });
    return leadId;
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

export const getSentLeads = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("jobLeads")
      .withIndex("by_status", (q) => q.eq("status", "sent"))
      .collect();
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
    await ctx.scheduler.runAfter(0, internal.emailAgent.mirror.pushLead, { leadId: args.leadId });
  },
});

export const getById = internalQuery({
  args: { leadId: v.id("jobLeads") },
  handler: async (ctx, args) => await ctx.db.get(args.leadId),
});

export const approve = mutation({
  args: { leadId: v.id("jobLeads") },
  handler: async (ctx, args) => {
    const convexUserId = await resolveConvexUserId(ctx);
    const lead = await ctx.db.get(args.leadId);
    if (!lead || lead.userId !== convexUserId) throw new Error("Lead not found");
    if (lead.status !== "pending_approval") throw new Error("Lead is not pending approval");

    // Flip to "sending" synchronously, in the same mutation, before scheduling the send
    // action. This closes the double-approve window: a second concurrent `approve` call
    // will now fail the status check above instead of scheduling a duplicate send.
    await ctx.db.patch(args.leadId, {
      status: "sending" as const,
      approvedAt: Date.now(),
      updatedAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internal.emailAgent.send.sendApprovedLead, { leadId: args.leadId });
  },
});

export const reject = mutation({
  args: { leadId: v.id("jobLeads") },
  handler: async (ctx, args) => {
    const convexUserId = await resolveConvexUserId(ctx);
    const lead = await ctx.db.get(args.leadId);
    if (!lead || lead.userId !== convexUserId) throw new Error("Lead not found");
    await ctx.db.patch(args.leadId, { status: "closed" as const, updatedAt: Date.now() });
    await ctx.scheduler.runAfter(0, internal.emailAgent.mirror.pushLead, { leadId: args.leadId });
  },
});

export const editDraft = mutation({
  args: { leadId: v.id("jobLeads"), draftMessage: v.string() },
  handler: async (ctx, args) => {
    const convexUserId = await resolveConvexUserId(ctx);
    const lead = await ctx.db.get(args.leadId);
    if (!lead || lead.userId !== convexUserId) throw new Error("Lead not found");
    await ctx.db.patch(args.leadId, { draftMessage: args.draftMessage, updatedAt: Date.now() });
  },
});

export const markSent = internalMutation({
  args: { leadId: v.id("jobLeads"), isFollowUp: v.boolean() },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.patch(args.leadId, {
      status: args.isFollowUp ? ("followed_up" as const) : ("sent" as const),
      sentAt: now,
      followUpSentAt: args.isFollowUp ? now : undefined,
      updatedAt: now,
    });
    await ctx.scheduler.runAfter(0, internal.emailAgent.mirror.pushLead, { leadId: args.leadId });
  },
});

export const markSendError = internalMutation({
  args: { leadId: v.id("jobLeads") },
  handler: async (ctx, args) => {
    // Revert "sending" back to "pending_approval" so the lead reappears in the approval
    // queue and can be retried. approvedAt is left set so a distinct "approved but failed
    // to send" state is visible if a UI wants to show a retry affordance later.
    await ctx.db.patch(args.leadId, { status: "pending_approval" as const, updatedAt: Date.now() });
  },
});

export const promoteToJob = mutation({
  args: { leadId: v.id("jobLeads") },
  handler: async (ctx, args): Promise<Id<"jobs">> => {
    const convexUserId = await resolveConvexUserId(ctx);
    const lead = await ctx.db.get(args.leadId);
    if (!lead || lead.userId !== convexUserId) throw new Error("Lead not found");
    if (lead.status === "promoted") throw new Error("Lead already promoted");

    const jobId: Id<"jobs"> = await ctx.runMutation(internal.jobs.addInternal, {
      userId: convexUserId,
      company: lead.company,
      title: lead.role,
      link: lead.rawSnippet.startsWith("http") ? lead.rawSnippet : "",
      status: "Interested",
      resumeUsed: lead.draftResumeId ? String(lead.draftResumeId) : undefined,
    });

    await ctx.db.patch(args.leadId, { status: "promoted" as const, promotedAt: Date.now(), updatedAt: Date.now() });
    await ctx.scheduler.runAfter(0, internal.emailAgent.mirror.pushLead, { leadId: args.leadId });
    return jobId;
  },
});
