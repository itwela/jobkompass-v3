// convex/emailAgent/send.ts
"use node";

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { getGmailClient, sendReply } from "./gmailClient";

export const sendApprovedLead = internalAction({
  args: { leadId: v.id("jobLeads") },
  handler: async (ctx, args) => {
    // The entire body — including the initial fetch and the "sending" guard — lives inside
    // this one try block now. Previously those two steps ran before the try, so a failure in
    // either (e.g. a platform-level hiccup on the `getById` query) would leave the lead
    // wedged in "sending" forever: invisible to ApprovalQueue's `pending_approval` view, and
    // ineligible for `approve`'s `status !== "pending_approval"` guard on retry. Now any
    // failure here reverts the lead back to `pending_approval` via `markSendError`, closing
    // that gap. (The residual case — this action never running to completion at all, e.g. a
    // hard crash — is handled separately by `internal.jobLeads.reconcileStuckSends`, a cron
    // that reverts leads stuck in "sending" past a generous timeout.)
    try {
      const lead: any = await ctx.runQuery(internal.jobLeads.getById, { leadId: args.leadId });
      if (!lead) return;

      // Defense-in-depth: `approve` sets status to "sending" synchronously before scheduling
      // this action, so a lead reaching here should always be "sending". If it isn't (already
      // "sent"/"followed_up" from a prior run, or reverted to "pending_approval" after a failed
      // send), bail out instead of sending a possible duplicate.
      if (lead.status !== "sending") {
        console.log(
          `Skipping send for lead ${args.leadId}: status is "${lead.status}", expected "sending" (already sent or duplicate schedule).`
        );
        return;
      }

      const account: any = await ctx.runQuery(internal.emailAccounts.getById, {
        accountId: lead.sourceAccountId,
      });
      const { gmail } = await getGmailClient(account);

      let attachment: { filename: string; content: Buffer; mimeType: string } | undefined;
      // Follow-ups never re-attach the resume — the recipient already got it in the
      // initial outreach, so a second copy is redundant.
      if (lead.draftResumeId && !lead.isFollowUp) {
        const resumeFile: any = await ctx.runQuery(internal.documents.getResumeFileInternal, {
          resumeId: lead.draftResumeId,
        });
        if (resumeFile?.url) {
          const fileRes = await fetch(resumeFile.url);
          const buffer = Buffer.from(await fileRes.arrayBuffer());
          attachment = { filename: resumeFile.fileName || "resume.pdf", content: buffer, mimeType: "application/pdf" };
        }
      }

      const senderEmailMatch = lead.senderEmail?.match(/<(.+)>/);
      const toAddress = senderEmailMatch ? senderEmailMatch[1] : lead.senderEmail;

      await sendReply(gmail, {
        to: toAddress,
        subject: `${lead.company} - ${lead.role}`,
        bodyText: lead.draftMessage,
        threadId: lead.threadId,
        inReplyTo: lead.rfcMessageId || "",
        attachment,
      });

      await ctx.runMutation(internal.jobLeads.markSent, { leadId: args.leadId, isFollowUp: !!lead.isFollowUp });
    } catch (error) {
      console.error(`Failed to send lead ${args.leadId}:`, error);
      await ctx.runMutation(internal.jobLeads.markSendError, { leadId: args.leadId });
    }
  },
});
