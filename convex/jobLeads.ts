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
    emailReceivedAt: v.optional(v.number()),
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

// Recovery helper (run via `npx convex run jobLeads:resetUntriagedLeads` after fixing
// whatever broke ingestion): deletes every lead still sitting untriaged — anything the
// user has drafted, approved, or otherwise moved along stays — then clears each active
// account's Gmail historyId cursor so the next poll re-ingests recent mail from scratch.
// Poll dedupes by originalMessageId, so surviving leads are never duplicated.
export const resetUntriagedLeads = internalMutation({
  args: {},
  handler: async (ctx) => {
    const leads = await ctx.db.query("jobLeads").collect();

    const accountIds = new Set<Id<"emailAccounts">>();
    let deleted = 0;
    for (const lead of leads) {
      if (lead.status !== "new" && lead.status !== "extracted") continue;
      if (lead.draftMessage) continue;
      accountIds.add(lead.sourceAccountId);
      await ctx.db.delete(lead._id);
      deleted++;
    }

    for (const accountId of accountIds) {
      await ctx.db.patch(accountId, { historyId: undefined });
    }

    return { deleted, accountsReseeded: accountIds.size };
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

// A send should never legitimately take this long — `sendApprovedLead` involves at most an
// OpenRouter call, a LaTeX compile, and a Gmail API call, all of which complete in seconds.
// This is generous headroom above that so a normal, merely-slow send is never falsely
// reconciled while it's still genuinely in progress.
const STUCK_SENDING_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

// Reconciles `jobLeads` rows wedged in `"sending"` with no in-progress action left to finish
// them — e.g. the scheduled `sendApprovedLead` action crashed or was killed before its own
// try/catch could run `markSendError`. Without this, such a lead is invisible to
// `ApprovalQueue`'s `pending_approval`-scoped query and can never pass `approve`'s
// `status !== "pending_approval"` guard again, so it's stuck forever. Run periodically via
// `crons.ts` rather than relied upon as the primary safety net — `sendApprovedLead`'s own
// try/catch (which now wraps its entire body, including the initial fetch and guard) already
// handles any catchable failure; this only catches the residual "action never ran to
// completion at all" case.
export const reconcileStuckSends = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - STUCK_SENDING_TIMEOUT_MS;
    const stuckLeads = await ctx.db
      .query("jobLeads")
      .withIndex("by_status", (q) => q.eq("status", "sending"))
      .filter((q) => q.lt(q.field("approvedAt"), cutoff))
      .collect();

    for (const lead of stuckLeads) {
      console.warn(
        `reconcileStuckSends: lead ${lead._id} stuck in "sending" since approvedAt=${lead.approvedAt}, reverting to "pending_approval".`
      );
      await ctx.db.patch(lead._id, { status: "pending_approval" as const, updatedAt: Date.now() });
    }

    return { reconciled: stuckLeads.length };
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
