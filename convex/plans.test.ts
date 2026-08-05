import { describe, expect, it } from "vitest";
import {
  hasProPlanEver,
  meetsTier,
  planRank,
  rankLabel,
  RANK_FREE,
  RANK_PLUS,
  RANK_PRO,
  RANK_STARTER,
} from "./plans";

describe("planRank", () => {
  it("treats a missing subscription as free", () => {
    expect(planRank(null)).toBe(RANK_FREE);
    expect(planRank(undefined)).toBe(RANK_FREE);
    expect(planRank({})).toBe(RANK_FREE);
  });

  it("ranks each active plan", () => {
    expect(planRank({ planId: "starter", status: "active" })).toBe(RANK_STARTER);
    expect(planRank({ planId: "plus", status: "active" })).toBe(RANK_PLUS);
    expect(planRank({ planId: "plus-annual", status: "active" })).toBe(RANK_PLUS);
    expect(planRank({ planId: "pro", status: "active" })).toBe(RANK_PRO);
    expect(planRank({ planId: "pro-annual", status: "active" })).toBe(RANK_PRO);
  });

  it("grants the tier while trialing or past_due", () => {
    expect(planRank({ planId: "pro", status: "trialing" })).toBe(RANK_PRO);
    expect(planRank({ planId: "pro", status: "past_due" })).toBe(RANK_PRO);
  });

  it("demotes a cancelled or expired subscription to free", () => {
    expect(planRank({ planId: "pro", status: "canceled" })).toBe(RANK_FREE);
    expect(planRank({ planId: "plus", status: "incomplete_expired" })).toBe(RANK_FREE);
  });

  it("honors a paid plan carrying an empty status, matching legacy records", () => {
    expect(planRank({ planId: "pro", status: "" })).toBe(RANK_PRO);
    expect(planRank({ planId: "free", status: "" })).toBe(RANK_FREE);
  });

  it("is case insensitive and ignores unknown plans", () => {
    expect(planRank({ planId: "PRO", status: "ACTIVE" })).toBe(RANK_PRO);
    expect(planRank({ planId: "enterprise", status: "active" })).toBe(RANK_FREE);
  });
});

describe("meetsTier", () => {
  it("passes at or above the required rank", () => {
    expect(meetsTier({ planId: "pro", status: "active" }, RANK_PLUS)).toBe(true);
    expect(meetsTier({ planId: "plus", status: "active" }, RANK_PLUS)).toBe(true);
  });

  it("fails below the required rank", () => {
    expect(meetsTier({ planId: "starter", status: "active" }, RANK_PLUS)).toBe(false);
    expect(meetsTier(null, RANK_STARTER)).toBe(false);
  });
});

describe("hasProPlanEver", () => {
  it("stays true for a cancelled pro plan so job limits never demote", () => {
    expect(hasProPlanEver({ planId: "pro", status: "canceled" })).toBe(true);
    expect(hasProPlanEver({ planId: "pro-annual", status: "canceled" })).toBe(true);
  });

  it("is false for every non-pro plan", () => {
    expect(hasProPlanEver({ planId: "plus", status: "active" })).toBe(false);
    expect(hasProPlanEver(null)).toBe(false);
  });
});

describe("rankLabel", () => {
  it("names each rank", () => {
    expect(rankLabel(RANK_FREE)).toBe("Free");
    expect(rankLabel(RANK_STARTER)).toBe("Starter");
    expect(rankLabel(RANK_PLUS)).toBe("Plus");
    expect(rankLabel(RANK_PRO)).toBe("Pro");
  });
});
