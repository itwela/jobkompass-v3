import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import {
  retryAfterSeconds,
  type ClientBucket,
  type ConsumeResult,
} from "../../convex/rateLimitConfig";
import { anonymousKeyFromHeaders } from "./anonymousKey";

const consumeRef = makeFunctionReference<
  "mutation",
  { bucket: ClientBucket; anonymousKey: string },
  ConsumeResult
>("rateLimits:consume");

/**
 * Returns a 429 response when the caller is over the limit.
 * Returns null when the request may proceed, including when the Convex
 * function or component is not deployed yet.
 */
export async function enforceAiRateLimit(
  request: NextRequest,
  bucket: ClientBucket,
): Promise<NextResponse | null> {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL;
  if (!convexUrl) {
    console.warn("Rate limiter unavailable; allowing request (no Convex URL).");
    return null;
  }

  try {
    const client = new ConvexHttpClient(convexUrl);
    const token = await convexAuthNextjsToken().catch(() => null);
    if (token) client.setAuth(token);
    else client.clearAuth();

    const result = await client.mutation(consumeRef, {
      bucket,
      anonymousKey: anonymousKeyFromHeaders(request.headers),
    });
    if (result?.ok !== false) return null;

    const seconds = retryAfterSeconds(result.retryAfter);
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(seconds),
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    const name = error instanceof Error ? error.name : "Error";
    console.warn(`Rate limiter unavailable; allowing request (${name}).`);
    return null;
  }
}
