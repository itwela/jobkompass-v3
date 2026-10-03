import { describe, expect, it } from "vitest";
import { rateLimitMessageFromResponse } from "./message";

function response(status: number, retryAfter?: string) {
  return {
    status,
    headers: { get: (name: string) => (name === "Retry-After" ? retryAfter ?? null : null) },
  };
}

describe("rateLimitMessageFromResponse", () => {
  it("mentions minutes when Retry-After is at least a minute", () => {
    expect(rateLimitMessageFromResponse(response(429, "125"))).toBe(
      "Too many AI requests right now. Please try again in about 3 minutes.",
    );
  });

  it("mentions seconds for a short wait", () => {
    expect(rateLimitMessageFromResponse(response(429, "1"))).toBe(
      "Too many AI requests right now. Please try again in about 1 second.",
    );
  });

  it("stays friendly when the header is missing", () => {
    const message = rateLimitMessageFromResponse(response(429));
    expect(message.startsWith("Too many AI requests")).toBe(true);
    expect(message).not.toContain("429");
  });
});
