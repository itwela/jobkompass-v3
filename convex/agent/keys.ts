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
import type { ActionCtx, QueryCtx, MutationCtx } from "../_generated/server";
import {
  KEY_NOT_FOUND,
  assertCanMintKeys,
  assertCanRevoke,
  cleanKeyIdentity,
  identityPatch,
  isScoped,
  keyIdentityOf,
  keyOut,
  type KeyIdentity,
} from "./keyIdentity";

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
export async function currentConvexUserId(ctx: QueryCtx | MutationCtx): Promise<string | null> {
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
const identityArgs = {
  agentName: v.optional(v.string()),
  agentId: v.optional(v.string()),
  model: v.optional(v.string()),
  provider: v.optional(v.string()),
};

/** Mint, hash and store a key. The plaintext is returned once and never stored or logged. */
async function mintKey(
  ctx: ActionCtx,
  userId: string,
  name: string | undefined,
  raw: KeyIdentity
): Promise<{ id: string; key: string; name: string; identity: KeyIdentity | null; note: string }> {
  const key = newPlaintextKey();
  const keyHash = await sha256Hex(key);
  const identity = cleanKeyIdentity(raw);
  const cleanName = name?.trim() || "cli";
  const id: string = await ctx.runMutation(internal.agent.keys.insert, { userId, name: cleanName, keyHash, ...identity });
  return { id, key, name: cleanName, identity: isScoped(identity) ? identity : null, note: SAVE_NOTE };
}

/**
 * Generate a CLI key for the signed-in user, optionally tied to an agent (identity fields).
 * Returns the plaintext key ONCE; only its SHA-256 hash is stored, so it can never be shown again.
 *
 * An action, not a mutation, because hashing needs Web Crypto (`crypto.subtle`),
 * which is only guaranteed in the action runtime — same reason `generate` is one.
 */
export const generateMine = action({
  args: { name: v.optional(v.string()), ...identityArgs },
  handler: async (ctx, { name, ...identity }): Promise<{ id: string; key: string; name: string; identity: KeyIdentity | null; note: string }> => {
    const userId: string | null = await ctx.runQuery(api.auth.getConvexUserId, {});
    if (!userId) throw new Error("Not authenticated");
    return mintKey(ctx, userId, name, identity);
  },
});

/**
 * Set or clear the identity on one of the signed-in user's keys. A blank field clears it.
 * Past activity keeps the identity it was logged with.
 */
export const setIdentityMine = mutation({
  args: { id: v.id("agentApiKeys"), ...identityArgs },
  handler: async (ctx, { id, ...identity }) => {
    const userId = await currentConvexUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const row = await ctx.db.get(id);
    if (!row || row.userId !== userId || row.revokedAt !== undefined) throw new Error(KEY_NOT_FOUND);
    const patch = identityPatch(identity);
    await ctx.db.patch(id, patch);
    return { success: true, scoped: isScoped(patch) };
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
  args: { userId: v.string(), name: v.string(), keyHash: v.string(), ...identityArgs },
  handler: async (ctx, args) => {
    return await ctx.db.insert("agentApiKeys", { ...args, createdAt: Date.now() });
  },
});

/** The key behind a Bearer token: owner, id, name, and the identity it carries (null = legacy key). */
export const lookupByHash = internalQuery({
  args: { keyHash: v.string() },
  handler: async (ctx, { keyHash }) => {
    const row = await ctx.db
      .query("agentApiKeys")
      .withIndex("by_hash", (q) => q.eq("keyHash", keyHash))
      .first();
    if (!row || row.revokedAt !== undefined) return null;
    return { userId: row.userId, keyId: row._id, keyName: row.name, identity: keyIdentityOf(row) };
  },
});

// ---- Agent API: /agent/keys (jk keys create|list|revoke) ----

const callerKeyArg = v.object({ id: v.string(), scoped: v.boolean() });

/** POST /agent/keys. Refused for a scoped key, so a leaked agent key cannot mint more. */
export const createFromAgent = internalAction({
  args: { userId: v.string(), callerKey: callerKeyArg, name: v.optional(v.string()), ...identityArgs },
  handler: async (ctx, { userId, callerKey, name, ...identity }) => {
    assertCanMintKeys(callerKey);
    return mintKey(ctx, userId, name, identity);
  },
});

/** GET /agent/keys: the caller's active keys. Never the hash or the key. */
export const listFromAgent = internalQuery({
  args: { userId: v.string(), callerKey: callerKeyArg },
  handler: async (ctx, { userId, callerKey }) => {
    const rows = await ctx.db
      .query("agentApiKeys")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return rows
      .filter((r) => r.revokedAt === undefined)
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((r) => ({ ...keyOut(r), current: r._id === callerKey.id }));
  },
});

/** DELETE /agent/keys: revoke one of the caller's keys; the calling key only with self=true. */
export const revokeFromAgent = internalMutation({
  args: { userId: v.string(), callerKey: callerKeyArg, id: v.string(), self: v.optional(v.boolean()) },
  handler: async (ctx, { userId, callerKey, id, self }) => {
    const keyId = ctx.db.normalizeId("agentApiKeys", id);
    const row = keyId ? await ctx.db.get(keyId) : null;
    assertCanRevoke(row, userId, { id, callerKeyId: callerKey.id, self });
    await ctx.db.patch(keyId!, { revokedAt: Date.now() });
    return { id, revoked: true };
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
