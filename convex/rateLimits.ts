import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation } from "./_generated/server";
import { consumeOrFailOpen, type ConsumeResult } from "./rateLimit";
import { resolvePublicConsume } from "./rateLimitConfig";

/**
 * Next.js AI routes call this before they touch a model.
 * The user id comes from the auth token. The anonymous key is an IP hash
 * minted by the Next server, never a raw IP and never a client-supplied user id.
 */
export const consume = mutation({
  args: {
    bucket: v.union(v.literal("ai"), v.literal("freeResume")),
    anonymousKey: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<ConsumeResult> => {
    const userId = await getAuthUserId(ctx);
    const resolved = resolvePublicConsume({
      bucket: args.bucket,
      userId: userId ? String(userId) : null,
      anonymousKey: args.anonymousKey,
    });
    return await consumeOrFailOpen(ctx, resolved.bucket, resolved.key);
  },
});
