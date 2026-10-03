import { afterEach, describe, expect, it, vi } from "vitest";
import { HOUR } from "@convex-dev/rate-limiter";
import { consumeOrFailOpen } from "./rateLimit";
import { RATE_LIMIT_FRIENDLY as uiFriendly } from "../lib/rateLimit/message";
import {
  RATE_LIMIT_FRIENDLY,
  RATE_LIMITS,
  resolvePublicConsume,
  retryAfterSeconds,
  sanitizeAnonymousKey,
  sanitizeUserKey,
} from "./rateLimitConfig";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("rate limit config", () => {
  it("keeps the conservative buckets in one object", () => {
    expect(RATE_LIMITS.freeResume).toMatchObject({
      kind: "fixed window",
      rate: 5,
      period: HOUR,
    });
    expect(RATE_LIMITS.ai).toMatchObject({ kind: "token bucket", rate: 30, capacity: 8 });
    expect(RATE_LIMITS.anonymousAi.rate).toBeLessThanOrEqual(8);
    expect(RATE_LIMITS.extension.rate).toBeLessThanOrEqual(15);
    expect(RATE_LIMITS.emailAgent.rate).toBeLessThanOrEqual(40);
    expect(Object.keys(RATE_LIMITS).sort()).toEqual(
      ["ai", "anonymousAi", "emailAgent", "extension", "freeResume"].sort(),
    );
  });

  it("uses the auth user id for signed-in AI and the IP hash otherwise", () => {
    const hash = `ip:${"ab".repeat(16)}`;
    expect(
      resolvePublicConsume({ bucket: "ai", userId: "user_123", anonymousKey: hash }),
    ).toEqual({ bucket: "ai", key: "user_123" });
    expect(
      resolvePublicConsume({ bucket: "ai", userId: null, anonymousKey: hash }),
    ).toEqual({ bucket: "anonymousAi", key: hash });
    expect(
      resolvePublicConsume({
        bucket: "freeResume",
        userId: "user_123",
        anonymousKey: hash,
      }),
    ).toEqual({ bucket: "freeResume", key: hash });
  });

  it("rejects raw IPs, emails, and oversized keys", () => {
    expect(sanitizeAnonymousKey("203.0.113.10")).toBe("ip:unknown");
    expect(sanitizeAnonymousKey("ada@example.com")).toBe("ip:unknown");
    expect(sanitizeAnonymousKey(`ip:${"g".repeat(32)}`)).toBe("ip:unknown");
    expect(sanitizeAnonymousKey(`ip:${"a".repeat(32)}`)).toBe(`ip:${"a".repeat(32)}`);
    expect(sanitizeUserKey("")).toBeNull();
    expect(sanitizeUserKey(`bad\nid`)).toBeNull();
    expect(sanitizeUserKey("user_123")).toBe("user_123");
  });

  it("uses the same short sentence the email-agent UI matches", () => {
    expect(RATE_LIMIT_FRIENDLY).toBe(uiFriendly);
    expect(RATE_LIMIT_FRIENDLY.startsWith("Too many AI requests")).toBe(true);
  });

  it("turns component milliseconds into Retry-After seconds", () => {
    expect(retryAfterSeconds(125_000)).toBe(125);
    expect(retryAfterSeconds(1)).toBe(1);
    expect(retryAfterSeconds(0)).toBe(1);
    expect(retryAfterSeconds(undefined)).toBe(1);
  });
});

describe("consumeOrFailOpen", () => {
  it("fails open when the component is not available and does not log the key", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = await consumeOrFailOpen({} as never, "ai", "user_secret_123");
    expect(result).toEqual({ ok: true, retryAfter: 0, failOpen: true });
    const logged = warn.mock.calls.flat().join(" ");
    expect(logged).toContain("allowing");
    expect(logged).not.toContain("user_secret_123");
    expect(logged).not.toContain("@");
  });

  it("blocks a request that has no usable user key", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = await consumeOrFailOpen({} as never, "extension", "  ");
    expect(result.ok).toBe(false);
    expect(result.retryAfter).toBe(60_000);
    expect(result.failOpen).toBeUndefined();
    expect(warn.mock.calls.flat().join(" ")).toContain("blocking");
  });
});
