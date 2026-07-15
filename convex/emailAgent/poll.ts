"use node";

import { internalAction, action, type ActionCtx } from "../_generated/server";
import { api, internal } from "../_generated/api";
import { getGmailClient, listNewMessageIds, getMessage } from "./gmailClient";
import { classifyEmail } from "../../lib/emailAgent/classify";

// One-shot backfill for leads ingested before emailReceivedAt was captured: re-fetch
// each dateless lead's Gmail message for its internalDate, patch the lead, and re-mirror
// it to the Life Dashboard. Safe to re-run; skips anything already dated.
export const backfillEmailDates = internalAction({
  args: {},
  handler: async (ctx) => {
    const leads: any[] = await ctx.runQuery(internal.jobLeads.listAllInternal, {});
    const missing = leads.filter((lead) => !lead.emailReceivedAt);

    const gmailByAccount = new Map<string, any>();
    let patched = 0;
    for (const lead of missing) {
      try {
        let gmail = gmailByAccount.get(lead.sourceAccountId);
        if (!gmail) {
          const account = await ctx.runQuery(internal.emailAccounts.getById, {
            accountId: lead.sourceAccountId,
          });
          if (!account) continue;
          gmail = (await getGmailClient(account)).gmail;
          gmailByAccount.set(lead.sourceAccountId, gmail);
        }
        const message = await getMessage(gmail, lead.originalMessageId);
        if (message.receivedAt) {
          await ctx.runMutation(internal.jobLeads.setEmailReceivedAt, {
            leadId: lead._id,
            emailReceivedAt: message.receivedAt,
          });
          await ctx.runAction(internal.emailAgent.mirror.pushLead, { leadId: lead._id });
          patched++;
        }
      } catch (error) {
        console.error(`Backfill failed for lead ${lead._id}:`, error);
      }
    }
    return { missing: missing.length, patched };
  },
});

// Poll a single Gmail account: fetch new messages since its stored historyId,
// classify each, and insert any job leads. Returns how many new leads it inserted.
// Throws on failure so the caller decides how to react (mark revoked, surface, log).
async function pollAccount(ctx: ActionCtx, account: any): Promise<number> {
  let newLeads = 0;

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

    // Gmail's history feed includes messages this account SENT (our own approved
    // replies land in it a moment after sending). Skip anything authored by the
    // account itself — otherwise our own reply matches the thread check below and
    // falsely marks the lead "replied" before the recruiter ever answers.
    if (message.from.toLowerCase().includes(account.email.toLowerCase())) {
      continue;
    }

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
      newLeads++;
      await ctx.scheduler.runAfter(0, internal.emailAgent.draft.draftForLead, { leadId });
    }

    if (classification.type === "digest") {
      for (const listing of classification.listings) {
        // Job boards resend the same listing across daily digests — skip exact
        // company+role repeats instead of stacking duplicates.
        const dup = await ctx.runQuery(internal.jobLeads.findDigestDuplicate, {
          userId: account.userId,
          company: listing.company,
          role: listing.role,
        });
        if (dup) continue;
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
        newLeads++;
      }
    }
  }

  await ctx.runMutation(internal.emailAccounts.updateHistoryId, {
    accountId: account._id,
    historyId: newHistoryId,
  });

  return newLeads;
}

export const pollAllAccounts = internalAction({
  args: {},
  handler: async (ctx) => {
    const accounts = await ctx.runQuery(internal.emailAccounts.getActiveAccounts, {});

    for (const account of accounts) {
      try {
        await pollAccount(ctx, account);
      } catch (error: any) {
        if (error?.code === 401 || error?.message?.includes("invalid_grant")) {
          await ctx.runMutation(internal.emailAccounts.markRevoked, { accountId: account._id });
        }
        console.error(`Poll failed for account ${account.email}:`, error);
      }
    }
  },
});

// Manual "Scan now" trigger for the current user. Runs the exact same poll the cron
// runs, but ONLY over this user's own active accounts — never the whole app. Returns
// a summary so the UI can tell the user what happened (and surface per-account errors
// instead of silently swallowing them the way the background cron does).
export const pollMyAccounts = action({
  args: {},
  handler: async (
    ctx
  ): Promise<{ scanned: number; newLeads: number; errors: string[] }> => {
    const convexUserId = await ctx.runQuery(api.auth.getConvexUserId, {});
    if (!convexUserId) throw new Error("Not authenticated");

    const accounts = await ctx.runQuery(internal.emailAccounts.getActiveAccountsForUser, {
      userId: convexUserId,
    });

    let newLeads = 0;
    const errors: string[] = [];

    for (const account of accounts) {
      try {
        newLeads += await pollAccount(ctx, account);
      } catch (error: any) {
        if (error?.code === 401 || error?.message?.includes("invalid_grant")) {
          await ctx.runMutation(internal.emailAccounts.markRevoked, { accountId: account._id });
          errors.push(`${account.email}: access expired — reconnect this inbox.`);
        } else {
          errors.push(`${account.email}: ${error?.message ?? "scan failed"}`);
        }
        console.error(`Manual poll failed for account ${account.email}:`, error);
      }
    }

    return { scanned: accounts.length, newLeads, errors };
  },
});
