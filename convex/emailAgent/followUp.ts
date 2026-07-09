import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { isEligibleForFollowUp } from "../../lib/emailAgent/followUpEligibility";

export const checkFollowUps = internalAction({
  args: {},
  handler: async (ctx) => {
    const sentLeads = await ctx.runQuery(internal.jobLeads.getSentLeads, {});
    const now = Date.now();

    for (const lead of sentLeads) {
      if (isEligibleForFollowUp(lead, now)) {
        await ctx.scheduler.runAfter(0, internal.emailAgent.draft.draftForLead, {
          leadId: lead._id,
          isFollowUp: true,
        });
      }
    }
  },
});
