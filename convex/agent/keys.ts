import { v } from "convex/values";
import { action, internalMutation, internalQuery, mutation, query } from "../_generated/server";
import { internal } from "../_generated/api";

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Generate an API key for a user. Prints the plaintext key ONCE; only the hash is stored. */
export const generate = action({
  args: { userId: v.string(), name: v.string() },
  handler: async (ctx, { userId, name }): Promise<{ key: string; note: string }> => {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    const key =
      "jk_sk_" +
      Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    const keyHash = await sha256Hex(key);
    await ctx.runMutation(internal.agent.keys.insert, { userId, name, keyHash });
    return { key, note: "Save this key now. It is not stored in plaintext and cannot be shown again." };
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

export const list = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const rows = await ctx.db
      .query("agentApiKeys")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return rows.map(({ keyHash: _hash, ...rest }) => rest);
  },
});

export const revoke = mutation({
  args: { userId: v.string(), id: v.id("agentApiKeys") },
  handler: async (ctx, { userId, id }) => {
    const row = await ctx.db.get(id);
    if (!row || row.userId !== userId) throw new Error("Key not found");
    await ctx.db.patch(id, { revokedAt: Date.now() });
  },
});
