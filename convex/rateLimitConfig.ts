import { HOUR, type RateLimitConfig } from "@convex-dev/rate-limiter";

/**
 * One place to change AI rate limits.
 *
 * `rate` is how many requests refill over `period`. `capacity` is the burst.
 * A fixed window allows `rate` requests per `period` and then waits out the window.
 *
 * These numbers are only enforced after the Convex rate-limiter component is
 * deployed. Until then every check fails open. See docs/rate-limiting.md.
 */
export const RATE_LIMITS = {
  /** Signed-in product AI: chat, assist, templates, jobs, PDF extract, retitle, performance. */
  ai: { kind: "token bucket", rate: 30, period: HOUR, capacity: 8 },
  /** Logged-out calls to those same routes. Keyed by a hash of the IP. */
  anonymousAi: { kind: "token bucket", rate: 8, period: HOUR, capacity: 3 },
  /** Free resume generator. Always per IP hash, even when a session exists. */
  freeResume: { kind: "fixed window", rate: 5, period: HOUR },
  /** Chrome extension job parse. Keyed by the extension user's id. */
  extension: { kind: "token bucket", rate: 15, period: HOUR, capacity: 3 },
  /** Inbox classification, tailoring, and reply drafts. Separate so a poll cannot lock out chat. */
  emailAgent: { kind: "token bucket", rate: 40, period: HOUR, capacity: 8 },
} satisfies Record<string, RateLimitConfig>;

export type BucketName = keyof typeof RATE_LIMITS;

/** Buckets a Next route may ask for. The mutation picks the real bucket from auth. */
export type ClientBucket = "ai" | "freeResume";

export const RATE_LIMIT_FRIENDLY =
  "Too many AI requests. Try again in a few minutes.";

const ANONYMOUS_KEY = /^ip:(?:[a-f0-9]{32}|unknown)$/;

/** Accept only keys this server minted. Anything else shares the unknown bucket. */
export function sanitizeAnonymousKey(key: string | undefined | null): string {
  if (typeof key === "string" && ANONYMOUS_KEY.test(key)) return key;
  return "ip:unknown";
}

/** Auth and extension user ids only. Rejects blank, huge, or control-character keys. */
export function sanitizeUserKey(userId: string | undefined | null): string | null {
  if (typeof userId !== "string") return null;
  const trimmed = userId.trim();
  if (!trimmed || trimmed.length > 200) return null;
  if (/[\u0000-\u001f]/.test(trimmed)) return null;
  return trimmed;
}

export function resolvePublicConsume(input: {
  bucket: ClientBucket;
  userId: string | null;
  anonymousKey: string | undefined;
}): { bucket: BucketName; key: string } {
  const anonymousKey = sanitizeAnonymousKey(input.anonymousKey);
  if (input.bucket === "freeResume") {
    return { bucket: "freeResume", key: anonymousKey };
  }
  const userKey = sanitizeUserKey(input.userId);
  if (userKey) return { bucket: "ai", key: userKey };
  return { bucket: "anonymousAi", key: anonymousKey };
}

/** HTTP Retry-After is seconds. The component reports milliseconds. */
export function retryAfterSeconds(retryAfterMs: number | undefined): number {
  if (typeof retryAfterMs !== "number" || !Number.isFinite(retryAfterMs) || retryAfterMs <= 0) {
    return 1;
  }
  return Math.max(1, Math.ceil(retryAfterMs / 1000));
}

export type ConsumeResult = {
  ok: boolean;
  /** Milliseconds, matching the component. Zero when the request is allowed. */
  retryAfter: number;
  /** True when the limiter was missing or threw and the request was allowed anyway. */
  failOpen?: boolean;
};

export function limitKeyForBucket(bucket: BucketName, key: string): string | null {
  if (bucket === "freeResume" || bucket === "anonymousAi") {
    return sanitizeAnonymousKey(key);
  }
  return sanitizeUserKey(key);
}
