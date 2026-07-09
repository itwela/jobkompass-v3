import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "poll gmail accounts for job leads",
  { minutes: 5 },
  internal.emailAgent.poll.pollAllAccounts
);

export default crons;
