import { describe, expect, it } from "vitest";
import { upgradeOffer, trialEndLabel, basePlanId, formatUsd, priceNumber } from "../lib/upgradeOffer";
import { PLAN_LIMITS } from "../hooks/useFeatureAccess";

describe("upgradeOffer", () => {
  it("names the CLI and lists what Pro adds over Plus (D15)", () => {
    const o = upgradeOffer("jk CLI", "plus", PLAN_LIMITS);
    expect(o.target).toBe("pro");
    expect(o.headline).toBe("The jk CLI is part of Pro");
    expect(o.currentName).toBe("Plus");
    expect(o.adds).toEqual([
      "jk CLI and agent access",
      "180 AI documents a month, up from 60",
      "Unlimited tracked jobs, up from 100",
      "Mar resume template",
      "Priority support",
    ]);
  });
  it("offers Plus to a free user who hit the document limit", () => {
    const o = upgradeOffer("AI-generated documents", "free", PLAN_LIMITS);
    expect(o.target).toBe("plus");
    expect(o.adds[0]).toBe("60 AI documents a month, up from 3");
  });
  it("offers Pro for jobs once already on Plus, nothing on Pro", () => {
    expect(upgradeOffer("Job tracking", "plus-annual", PLAN_LIMITS).target).toBe("pro");
    expect(upgradeOffer("Job tracking", "pro", PLAN_LIMITS).target).toBeNull();
  });
  it("search goes to Plus from free", () => {
    expect(upgradeOffer("Search functionality", null, PLAN_LIMITS).headline).toBe("Search is part of Plus");
  });
  it("templates honour the required plan", () => {
    expect(upgradeOffer("Joseph resume template", "free", PLAN_LIMITS, "plus").headline).toBe("The Joseph template is part of Plus");
  });
});

describe("helpers", () => {
  it("trial end is today + days", () => {
    expect(trialEndLabel(7, new Date(2026, 10, 12))).toBe("Nov 19");
  });
  it("plan ids and prices", () => {
    expect(basePlanId("Pro-Annual")).toBe("pro");
    expect(formatUsd(priceNumber("$179.99") / 12)).toBe("$15.00");
  });
});
