import { RateLimiter, type ActionCtx, type MutationCtx } from "@convex-dev/rate-limiter";
import type { ComponentApi } from "@convex-dev/rate-limiter/_generated/component.js";
import { components } from "./_generated/api";
import {
  RATE_LIMITS,
  limitKeyForBucket,
  type BucketName,
  type ConsumeResult,
} from "./rateLimitConfig";

export type { ConsumeResult };

type LimitCtx = MutationCtx | ActionCtx;

/**
 * The generated `components` object is a proxy until `npx convex dev` regenerates
 * it. Reading `rateLimiter` is safe either way: a missing component throws inside
 * `limit`, and {@link consumeOrFailOpen} allows the request.
 */
const rateLimiter = new RateLimiter(
  (components as unknown as { rateLimiter: ComponentApi }).rateLimiter,
  RATE_LIMITS,
);

export async function consumeOrFailOpen(
  ctx: LimitCtx,
  bucket: BucketName,
  key: string,
): Promise<ConsumeResult> {
  const limitKey = limitKeyForBucket(bucket, key);
  if (!limitKey) {
    console.warn(`Rate limit key missing; blocking ${bucket} request.`);
    return { ok: false, retryAfter: 60_000 };
  }

  try {
    const status = await rateLimiter.limit(ctx, bucket, {
      key: limitKey,
      throws: false,
    });
    return {
      ok: status.ok,
      retryAfter: status.retryAfter ?? 0,
    };
  } catch (error) {
    const name = error instanceof Error ? error.name : "Error";
    console.warn(`Rate limiter unavailable; allowing ${bucket} request (${name}).`);
    return { ok: true, retryAfter: 0, failOpen: true };
  }
}
