// convex/emailAgent/send.ts
"use node";

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { getGmailClient, sendReply } from "./gmailClient";

export const sendApprovedLead = internalAction({
  args: { leadId: v.id("jobLeads") },
  handler: async (ctx, args) => {
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

    try {
      const account: any = await ctx.runQuery(internal.emailAccounts.getById, {
        accountId: lead.sourceAccountId,
      });
      const { gmail } = await getGmailClient(account);

      let attachment: { filename: string; content: Buffer; mimeType: string } | undefined;
      if (lead.draftResumeId) {
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
