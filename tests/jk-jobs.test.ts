import { describe, expect, it } from "vitest";
import { annualPay, appliedDate, compTier, companyDomain, stepIndex } from "@/lib/jkJobs";
import { nextStatusHistory } from "@/convex/jobStatusHistory";

describe("compTier", () => {
  it("reads salary ranges by their top number", () => {
    expect(compTier("$150k - $180k")).toBe(3);
    expect(compTier("$220,000")).toBe(4);
    expect(compTier("$60k")).toBe(1);
  });
  it("annualises hourly pay", () => {
    expect(annualPay("$62/hr, 9 months")).toBe(62 * 2080);
    expect(compTier("$62/hr, 9 months")).toBe(2);
  });
  it("is 0 without a number", () => {
    expect(compTier("Competitive")).toBe(0);
    expect(compTier(undefined)).toBe(0);
  });
});

describe("appliedDate", () => {
  it("keeps ISO, normalises other dates, nulls empties", () => {
    expect(appliedDate("2026-11-05")).toBe("2026-11-05");
    expect(appliedDate("2026-11-05T10:00:00Z")).toBe("2026-11-05");
    expect(appliedDate("")).toBeNull();
    expect(appliedDate("last week")).toBe("last week");
  });
});

describe("companyDomain", () => {
  it("uses the employer's host", () => {
    expect(companyDomain("https://careers.blackrock.com/job/1", "BlackRock")).toBe("blackrock.com");
  });
  it("falls back to the name for job boards", () => {
    expect(companyDomain("https://boards.greenhouse.io/anthropic/jobs/1", "Anthropic")).toBe("anthropic.com");
    expect(companyDomain("", "PTC (via Mondo)")).toBe("ptc.com");
  });
});

describe("stepIndex", () => {
  it("clamps J/K movement", () => {
    expect(stepIndex(-1, 1, 3)).toBe(0);
    expect(stepIndex(-1, -1, 3)).toBe(2);
    expect(stepIndex(2, 1, 3)).toBe(2);
    expect(stepIndex(0, -1, 3)).toBe(0);
    expect(stepIndex(0, 1, 0)).toBe(-1);
  });
});

describe("nextStatusHistory", () => {
  it("starts a history for a new job", () => {
    expect(nextStatusHistory(undefined, undefined, "Interested", 1)).toEqual([{ status: "Interested", at: 1 }]);
  });
  it("appends only on a real change", () => {
    const h = [{ status: "Interested", at: 1 }];
    expect(nextStatusHistory(h, "Interested", "Applied", 2)).toEqual([...h, { status: "Applied", at: 2 }]);
    expect(nextStatusHistory(h, "Applied", "Applied", 3)).toBeNull();
    expect(nextStatusHistory(h, "Applied", undefined, 3)).toBeNull();
  });
});
