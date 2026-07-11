"use node";

import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { getGmailClient, listNewMessageIds, getMessage } from "./gmailClient";
import { classifyEmail } from "../../lib/emailAgent/classify";

export const pollAllAccounts = internalAction({
  args: {},
  handler: async (ctx) => {
    const accounts = await ctx.runQuery(internal.emailAccounts.getActiveAccounts, {});

    for (const account of accounts) {
      try {
        const { gmail, refreshedAccessToken, refreshedExpiresAt } = await getGmailClient(account);
        if (refreshedAccessToken && refreshedExpiresAt) {
          await ctx.runMutation(internal.emailAccounts.updateTokens, {
            accountId: account._id,
            accessToken: refreshedAccessToken,
            tokenExpiresAt: refreshedExpiresAt,
          });
        }

        const { messageIds, newHistoryId } = await listNewMessageIds(gmail, account.historyId);

        for (const messageId of messageIds) {
          const existing = await ctx.runQuery(internal.jobLeads.findByOriginalMessageId, {
            userId: account.userId,
            originalMessageId: messageId,
          });
          if (existing) continue; // dedupe re-delivered mail

          const message = await getMessage(gmail, messageId);

          // If this message landed in a thread we already sent a reply on, it's the
          // sender responding — mark that lead replied (so it's excluded from
          // follow-up eligibility) instead of treating it as a brand-new lead.
          const repliedToLead = await ctx.runQuery(internal.jobLeads.findSentLeadByThreadId, {
            userId: account.userId,
            threadId: message.threadId,
          });
          if (repliedToLead) {
            await ctx.runMutation(internal.jobLeads.markReplied, { leadId: repliedToLead._id });
            continue;
          }

          const classification = await classifyEmail({
            subject: message.subject,
            from: message.from,
            bodyText: message.bodyText,
          });

          if (!classification) {
            // Don't surface classification failures as "Unknown/Unknown" leads — that
            // floods the UI with junk. Log and skip; classify.ts already retried
            // transient errors, and a re-seed (resetClassificationErrorLeads) can
            // re-ingest anything genuinely missed.
            console.error(
              `Classification failed for message ${message.id} (from: ${message.from}, subject: ${message.subject}); skipping.`
            );
            continue;
          }

          if (classification.type === "neither") continue;

          if (classification.type === "personal_outreach") {
            const leadId = await ctx.runMutation(internal.jobLeads.insertLead, {
              userId: account.userId,
              sourceAccountId: account._id,
              sourceType: "personal_outreach",
              company: classification.company,
              role: classification.role,
              senderEmail: message.from,
              rawSnippet: message.snippet,
              originalMessageId: message.id,
              rfcMessageId: message.rfcMessageId,
              threadId: message.threadId,
              status: "new",
              emailReceivedAt: message.receivedAt,
            });
            await ctx.scheduler.runAfter(0, internal.emailAgent.draft.draftForLead, { leadId });
          }

          if (classification.type === "digest") {
            for (const listing of classification.listings) {
              await ctx.runMutation(internal.jobLeads.insertLead, {
                userId: account.userId,
                sourceAccountId: account._id,
                sourceType: "digest_listing",
                company: listing.company,
                role: listing.role,
                rawSnippet: listing.link,
                originalMessageId: message.id,
                rfcMessageId: message.rfcMessageId,
                threadId: message.threadId,
                status: "extracted",
                emailReceivedAt: message.receivedAt,
              });
            }
          }
        }

        await ctx.runMutation(internal.emailAccounts.updateHistoryId, {
          accountId: account._id,
          historyId: newHistoryId,
        });
      } catch (error: any) {
        if (error?.code === 401 || error?.message?.includes("invalid_grant")) {
          await ctx.runMutation(internal.emailAccounts.markRevoked, { accountId: account._id });
        }
        console.error(`Poll failed for account ${account.email}:`, error);
      }
    }
  },
});
