import { cronJobs } from "convex/server";

// The job-leads email agent was retired on Nov 17 2026, so nothing is scheduled:
// no Gmail polling, no follow-up checks, no send reconciliation.
const crons = cronJobs();

export default crons;
