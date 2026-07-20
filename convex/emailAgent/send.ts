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
    // Hoisted out of the try so the catch can still read the lead's sourceAccountId when
    // deciding whether to mark the Gmail account revoked.
    let lead: any;
    try {
      lead = await ctx.runQuery(internal.jobLeads.getById, { leadId: args.leadId });
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
    } catch (error: any) {
      console.error(`Failed to send lead ${args.leadId}:`, error);

      // Distinguish "your Gmail access expired" from a generic send failure so the approval
      // queue can tell the user exactly what to do. A revoked/expired OAuth token surfaces
      // as invalid_grant (from the refresh) or a 401 from the send call — same signals the
      // poll path uses. When we see one, mark the account revoked (mirrors pollAllAccounts)
      // so Settings shows it as disconnected and the whole app stops silently retrying it.
      const isAuthError =
        error?.code === 401 ||
        error?.response?.status === 401 ||
        error?.message?.includes("invalid_grant") ||
        error?.response?.data?.error === "invalid_grant";

      let reason: string;
      if (isAuthError) {
        try {
          if (lead?.sourceAccountId) {
            await ctx.runMutation(internal.emailAccounts.markRevoked, {
              accountId: lead.sourceAccountId,
            });
          }
        } catch (markErr) {
          console.error(`Failed to mark account revoked for lead ${args.leadId}:`, markErr);
        }
        reason =
          "Gmail access has expired, so this couldn't be sent. Reconnect your inbox in Settings → Gmail accounts, then approve again.";
      } else {
        reason = `Couldn't send: ${error?.message ?? "unknown error"}. Please try again.`;
      }

      await ctx.runMutation(internal.jobLeads.markSendError, { leadId: args.leadId, error: reason });
    }
  },
});
