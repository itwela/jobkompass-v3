import { describe, it, expect } from "vitest";
import { computePerformance, normalizeJob, parseDay, insightFacts, fmtPct } from "@/lib/performance/stats";

const NOW = new Date(2026, 10, 13, 12).getTime(); // Fri Nov 13 2026
const day = (y: number, m: number, d: number) => new Date(y, m - 1, d).getTime();

const jobs = [
  { status: "Interested", createdAt: day(2026, 11, 2) },
  { status: "Applied", dateApplied: "2026-11-03", createdAt: day(2026, 11, 2), resumeUsed: "Base resume" },
  { status: "Interviewing", dateApplied: "2026-11-10", createdAt: day(2026, 11, 9), resumeUsed: "Resume for Stripe",
    statusHistory: [{ status: "Applied", at: day(2026, 11, 10) }, { status: "Interviewing", at: day(2026, 11, 12) }] },
  { status: "Rejected", dateApplied: "2026-10-05", createdAt: day(2026, 10, 1) },
  { status: "Offered", dateApplied: "2026-10-20", createdAt: day(2026, 10, 1) },
  { status: "Ghosted", createdAt: day(2026, 9, 1) },
];

describe("performance stats", () => {
  it("parses date-only strings as local days", () => {
    expect(parseDay("2026-11-03")).toBe(day(2026, 11, 3));
    expect(parseDay("nonsense")).toBeNull();
    expect(parseDay(undefined)).toBeNull();
  });

  it("treats a missing statusHistory as unknown, not as a date", () => {
    const n = normalizeJob({ status: "Interviewing", createdAt: 1 });
    expect(n.interviewed).toBe(true);
    expect(n.interviewAt).toBeNull();
    expect(n.appliedAt).toBeNull();
  });

  it("month scope compares with last month", () => {
    const s = computePerformance(jobs, [], [], "month", NOW);
    expect(s.rate.applications).toBe(2);
    expect(s.rate.interviews).toBe(1);
    expect(s.rate.interviewRate).toBe(50);
    expect(s.prevRate?.applications).toBe(2);
    expect(s.prevRate?.offers).toBe(1);
    expect(s.appliedThisMonth).toBe(2);
    expect(s.appliedLastMonth).toBe(2);
    expect(s.prevMonthLabel).toBe("October");
  });

  it("all-time sankey adds up", () => {
    const s = computePerformance(jobs, [{ createdAt: NOW }], [{ createdAt: day(2026, 1, 1) }], "all", NOW);
    expect(s.sankey.saved).toBe(6);
    expect(s.sankey.applied + s.sankey.notApplied).toBe(6);
    expect(s.sankey.outcomes.reduce((a, o) => a + o.count, 0)).toBe(s.sankey.applied);
    expect(s.docs).toEqual({ resumes: 1, letters: 1, total: 2 });
    expect(s.undatedApplied).toBe(1);
  });

  it("weeks: 12, last is current, interviews only from history", () => {
    const s = computePerformance(jobs, [], [], "all", NOW);
    expect(s.weeks).toHaveLength(12);
    expect(s.weeks[11].current).toBe(true);
    expect(s.weeks[11].applied).toBe(1);
    expect(s.weeks[11].interviews).toBe(1);
    expect(s.hasInterviewDates).toBe(true);
  });

  it("insight facts split tailored vs base resumes", () => {
    const f = insightFacts(jobs, NOW);
    expect(f.baseResume.applications).toBe(1);
    expect(f.tailoredResume.interviews).toBe(1);
    expect(f.openWithBaseResume).toBe(1);
  });

  it("formats percentages like the frame", () => {
    expect(fmtPct(5.263)).toBe("5.3");
    expect(fmtPct(50)).toBe("50");
    expect(fmtPct(null)).toBe("–");
  });
});
