import { describe, expect, it } from "vitest";
import { resolveDate } from "../src/dates";

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

describe("resolveDate", () => {
  it("passes through YYYY-MM-DD", () => {
    expect(resolveDate("2026-07-04")).toBe("2026-07-04");
  });
  it("resolves today (local time)", () => {
    expect(resolveDate("today")).toBe(iso(new Date()));
  });
  it("resolves yesterday", () => {
    const y = new Date();
    y.setDate(y.getDate() - 1);
    expect(resolveDate("yesterday")).toBe(iso(y));
  });
  it("rejects garbage with a helpful error", () => {
    expect(() => resolveDate("July 4")).toThrow(/today, yesterday, or YYYY-MM-DD/);
  });
});
