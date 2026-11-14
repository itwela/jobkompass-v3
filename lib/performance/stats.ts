// Performance (D11 / M09): every number on the screen is computed here from the
// user's own jobs and documents. Nothing is estimated. When a fact can't be known
// (old jobs have no statusHistory, so we don't know when an interview was booked)
// the value is null and the screen says so.

import { statusKey, type StatusKey } from "@/lib/jkStatus";

export interface PerfJob {
  status: string;
  dateApplied?: string | null;
  interviewed?: boolean | null;
  resumeUsed?: string | null;
  createdAt: number;
  statusHistory?: { status: string; at: number }[] | null;
}

export interface PerfDoc {
  createdAt?: number | null;
  _creationTime?: number;
}

export type PerfScope = "month" | "all";

const DAY = 86_400_000;
const INTERVIEW_KEYS: StatusKey[] = ["callback", "interviewing", "offered"];

/** "2026-11-04", "11/04/2026", ISO strings → local ms. Unparseable → null. */
export function parseDay(value?: string | null): number | null {
  if (!value) return null;
  const s = value.trim();
  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (ymd) return new Date(+ymd[1], +ymd[2] - 1, +ymd[3]).getTime();
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
}

export interface NormJob {
  key: StatusKey;
  applied: boolean;
  /** When it was applied to, if known. */
  appliedAt: number | null;
  /** Reached a callback / interview / offer. */
  interviewed: boolean;
  /** When the interview was booked, if known (statusHistory only). */
  interviewAt: number | null;
  offered: boolean;
  createdAt: number;
  tailored: boolean | null;
}

export function normalizeJob(j: PerfJob): NormJob {
  const key = statusKey(j.status);
  const history = (j.statusHistory ?? []).slice().sort((a, b) => a.at - b.at);
  const firstAt = (keys: StatusKey[]) => history.find((h) => keys.includes(statusKey(h.status)))?.at ?? null;
  const histApplied = history.find((h) => statusKey(h.status) !== "interested")?.at ?? null;
  const appliedAt = parseDay(j.dateApplied) ?? histApplied;
  const interviewAt = firstAt(INTERVIEW_KEYS);
  const interviewed = INTERVIEW_KEYS.includes(key) || !!j.interviewed || interviewAt !== null;
  const applied = key !== "interested" || appliedAt !== null;
  const resume = (j.resumeUsed ?? "").trim();
  return {
    key,
    applied,
    appliedAt,
    interviewed,
    interviewAt,
    offered: key === "offered",
    createdAt: j.createdAt,
    tailored: resume ? !/base|master|general/i.test(resume) : null,
  };
}

export function monthStart(now: number, offset = 0): number {
  const d = new Date(now);
  return new Date(d.getFullYear(), d.getMonth() + offset, 1).getTime();
}

export function monthName(ts: number, style: "long" | "short" = "long"): string {
  return new Date(ts).toLocaleString("en-US", { month: style });
}

/** Monday 00:00 of the week containing ts. */
export function weekStart(ts: number): number {
  const d = new Date(ts);
  const day = (d.getDay() + 6) % 7;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - day).getTime();
}

const pct = (n: number, d: number) => (d > 0 ? (n / d) * 100 : null);

export interface RateBlock {
  applications: number;
  interviews: number;
  offers: number;
  interviewRate: number | null;
  offerRate: number | null;
}

function rateFor(jobs: NormJob[]): RateBlock {
  const applied = jobs.filter((j) => j.applied);
  const interviews = applied.filter((j) => j.interviewed).length;
  const offers = applied.filter((j) => j.offered).length;
  return {
    applications: applied.length,
    interviews,
    offers,
    interviewRate: pct(interviews, applied.length),
    offerRate: pct(offers, applied.length),
  };
}

const inRange = (t: number | null, a: number, b: number) => t !== null && t >= a && t < b;

export interface SankeyData {
  saved: number;
  applied: number;
  notApplied: number;
  outcomes: { key: "offered" | "interviewing" | "waiting" | "rejected" | "ghosted"; label: string; count: number }[];
}

export interface WeekPoint {
  start: number;
  applied: number;
  /** Interviews booked that week (null when no job carries a booking date at all). */
  interviews: number;
  current: boolean;
}

export interface PerformanceStats {
  scope: PerfScope;
  totalJobs: number;
  /** Jobs the scope covers (all jobs, or jobs saved this month). */
  scopedJobs: number;
  rate: RateBlock;
  /** Previous month's rate (month scope only). */
  prevRate: RateBlock | null;
  prevMonthLabel: string;
  monthLabel: string;
  appliedThisMonth: number;
  appliedLastMonth: number;
  appliedTotal: number;
  docs: { resumes: number; letters: number; total: number };
  /** Six months, oldest first. */
  sparks: { offerRate: (number | null)[]; applied: number[]; docs: number[] };
  sankey: SankeyData;
  weeks: WeekPoint[];
  weeklyAverage: number;
  /** True when at least one job has a known interview-booking date. */
  hasInterviewDates: boolean;
  /** Jobs that count as applied but have no date: they can't be placed on a week. */
  undatedApplied: number;
}

const docTime = (d: PerfDoc) => d.createdAt ?? d._creationTime ?? null;

