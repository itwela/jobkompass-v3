"use node";

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { getGmailClient, getMessage, searchMessagesFromSender } from "./gmailClient";
import { classifyEmail } from "../../lib/emailAgent/classify";
import {
  mergeTopMessages,
  resolveLeadFields,
  type SenderHit,
} from "../../lib/emailAgent/manualLead";

/**
 * Search every connected inbox for the user for the most recent messages from a
 * given sender, and return up to 3 (newest first) across all accounts. A revoked
 * account is marked and skipped rather than failing the whole search.
 */
export const searchSenderMessagesInternal = internalAction({
  args: { userId: v.string(), senderEmail: v.string() },
  handler: async (ctx, { userId, senderEmail }): Promise<SenderHit[]> => {
    const accounts = await ctx.runQuery(
      internal.emailAccounts.getActiveAccountsForUser,
      { userId }
    );
    const perAccount: SenderHit[][] = [];
    for (const account of accounts) {
      try {
        const { gmail, refreshedAccessToken, refreshedExpiresAt } =
          await getGmailClient(account);
        if (refreshedAccessToken && refreshedExpiresAt) {
          await ctx.runMutation(internal.emailAccounts.updateTokens, {
            accountId: account._id,
            accessToken: refreshedAccessToken,
            tokenExpiresAt: refreshedExpiresAt,
          });
        }
        const hits = await searchMessagesFromSender(gmail, senderEmail, 3);
        perAccount.push(
          hits.map((h) => ({
            ...h,
            accountId: account._id as string,
            accountEmail: account.email,
          }))
        );
      } catch (err: any) {
        const msg = String(err?.message ?? err);
        if (msg.includes("invalid_grant") || msg.includes("401")) {
          await ctx.runMutation(internal.emailAccounts.markRevoked, {
            accountId: account._id,
          });
        }
      }
    }
    return mergeTopMessages(perAccount, 3);
  },
});

/**
 * Turn a single chosen message into a lead and kick off the normal draft +
 * tailor-resume pipeline. Deduplicates on the Gmail message id. A manual add is
 * always treated as a lead even if the classifier can't recognize it.
 */
export const ingestSelectedMessageInternal = internalAction({
  args: {
    userId: v.string(),
    accountId: v.id("emailAccounts"),
    messageId: v.string(),
  },
  handler: async (
    ctx,
    { userId, accountId, messageId }
  ): Promise<{ leadId: string | null; duplicate: boolean }> => {
    const account = await ctx.runQuery(internal.emailAccounts.getById, {
      accountId,
    });
    if (!account) throw new Error("Account not found");

    const existing = await ctx.runQuery(
      internal.jobLeads.findByOriginalMessageId,
      { userId, originalMessageId: messageId }
    );
    if (existing) return { leadId: existing._id as string, duplicate: true };

    const { gmail, refreshedAccessToken, refreshedExpiresAt } =
      await getGmailClient(account);
    if (refreshedAccessToken && refreshedExpiresAt) {
      await ctx.runMutation(internal.emailAccounts.updateTokens, {
        accountId,
        accessToken: refreshedAccessToken,
        tokenExpiresAt: refreshedExpiresAt,
      });
    }

    const msg = await getMessage(gmail, messageId);
    const senderEmail = (msg.from.match(/<([^>]+)>/)?.[1] ?? msg.from).trim();

    const classification = await classifyEmail({
      subject: msg.subject,
      from: msg.from,
      bodyText: msg.bodyText,
    });
    const { company, role } = resolveLeadFields(classification, senderEmail);

    const leadId = await ctx.runMutation(internal.jobLeads.insertLead, {
      userId,
      sourceAccountId: accountId,
      sourceType: "personal_outreach",
      company,
      role,
      senderEmail,
      rawSnippet: msg.snippet,
      originalMessageId: msg.id,
      rfcMessageId: msg.rfcMessageId,
      threadId: msg.threadId,
      status: "new",
      emailReceivedAt: msg.receivedAt,
    });
    await ctx.scheduler.runAfter(0, internal.emailAgent.draft.draftForLead, {
      leadId,
    });
    return { leadId: leadId as string, duplicate: false };
  },
});
