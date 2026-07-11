// convex/emailAgent/mirror.ts
import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";

export const pushLead = internalAction({
  args: { leadId: v.id("jobLeads") },
  handler: async (ctx, args) => {
    const lead: any = await ctx.runQuery(internal.jobLeads.getById, { leadId: args.leadId });
    if (!lead) return;

    const syncUrl = process.env.LIFE_DASHBOARD_SYNC_URL;
    const syncKey = process.env.LIFE_DASHBOARD_SYNC_KEY;
    if (!syncUrl || !syncKey) {
      console.error("Life Dashboard sync not configured (missing LIFE_DASHBOARD_SYNC_URL/KEY)");
      return;
    }

    try {
      await fetch(syncUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Sync-Key": syncKey },
        body: JSON.stringify({
          sourceLeadId: String(lead._id),
          company: lead.company,
          role: lead.role,
          sourceType: lead.sourceType,
          status: lead.status,
          isFollowUp: lead.isFollowUp,
          emailReceivedAt: lead.emailReceivedAt,
        }),
      });
    } catch (error) {
      console.error(`Failed to mirror lead ${args.leadId} to Life Dashboard:`, error);
    }
  },
});

// Re-mirror every current lead. Run after the dashboard's mirror table has been purged
// (its rows are keyed by sourceLeadId, so leads deleted here leave orphans there):
// `npx convex run emailAgent/mirror:pushAllLeads`
export const pushAllLeads = internalAction({
  args: {},
  handler: async (ctx) => {
    const leads: any[] = await ctx.runQuery(internal.jobLeads.listAllInternal, {});
    for (const lead of leads) {
      await ctx.runAction(internal.emailAgent.mirror.pushLead, { leadId: lead._id });
    }
    return { pushed: leads.length };
  },
});