export function computePerformance(
  rawJobs: PerfJob[],
  resumes: PerfDoc[],
  letters: PerfDoc[],
  scope: PerfScope,
  now = Date.now(),
): PerformanceStats {
  const jobs = rawJobs.map(normalizeJob);
  const m0 = monthStart(now);
  const m1 = monthStart(now, 1);
  const mPrev = monthStart(now, -1);

  const appliedIn = (a: number, b: number) => jobs.filter((j) => j.applied && inRange(j.appliedAt, a, b));

  const rate = scope === "month" ? rateFor(appliedIn(m0, m1)) : rateFor(jobs);
  const prevRate = scope === "month" ? rateFor(appliedIn(mPrev, m0)) : null;

  const scoped = scope === "month" ? jobs.filter((j) => inRange(j.createdAt, m0, m1)) : jobs;

  const inMonth = (t: number | null) => inRange(t, m0, m1);
  const docsIn = (list: PerfDoc[]) => (scope === "month" ? list.filter((d) => inMonth(docTime(d))) : list);
  const r = docsIn(resumes).length;
  const l = docsIn(letters).length;

  const months = Array.from({ length: 6 }, (_, i) => [monthStart(now, i - 5), monthStart(now, i - 4)] as const);
  const allDocs = [...resumes, ...letters];
  const sparks = {
    offerRate: months.map(([a, b]) => rateFor(appliedIn(a, b)).offerRate),
    applied: months.map(([a, b]) => appliedIn(a, b).length),
    docs: months.map(([a, b]) => allDocs.filter((d) => inRange(docTime(d), a, b)).length),
  };

  const appliedJobs = scoped.filter((j) => j.applied);
  const count = (f: (j: NormJob) => boolean) => appliedJobs.filter(f).length;
  const sankey: SankeyData = {
    saved: scoped.length,
    applied: appliedJobs.length,
    notApplied: scoped.length - appliedJobs.length,
    outcomes: [
      { key: "offered", label: "Offered", count: count((j) => j.key === "offered") },
      { key: "interviewing", label: "Interviewing", count: count((j) => j.key === "interviewing" || j.key === "callback") },
      { key: "waiting", label: "Still waiting", count: count((j) => j.key === "applied" || j.key === "interested") },
      { key: "rejected", label: "Rejected", count: count((j) => j.key === "rejected") },
      { key: "ghosted", label: "Ghosted", count: count((j) => j.key === "ghosted") },
    ],
  };

  const thisWeek = weekStart(now);
  const weeks: WeekPoint[] = Array.from({ length: 12 }, (_, i) => {
    // Step by calendar days so DST changes don't shift a week.
    const d = new Date(thisWeek);
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - (11 - i) * 7).getTime();
    const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() - (10 - i) * 7).getTime();
    return {
      start,
      applied: jobs.filter((j) => j.applied && inRange(j.appliedAt, start, end)).length,
      interviews: jobs.filter((j) => inRange(j.interviewAt, start, end)).length,
      current: i === 11,
    };
  });
  // The current week is still running, so the average uses the 11 finished weeks.
  const finished = weeks.slice(0, 11);
  const weeklyAverage = finished.reduce((a, w) => a + w.applied, 0) / finished.length;

  return {
    scope,
    totalJobs: jobs.length,
    scopedJobs: scoped.length,
    rate,
    prevRate,
    monthLabel: monthName(m0),
    prevMonthLabel: monthName(mPrev),
    appliedThisMonth: appliedIn(m0, m1).length,
    appliedLastMonth: appliedIn(mPrev, m0).length,
    appliedTotal: jobs.filter((j) => j.applied).length,
    docs: { resumes: r, letters: l, total: r + l },
    sparks,
    sankey,
    weeks,
    weeklyAverage,
    hasInterviewDates: jobs.some((j) => j.interviewAt !== null),
    undatedApplied: jobs.filter((j) => j.applied && j.appliedAt === null).length,
  };
}

/** The facts the AI may use for "What JobKompass sees". Plain numbers only. */
export function insightFacts(rawJobs: PerfJob[], now = Date.now()) {
  const jobs = rawJobs.map(normalizeJob);
  const applied = jobs.filter((j) => j.applied);
  const group = (f: (j: NormJob) => boolean) => {
    const g = applied.filter(f);
    return {
      applications: g.length,
      interviews: g.filter((j) => j.interviewed).length,
      ghosted: g.filter((j) => j.key === "ghosted").length,
      rejected: g.filter((j) => j.key === "rejected").length,
      offers: g.filter((j) => j.offered).length,
    };
  };
  const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const byWeekday = weekdays.map((day, i) => ({ day, ...group((j) => j.appliedAt !== null && new Date(j.appliedAt).getDay() === i) }));
  const last30 = applied.filter((j) => j.appliedAt !== null && j.appliedAt >= now - 30 * DAY).length;
  return {
    totalJobs: jobs.length,
    notApplied: jobs.length - applied.length,
    all: group(() => true),
    tailoredResume: group((j) => j.tailored === true),
    baseResume: group((j) => j.tailored === false),
    noResumeRecorded: group((j) => j.tailored === null),
    openWithBaseResume: applied.filter((j) => j.tailored === false && (j.key === "applied" || j.key === "callback")).length,
    byWeekday: byWeekday.filter((d) => d.applications > 0),
    appliedLast30Days: last30,
    appliedWithoutDate: applied.filter((j) => j.appliedAt === null).length,
  };
}

export type InsightFacts = ReturnType<typeof insightFacts>;

/** Formats a percentage the way the frames do: one decimal under 10, whole above. */
export function fmtPct(v: number | null): string {
  if (v === null) return "–";
  if (v === 0) return "0";
  return v < 10 ? v.toFixed(1) : Math.round(v).toString();
}
