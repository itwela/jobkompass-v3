import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "poll gmail accounts for job leads",
  { minutes: 5 },
  internal.emailAgent.poll.pollAllAccounts
);

crons.daily(
  "check job leads for follow-up",
  { hourUTC: 14, minuteUTC: 0 }, // ~9am Eastern
  internal.emailAgent.followUp.checkFollowUps
);

crons.interval(
  "reconcile stuck sending leads",
  { minutes: 20 },
  internal.jobLeads.reconcileStuckSends
);

export default crons;
