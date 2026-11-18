import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/onboarding/server", () => ({ compileResumePdf: vi.fn(), convexForCaller: vi.fn() }));
import { isPremiumRank, mergeAnswers } from "./tailorServer";

describe("isPremiumRank", () => {
  it("is premium from starter up", () => {
    expect(isPremiumRank(0)).toBe(false);
    expect(isPremiumRank(1)).toBe(true);
    expect(isPremiumRank(3)).toBe(true);
    expect(isPremiumRank(undefined)).toBe(false);
  });
});

describe("mergeAnswers", () => {
  it("keeps stored answers and lets a newer answer about the same bullet win", () => {
    const stored = [
      { section: "experience", index: 0, bullet: "Built the API", answer: "about 200 users", answeredAt: 1 },
      { section: "projects", index: 1, bullet: "Shipped app", answer: "3 weeks", answeredAt: 1 },
    ];
    const extra = [{ section: "experience", index: 0, bullet: "Built  the API", answer: "2,000 users" }];
    const merged = mergeAnswers(stored, extra);
    expect(merged).toHaveLength(2);
    expect(merged.find((a) => a.section === "experience")?.answer).toBe("2,000 users");
  });
});
