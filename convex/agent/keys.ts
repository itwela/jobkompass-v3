import { v } from "convex/values";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "../_generated/server";
import { api, internal } from "../_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { QueryCtx, MutationCtx } from "../_generated/server";

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function newPlaintextKey(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return (
    "jk_sk_" +
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}

const SAVE_NOTE =
  "Save this key now. It is not stored in plaintext and cannot be shown again.";

/**
 * Resolve the signed-in user to the same id the rest of the app writes rows with
 * (users.convex_user_id, falling back to the auth id). Agent fns query by that id,
 * so a key minted here must carry it or `jk jobs list` would come back empty.
 */
async function currentConvexUserId(ctx: QueryCtx | MutationCtx): Promise<string | null> {
  const userId = await getAuthUserId(ctx);
  if (!userId) return null;
  const user = await ctx.db.get(userId);
  if (!user) return null;
  return (user as any).convex_user_id || userId;
}

/**
 * INTERNAL. Generate an API key for an arbitrary user — admin/backfill path only,
 * reachable via `npx convex run`. User-facing generation goes through `generateMine`,
 * which takes no userId and derives it from the session.
 */
export const generate = internalAction({
  args: { userId: v.string(), name: v.string() },
  handler: async (ctx, { userId, name }): Promise<{ key: string; note: string }> => {
    const key = newPlaintextKey();
    const keyHash = await sha256Hex(key);
    await ctx.runMutation(internal.agent.keys.insert, { userId, name, keyHash });
    return { key, note: SAVE_NOTE };
  },
});

/**
 * Generate a CLI key for the signed-in user. Returns the plaintext key ONCE —
 * only its SHA-256 hash is stored, so it can never be shown again.
 *
 * An action, not a mutation, because hashing needs Web Crypto (`crypto.subtle`),
 * which is only guaranteed in the action runtime — same reason `generate` is one.
 */
export const generateMine = action({
  args: { name: v.optional(v.string()) },
  handler: async (ctx, { name }): Promise<{ key: string; note: string }> => {
    const userId: string | null = await ctx.runQuery(api.auth.getConvexUserId, {});
    if (!userId) throw new Error("Not authenticated");

    const key = newPlaintextKey();
    const keyHash = await sha256Hex(key);
    await ctx.runMutation(internal.agent.keys.insert, {
      userId,
      name: name?.trim() || "cli",
      keyHash,
    });
    return { key, note: SAVE_NOTE };
  },
});

/** List the signed-in user's active CLI keys (never includes the hash). */
export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await currentConvexUserId(ctx);
    if (!userId) return [];
    const rows = await ctx.db
      .query("agentApiKeys")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return rows
      .filter((row) => row.revokedAt === undefined)
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(({ keyHash: _hash, ...rest }) => rest);
  },
});

/** Revoke one of the signed-in user's CLI keys. */
export const revokeMine = mutation({
  args: { id: v.id("agentApiKeys") },
  handler: async (ctx, { id }) => {
    const userId = await currentConvexUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const row = await ctx.db.get(id);
    if (!row || row.userId !== userId) throw new Error("Key not found");
    await ctx.db.patch(id, { revokedAt: Date.now() });
    return { success: true };
  },
});

export const insert = internalMutation({
  args: { userId: v.string(), name: v.string(), keyHash: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.insert("agentApiKeys", { ...args, createdAt: Date.now() });
  },
});

export const lookupByHash = internalQuery({
  args: { keyHash: v.string() },
  handler: async (ctx, { keyHash }) => {
    const row = await ctx.db
      .query("agentApiKeys")
      .withIndex("by_hash", (q) => q.eq("keyHash", keyHash))
      .first();
    if (!row || row.revokedAt !== undefined) return null;
    return { userId: row.userId, keyId: row._id };
  },
});

export const markUsed = internalMutation({
  args: { id: v.id("agentApiKeys") },
  handler: async (ctx, { id }) => {
    await ctx.db.patch(id, { lastUsedAt: Date.now() });
  },
});

/** INTERNAL. Admin listing for any user; the user-facing one is `listMine`. */
export const list = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const rows = await ctx.db
      .query("agentApiKeys")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return rows.map(({ keyHash: _hash, ...rest }) => rest);
  },
});

/** INTERNAL. Admin revoke for any user; the user-facing one is `revokeMine`. */
export const revoke = internalMutation({
  args: { userId: v.string(), id: v.id("agentApiKeys") },
  handler: async (ctx, { userId, id }) => {
    const row = await ctx.db.get(id);
    if (!row || row.userId !== userId) throw new Error("Key not found");
    await ctx.db.patch(id, { revokedAt: Date.now() });
  },
});
