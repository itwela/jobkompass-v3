import { describe, expect, it } from "vitest";
import { MAX_BULLET_ANSWERS, mergeBulletAnswers } from "./documents";

const a = (index: number, bullet: string, answer: string, answeredAt = 1) =>
  ({ section: "experience" as const, index, bullet, answer, answeredAt });

describe("mergeBulletAnswers", () => {
  it("adds new answers with a timestamp and trims strings", () => {
    const out = mergeBulletAnswers(undefined, [{ section: "projects", index: 0, bullet: "  Built the  CLI ", answer: " 300 users  " }], 5);
    expect(out).toEqual([{ section: "projects", index: 0, bullet: "Built the CLI", answer: "300 users", answeredAt: 5 }]);
  });

  it("replaces an answer on a similar bullet in the same slot", () => {
    const existing = [a(0, "Rebuilt the billing service in Go", "old")];
    const out = mergeBulletAnswers(existing, [{ section: "experience", index: 0, bullet: "Rebuilt the billing service in Go for speed", answer: "new" }], 9);
    expect(out).toHaveLength(1);
    expect(out[0].answer).toBe("new");
  });

  it("keeps answers for a different bullet, index or section", () => {
    const existing = [a(0, "Rebuilt the billing service in Go", "one")];
    const out = mergeBulletAnswers(existing, [
      { section: "experience", index: 0, bullet: "Mentored interns on testing practice", answer: "two" },
      { section: "experience", index: 1, bullet: "Rebuilt the billing service in Go", answer: "three" },
      { section: "projects", index: 0, bullet: "Rebuilt the billing service in Go", answer: "four" },
    ], 2);
    expect(out.map((x) => x.answer)).toEqual(["one", "two", "three", "four"]);
  });

  it("caps answer length and skips empty input", () => {
    const out = mergeBulletAnswers([], [
      { section: "experience", index: 0, bullet: "Shipped search", answer: "x".repeat(900) },
      { section: "experience", index: 1, bullet: "Shipped search", answer: "   " },
      { section: "experience", index: -1, bullet: "Shipped search", answer: "ok" },
    ], 1);
    expect(out).toHaveLength(1);
    expect(out[0].answer.length).toBe(400);
  });

  it("keeps the newest 50", () => {
    const existing = Array.from({ length: MAX_BULLET_ANSWERS }, (_, i) => a(i, `Bullet number${i} unique${i}`, `a${i}`));
    const out = mergeBulletAnswers(existing, [{ section: "projects", index: 0, bullet: "Brand new thing", answer: "new" }], 3);
    expect(out).toHaveLength(MAX_BULLET_ANSWERS);
    expect(out[0].answer).toBe("a1");
    expect(out[out.length - 1].answer).toBe("new");
  });
});
