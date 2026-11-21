/**
 * In-app Agent activity page (Settings, D27-D29 / M26-M27). Signed-in user only: the user id
 * comes from the session (same resolution as CLI keys), never from args. Reuses the HTTP API's
 * index choice (fns.activityQuery) and aggregation (activityLog.ts), so both read the same numbers.
 */
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { query } from "../_generated/server";
import type { QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { currentConvexUserId } from "./keys";
import { activityOut, activityQuery, keyInfoFor } from "./fns";
import { SUMMARY_SCAN_CAP, activityOverview, filterOptions, matchesFilter } from "./activityLog";

const filterArgs = {
  agent: v.optional(v.string()),
  model: v.optional(v.string()),
  actionType: v.optional(v.string()),
  status: v.optional(v.union(v.literal("success"), v.literal("error"))),
  /** ms epoch, inclusive. */
  from: v.optional(v.number()),
  to: v.optional(v.number()),
};

const asTime = (ms?: number) => (ms === undefined ? undefined : String(Math.floor(ms)));

/**
 * A readable name for the target when it is the id of one of the user's own jobs, resumes or
 * cover letters (automatic rows store the id). Anything else is shown as stored.
 */
async function targetLabel(ctx: QueryCtx, userId: string, target?: string): Promise<{ label?: string; jobId?: string }> {
  if (!target || target.includes(",")) return {};
  const jobId = ctx.db.normalizeId("jobs", target);
  if (jobId) {
    const job = await ctx.db.get(jobId);
    return job && job.userId === userId ? { label: `${job.title}, ${job.company}`, jobId } : {};
  }
  for (const table of ["resumes", "coverLetters"] as const) {
    const id = ctx.db.normalizeId(table, target);
    if (id) {
      const doc = (await ctx.db.get(id)) as Doc<"resumes"> | Doc<"coverLetters"> | null;
      return doc && doc.userId === userId ? { label: doc.name } : {};
    }
  }
  return {};
}

/** The feed, newest first, paginated. Empty page when signed out. */
export const listMine = query({
  args: { ...filterArgs, paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts, from, to, ...f }) => {
    const userId = await currentConvexUserId(ctx);
    if (!userId) return { page: [], isDone: true, continueCursor: "" };
    const result = await activityQuery(ctx, { userId, ...f, from: asTime(from), to: asTime(to) }).paginate(paginationOpts);
    const keyOf = await keyInfoFor(ctx, userId, result.page);
    const page = await Promise.all(
      result.page.map(async (r) => {
        const { label, jobId } = await targetLabel(ctx, userId, r.target);
        const key = keyOf(r);
        return { ...activityOut(r), targetLabel: label, targetJobId: jobId, keyName: key?.keyName, keyScoped: key?.keyScoped };
      })
    );
    return { ...result, page };
  },
});

/**
 * Headline figures, by model / agent / action, and the filter menus, from one scan of the range
 * (capped at SUMMARY_SCAN_CAP rows, newest first; `truncated` says when the cap was hit).
 * `hasAny` is false only when the user has never had a row: that is the empty state (D29).
 */
export const summaryMine = query({
  args: { ...filterArgs, todayStart: v.number() },
  handler: async (ctx, { from, to, todayStart, ...f }) => {
    const userId = await currentConvexUserId(ctx);
    if (!userId) return null;
    const hasAny =
      (await ctx.db.query("agentActivityLog").withIndex("by_user_time", (q) => q.eq("userId", userId)).first()) !== null;
    if (!hasAny) return { hasAny: false as const };
    const scanned = await activityQuery(ctx, { userId, from: asTime(from), to: asTime(to) }).take(SUMMARY_SCAN_CAP + 1);
    const truncated = scanned.length > SUMMARY_SCAN_CAP;
    const inRange = truncated ? scanned.slice(0, SUMMARY_SCAN_CAP) : scanned;
    const rows = inRange.filter((r) => matchesFilter(r, f));
    return {
      hasAny: true as const,
      options: filterOptions(inRange),
      ...activityOverview(rows, { todayStart, truncated }),
    };
  },
});

/** How far back the My Jobs "Added by" column looks (newest rows first). */
const JOB_AGENTS_SCAN_CAP = 3000;

/**
 * Which agents touched which of the user's jobs, for the My Jobs "Added by" column.
 * One entry per job and agent, with that agent's job actions oldest first. Jobs no agent
 * touched are absent (the user did them). Rows aimed at several targets are skipped.
 */
export const jobAgentsMine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await currentConvexUserId(ctx);
    if (!userId) return [];
    const rows = await ctx.db
      .query("agentActivityLog")
      .withIndex("by_user_time", (q) => q.eq("userId", userId))
      .order("desc")
      .take(JOB_AGENTS_SCAN_CAP);
    const byKey = new Map<string, { jobId: string; agentName: string; model: string; provider: string; actions: { at: number; actionType: string; ok: boolean }[] }>();
    for (const r of rows) {
      if (!r.actionType.startsWith("jobs.") || !r.target || r.target.includes(",")) continue;
      const jobId = ctx.db.normalizeId("jobs", r.target);
      if (!jobId) continue;
      const key = `${jobId}|${r.agentName}`;
      let e = byKey.get(key);
      if (!e) {
        e = { jobId, agentName: r.agentName, model: r.model, provider: r.provider, actions: [] };
        byKey.set(key, e);
      }
      e.actions.push({ at: r.timestamp, actionType: r.actionType, ok: r.status === "success" });
    }
    return [...byKey.values()].map((e) => ({ ...e, actions: e.actions.reverse() }));
  },
});
