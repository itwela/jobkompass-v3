/**
 * Agent identity labels for the Agent activity page and Settings > CLI keys (D30-D36, M28-M30).
 * Pure, so they are unit-tested (identity.test.ts). Every row is an agent; this only says which
 * one and how we know.
 */

export const UNKNOWN_AGENT = "unknown";

export type IdentityRow = {
  agentName: string;
  identitySource?: "key" | "header" | "profile" | "none";
  keyId?: string;
  keyName?: string;
  /** Whether the key the row was made with carries an identity now. */
  keyScoped?: boolean;
};

export type KeyIdentity = { agentName?: string; agentId?: string; model?: string; provider?: string };

export const isUnknownAgent = (name: string | null | undefined) => !name || name === UNKNOWN_AGENT;

/** "unknown" reads as "Unknown" wherever an agent is named (feed, By agent, filters). */
export const agentDisplayName = (name: string | null | undefined) => (isUnknownAgent(name) ? "Unknown" : name!);

/** The quiet line under the agent's name: `via key "laptop"`, `self-reported` or `unknown agent`. */
export function identityNote(r: IdentityRow): string {
  if (r.identitySource === "key") return r.keyName ? `via key "${r.keyName}"` : "via key";
  if (r.identitySource === "header" || r.identitySource === "profile") return "self-reported";
  // Rows from before identity sources: a named agent was sent in headers.
  if (r.identitySource === "none" || isUnknownAgent(r.agentName)) return "unknown agent";
  return "self-reported";
}

/** Details panel, KEY NAME row. */
export function keyNameLabel(r: IdentityRow): string {
  if (!r.keyId) return "Not recorded";
  if (!r.keyName) return "Revoked key";
  return r.keyScoped ? r.keyName : "Legacy key, no identity";
}

/** Details panel, IDENTITY row. */
export function identitySourceLabel(r: IdentityRow): string {
  if (r.identitySource === "key") return r.keyName ? `From key "${r.keyName}"` : "From the key";
  if (r.identitySource === "header") return "Self-reported (X-Agent headers)";
  if (r.identitySource === "profile") return "Self-reported (jk profile)";
  if (r.identitySource === "none" || isUnknownAgent(r.agentName)) return "Unknown agent, nothing sent";
  return "Self-reported (X-Agent headers)";
}

/** "Scope this key": the row's key still exists and carries no identity. */
export const canScopeKey = (r: IdentityRow) => !!r.keyId && !!r.keyName && r.keyScoped === false;

/** True when every agent in the summary is unknown: the page suggests scoped keys. */
export const allUnknown = (agents: { agentName: string }[]) => agents.length > 0 && agents.every((a) => isUnknownAgent(a.agentName));

export const hasIdentity = (k: KeyIdentity | null | undefined) => !!k && !!(k.agentName || k.agentId || k.model || k.provider);

/** Chip text after the name: "claude-opus-5-5 · anthropic" (phones drop the provider). */
export function identityTail(k: KeyIdentity, opts: { provider?: boolean } = {}): string[] {
  return [k.model, opts.provider === false ? undefined : k.provider].filter((x): x is string => !!x);
}

/** "jk_sk_" followed by dots: the key is copied, not shown (D35). */
export function maskKey(key: string): string {
  const prefix = key.match(/^[a-z]+_[a-z]+_/i)?.[0] ?? key.slice(0, 3);
  return prefix + "•".repeat(32);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "created Nov 3". */
export function fmtKeyCreated(ms: number): string {
  const d = new Date(ms);
  return `created ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/** "used 4 min ago", "used 1h ago", "used yesterday", "used Sep 14", "never used". */
export function fmtKeyUsed(ms: number | undefined, now: number = Date.now()): string {
  if (!ms) return "never used";
  const mins = Math.max(0, Math.floor((now - ms) / 60_000));
  if (mins < 1) return "used just now";
  if (mins < 60) return `used ${mins} min ago`;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  if (ms >= today.getTime()) return `used ${Math.floor(mins / 60)}h ago`;
  if (ms >= today.getTime() - 86_400_000) return "used yesterday";
  const d = new Date(ms);
  return `used ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}
