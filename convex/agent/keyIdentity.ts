/**
 * Agent-scoped CLI keys: pure rules (no Convex imports, unit-tested in keys.test.ts).
 * A key may carry an identity (agent name, id, model, provider). When it does, activity made with
 * that key is named by the key, never by what the request says about itself.
 */
import { IDENTITY_MAX, clean, type AgentIdentity } from "./activityLog";

export type KeyIdentity = Partial<AgentIdentity>;

export const KEY_IDENTITY_FIELDS = ["agentName", "agentId", "model", "provider"] as const;

/** Error prefixes dispatch.ts maps to HTTP statuses. */
export const KEY_FORBIDDEN = "Key not allowed: ";
export const KEY_NOT_FOUND = "Key not found";

/** Trim, scrub and cap each field; blank fields are dropped. */
export function cleanKeyIdentity(raw: { [K in keyof AgentIdentity]?: unknown }): KeyIdentity {
  const out: KeyIdentity = {};
  for (const f of KEY_IDENTITY_FIELDS) {
    const v = clean(raw[f], IDENTITY_MAX);
    if (v) out[f] = v;
  }
  return out;
}

/** A key is scoped when it sets at least one identity field. */
export function isScoped(identity: KeyIdentity | null | undefined): boolean {
  return !!identity && KEY_IDENTITY_FIELDS.some((f) => !!identity[f]);
}

/** The identity stored on a key row, or null for a legacy key. */
export function keyIdentityOf(row: KeyIdentity): KeyIdentity | null {
  const id = cleanKeyIdentity(row);
  return isScoped(id) ? id : null;
}

/**
 * Patch for keys.updateMine: every field is written, so a blank field clears it
 * (Convex removes a field patched with undefined).
 */
export function identityPatch(raw: { [K in keyof AgentIdentity]?: unknown }): { [K in keyof AgentIdentity]: string | undefined } {
  const id = cleanKeyIdentity(raw);
  return { agentName: id.agentName, agentId: id.agentId, model: id.model, provider: id.provider };
}

/** A scoped key cannot create keys, so a leaked agent key cannot mint more. */
export function assertCanMintKeys(caller: { scoped: boolean }): void {
  if (caller.scoped) {
    throw new Error(
      `${KEY_FORBIDDEN}a key tied to an agent cannot create keys. Create one in JobKompass under Settings -> CLI keys, or use a key with no identity.`
    );
  }
}

/** Revoke rules: own keys only; the calling key only with self=true. */
export function assertCanRevoke(row: { userId: string; revokedAt?: number } | null, userId: string, opts: { id: string; callerKeyId: string; self?: boolean }): void {
  if (!row || row.userId !== userId || row.revokedAt !== undefined) throw new Error(`${KEY_NOT_FOUND}: '${opts.id}' not found`);
  if (opts.id === opts.callerKeyId && !opts.self) {
    throw new Error(`${KEY_FORBIDDEN}this is the key making the call. Pass self=true (jk keys revoke --self) to revoke it anyway.`);
  }
}

/** What GET /agent/keys returns per key. Never the hash or the key itself. */
export function keyOut(row: {
  _id: string;
  name: string;
  createdAt: number;
  lastUsedAt?: number;
} & KeyIdentity) {
  const identity = keyIdentityOf(row);
  return {
    id: row._id,
    name: row.name,
    scoped: identity !== null,
    identity,
    createdAt: row.createdAt,
    ...(row.lastUsedAt !== undefined ? { lastUsedAt: row.lastUsedAt } : {}),
  };
}
