import { describe, expect, it } from "vitest";
import { anonymousKeyFromHeaders } from "./anonymousKey";

function headers(values: Record<string, string>): { get(name: string): string | null } {
  const map = new Map(Object.entries(values).map(([key, value]) => [key.toLowerCase(), value]));
  return { get: (name) => map.get(name.toLowerCase()) ?? null };
}

describe("anonymousKeyFromHeaders", () => {
  it("hashes the first forwarded IP and never returns the raw address", () => {
    const key = anonymousKeyFromHeaders(headers({ "x-forwarded-for": "203.0.113.10, 10.0.0.1" }));
    expect(key).toMatch(/^ip:[a-f0-9]{32}$/);
    expect(key).not.toContain("203.0.113.10");
    expect(anonymousKeyFromHeaders(headers({ "x-forwarded-for": "203.0.113.10" }))).toBe(key);
    expect(anonymousKeyFromHeaders(headers({ "x-real-ip": "198.51.100.4" }))).not.toBe(key);
  });

  it("shares one bucket when no proxy header is present", () => {
    expect(anonymousKeyFromHeaders(headers({}))).toBe("ip:unknown");
  });
});
