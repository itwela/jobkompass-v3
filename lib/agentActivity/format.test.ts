import { describe, expect, it } from "vitest";
import { NONE, fmtCost, fmtFeedTime, fmtRate, fmtSeconds, fmtStamp, fmtTokenSplit, fmtTokens, fmtWhen, rangeFrom, startOfDay } from "./format";

describe("agent activity format", () => {
  it("rates", () => {
    expect(fmtRate(0.976)).toBe("97.6%");
    expect(fmtRate(1)).toBe("100%");
    expect(fmtRate(0.95)).toBe("95.0%");
  });

  it("seconds", () => {
    expect(fmtSeconds(7800)).toBe("7.8s");
    expect(fmtSeconds(400)).toBe("0.4s");
    expect(fmtSeconds(125_000)).toBe("125s");
    expect(fmtSeconds(null)).toBe(NONE);
  });

  it("tokens: table, headline, not reported", () => {
    expect(fmtTokens(1_120_000, true)).toBe("1.12M");
    expect(fmtTokens(540_000, true)).toBe("540K");
    expect(fmtTokens(2_010_000, true, "headline")).toBe("2.0M");
    expect(fmtTokens(1500, true)).toBe("1.5K");
    expect(fmtTokens(0, false)).toBe(NONE);
  });

  it("cost", () => {
    expect(fmtCost(27.9, true)).toBe("$27.90");
    expect(fmtCost(0.004, true)).toBe("<$0.01");
    expect(fmtCost(0, false)).toBe(NONE);
  });

  it("times are local and relative to today", () => {
    const now = new Date(2026, 10, 19, 15, 0).getTime();
    expect(fmtFeedTime(new Date(2026, 10, 19, 14, 32).getTime(), now)).toBe("14:32");
    expect(fmtFeedTime(new Date(2026, 10, 18, 9, 0).getTime(), now)).toBe("Nov 18");
    expect(fmtWhen(new Date(2026, 10, 19, 12, 47).getTime(), now)).toBe("today at 12:47");
    expect(fmtStamp(new Date(2026, 10, 19, 12, 47, 8).getTime())).toBe("2026-11-19 12:47:08");
  });

  it("range lower bound is a stable day boundary", () => {
    const now = new Date(2026, 10, 19, 15, 0).getTime();
    expect(rangeFrom("all", now)).toBeUndefined();
    expect(rangeFrom("7d", now)).toBe(startOfDay(now) - 6 * 86_400_000);
    expect(rangeFrom("30d", now + 1000)).toBe(rangeFrom("30d", now));
  });

  it("token split", () => {
    expect(fmtTokenSplit(18240, 6110)).toBe("18,240 in · 6,110 out");
    expect(fmtTokenSplit(undefined, 5)).toBe("5 out");
    expect(fmtTokenSplit()).toBe(NONE);
  });
});
