const FRIENDLY =
  "Too many AI requests right now. Please wait a few minutes and try again.";

/** Same sentence thrown by Convex email-agent actions. */
export const RATE_LIMIT_FRIENDLY =
  "Too many AI requests. Try again in a few minutes.";

/** Friendly copy for a 429. Uses Retry-After when the route sent one. */
export function rateLimitMessageFromResponse(response: {
  status: number;
  headers: { get(name: string): string | null };
}): string {
  if (response.status !== 429) return FRIENDLY;
  const raw = response.headers.get("Retry-After");
  const seconds = raw === null ? NaN : Number(raw);
  if (!Number.isFinite(seconds) || seconds <= 0) return FRIENDLY;
  const rounded = Math.max(1, Math.ceil(seconds));
  if (rounded < 60) {
    return `Too many AI requests right now. Please try again in about ${rounded} second${rounded === 1 ? "" : "s"}.`;
  }
  const minutes = Math.max(1, Math.ceil(rounded / 60));
  return `Too many AI requests right now. Please try again in about ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}
