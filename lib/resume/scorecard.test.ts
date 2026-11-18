import { describe, expect, it } from "vitest";
import { compareScorecards, isDutyStyle, scoreResume } from "./scorecard";

const resume = {
  experience: [
    { details: ["Responsible for the billing service", "Cut deploy time 40% by moving CI to caching runners", "Helped onboard new hires"] },
  ],
  projects: [{ details: ["Built a CLI used by 300 people", "Worked on the docs site"] }],
  skills: { technical: ["ignored"] },
};

describe("scoreResume", () => {
  it("counts experience and project bullets", () => {
    const s = scoreResume(resume);
    expect(s).toEqual({ bullets: 5, quantified: 2, dutyStyle: 3, quantifiedPct: 40 });
  });

  it("handles empty input", () => {
    expect(scoreResume(null)).toEqual({ bullets: 0, quantified: 0, dutyStyle: 0, quantifiedPct: 0 });
  });

  it("reports must-haves when given", () => {
    const s = scoreResume(resume, { mustHaves: { met: ["Go", "AWS"], missing: ["Kafka"] } });
    expect(s.mustHaves).toEqual({ met: 2, total: 3, missing: ["Kafka"] });
  });
});

describe("isDutyStyle", () => {
  it("matches duty openers only at the start", () => {
    expect(isDutyStyle("- Assisted the team with releases")).toBe(true);
    expect(isDutyStyle("Tasked with migrating the database")).toBe(true);
    expect(isDutyStyle("Led the team that helped customers")).toBe(false);
    expect(isDutyStyle("Helpdesk tooling rebuilt in React")).toBe(false);
  });
});

describe("compareScorecards", () => {
  it("gives after minus before", () => {
    const before = scoreResume(resume, { mustHaves: { met: ["Go"], missing: ["AWS", "Kafka"] } });
    const after = scoreResume(
      { experience: [{ details: ["Cut billing errors 30%", "Cut deploy time 40%", "Onboarded 6 hires"] }], projects: [{ details: ["Built a CLI used by 300 people", "Wrote docs read by 2k devs"] }] },
      { mustHaves: { met: ["Go", "AWS"], missing: ["Kafka"] } },
    );
    expect(compareScorecards(before, after)).toEqual({ bullets: 0, quantified: 3, dutyStyle: -3, quantifiedPct: 60, mustHavesMet: 1 });
  });

  it("omits mustHavesMet when either side lacks it", () => {
    expect(compareScorecards(scoreResume(resume), scoreResume(resume)).mustHavesMet).toBeUndefined();
  });
});
