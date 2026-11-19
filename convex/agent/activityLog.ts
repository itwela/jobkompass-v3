/**
 * Agent activity log: pure helpers (identity, redaction, action naming, aggregation).
 * No Convex imports so it is unit-testable; fns.ts and dispatch.ts do the I/O.
 */

export const UNKNOWN = "unknown";
export const SUMMARY_MAX = 280;
export const TARGET_MAX = 200;
export const IDENTITY_MAX = 120;
export const SUMMARY_SCAN_CAP = 5000;

export type AgentIdentity = {
  agentName: string;
  agentId: string;
  model: string;
  provider: string;
};

export const IDENTITY_HEADERS: Record<keyof AgentIdentity, string> = {
  agentName: "X-Agent-Name",
  agentId: "X-Agent-Id",
  model: "X-Agent-Model",
  provider: "X-Agent-Provider",
};

/**
 * Fields that must never be stored. POST /agent/activity rejects a request carrying any of them
 * (send bodyHash instead of a body).
 */
export const FORBIDDEN_FIELDS = ["body", "content", "token", "password", "apikey", "api_key", "secret", "message", "text"];

const REDACTED = "[redacted]";

const SECRET_PATTERNS: RegExp[] = [
  /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi,
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, // JWT
  /\b(?:sk|pk|rk)[-_](?:live_|test_|ant-|proj-)?[A-Za-z0-9_-]{8,}/g, // OpenAI / Anthropic / Stripe style
  /\b(?:ghp|gho|ghu|ghs|github_pat)_[A-Za-z0-9_]{10,}/g,
  /\bxox[abposr]-[A-Za-z0-9-]{8,}/g, // Slack
  /\bAKIA[0-9A-Z]{16}\b/g, // AWS access key id
  /\bAIza[0-9A-Za-z_-]{20,}/g, // Google API key
  /\b((?:api[_-]?key|access[_-]?token|refresh[_-]?token|token|secret|password|passwd|pwd|auth)\s*[:=]\s*)("[^"]*"|'[^']*'|\S+)/gi,
  /\b[0-9a-fA-F]{32,}\b/g, // long hex
  /[A-Za-z0-9+/_-]{40,}={0,2}/g, // long base64-ish
];

/** Replace obvious secrets with [redacted]. */
export function scrubSecrets(text: string): string {
  let out = text;
  for (const re of SECRET_PATTERNS) {
    out = out.replace(re, (match, prefix?: unknown) =>
      typeof prefix === "string" && /[:=]\s*$/.test(prefix) ? `${prefix}${REDACTED}` : REDACTED
    );
  }
  return out;
}

export function truncate(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max - 1) + "…";
}

/** Scrub, collapse whitespace, truncate. Empty -> undefined. */
export function clean(text: unknown, max: number): string | undefined {
  if (typeof text !== "string") return undefined;
  const out = truncate(scrubSecrets(text).replace(/\s+/g, " ").trim(), max);
  return out ? out : undefined;
}

/** Identity exactly as sent; anything missing or blank is "unknown". Never inferred. */
export function identityFromHeaders(headers: { get(name: string): string | null }): AgentIdentity {
  const read = (name: string) => clean(headers.get(name) ?? undefined, IDENTITY_MAX) ?? UNKNOWN;
  return {
    agentName: read(IDENTITY_HEADERS.agentName),
    agentId: read(IDENTITY_HEADERS.agentId),
    model: read(IDENTITY_HEADERS.model),
    provider: read(IDENTITY_HEADERS.provider),
  };
}

/** Keys of a raw request body that are forbidden (case-insensitive). */
export function forbiddenFields(raw: Record<string, unknown>): string[] {
  return Object.keys(raw).filter((k) => FORBIDDEN_FIELDS.includes(k.toLowerCase()));
}

export const ACTIVITY_PATH = "/agent/activity";

/** Every non-GET agent route is a write and is logged, except the activity log itself. */
export function shouldAutoLog(route: { method: string; path: string }): boolean {
  return route.method !== "GET" && !route.path.startsWith(ACTIVITY_PATH);
}

/** "POST /agent/resumes/generate" -> "resumes.generate"; "PATCH /agent/jobs" -> "jobs.update". */
export function actionTypeFor(route: { method: string; path: string }): string {
  const parts = route.path.replace(/^\/agent\//, "").split("/").filter(Boolean);
  const noun = parts[0] ?? "agent";
  if (parts.length > 1) return `${noun}.${parts.slice(1).join(".")}`;
  const verb = route.method === "POST" ? "create" : route.method === "PATCH" ? "update" : route.method === "DELETE" ? "delete" : "read";
  return `${noun}.${verb}`;
}

/** The document/job/folder an automatic row is about: id, base, jobId, folder from args, else id from the result. */
export function pickTarget(args: Record<string, unknown>, result: unknown): string | undefined {
  for (const key of ["id", "base", "jobId", "folder"]) {
    const v = args[key];
    if (typeof v === "string" && v) return clean(v, TARGET_MAX);
  }
  for (const key of ["resumeIds", "coverLetterIds"]) {
    const v = args[key];
    if (Array.isArray(v) && v.length) return clean(v.join(","), TARGET_MAX);
  }
  if (result && typeof result === "object" && typeof (result as { id?: unknown }).id === "string") {
    return clean((result as { id: string }).id, TARGET_MAX);
  }
  if (typeof result === "string") return clean(result, TARGET_MAX);
  return undefined;
}

export const ACTION_TYPE_RE = /^[a-z0-9][a-z0-9_.-]{0,63}$/;
export const BODY_HASH_RE = /^[0-9a-f]{64}$/;

export type ActivityStatus = "success" | "error";

export type ActivityInput = {
  actionType: string;
  summary: string;
  target?: string;
  status?: string;
  errorMessage?: string;
  latencyMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
  bodyHash?: string;
};

export type ActivityRow = AgentIdentity & {
  actionType: string;
  source: "api" | "external";
  route?: string;
  target?: string;
  summary: string;
  status: ActivityStatus;
  errorMessage?: string;
  latencyMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
  bodyHash?: string;
};

export const INVALID_ACTIVITY = "Invalid activity: ";

function nonNegative(name: string, v: number | undefined, integer: boolean): number | undefined {
  if (v === undefined) return undefined;
  if (!Number.isFinite(v) || v < 0 || (integer && !Number.isInteger(v))) {
    throw new Error(`${INVALID_ACTIVITY}${name} must be a non-negative ${integer ? "integer" : "number"}`);
  }
  return v;
}

/** Validate + redact an externally reported action. Throws INVALID_ACTIVITY errors. */
export function sanitizeExternal(identity: AgentIdentity, input: ActivityInput): ActivityRow {
  const actionType = input.actionType.trim().toLowerCase();
  if (!ACTION_TYPE_RE.test(actionType)) {
    throw new Error(`${INVALID_ACTIVITY}actionType must be 1-64 chars of a-z, 0-9, _ . - (e.g. email_sent)`);
  }
  const status = (input.status ?? "success") as ActivityStatus;
  if (status !== "success" && status !== "error") throw new Error(`${INVALID_ACTIVITY}status must be success or error`);
  const summary = clean(input.summary, SUMMARY_MAX);
  if (!summary) throw new Error(`${INVALID_ACTIVITY}summary is required`);
  let bodyHash: string | undefined;
  if (input.bodyHash !== undefined) {
    bodyHash = input.bodyHash.trim().toLowerCase();
    if (!BODY_HASH_RE.test(bodyHash)) throw new Error(`${INVALID_ACTIVITY}bodyHash must be a sha256 hex digest (64 hex chars)`);
  }
  return {
    ...identity,
    actionType,
    source: "external",
    target: clean(input.target, TARGET_MAX),
    summary,
    status,
    errorMessage: status === "error" ? clean(input.errorMessage, SUMMARY_MAX) : undefined,
    latencyMs: nonNegative("latencyMs", input.latencyMs, false),
    inputTokens: nonNegative("inputTokens", input.inputTokens, true),
    outputTokens: nonNegative("outputTokens", input.outputTokens, true),
    costUsd: nonNegative("costUsd", input.costUsd, false),
    bodyHash,
  };
}

/** Build the row for an automatic (API route) log. */
export function automaticRow(
  identity: AgentIdentity,
  route: { method: string; path: string; description: string },
  args: Record<string, unknown>,
  outcome: { result?: unknown; error?: string; latencyMs: number }
): ActivityRow {
  return {
    ...identity,
    actionType: actionTypeFor(route),
    source: "api",
    route: `${route.method} ${route.path}`,
    target: pickTarget(args, outcome.result),
    summary: clean(route.description, SUMMARY_MAX) ?? `${route.method} ${route.path}`,
    status: outcome.error === undefined ? "success" : "error",
    errorMessage: outcome.error === undefined ? undefined : clean(outcome.error, SUMMARY_MAX) ?? "error",
    latencyMs: Math.max(0, Math.round(outcome.latencyMs)),
  };
}

/** Drop undefined fields (Convex args must not carry them). */
export function withoutUndefined<T extends Record<string, unknown>>(row: T): T {
  return Object.fromEntries(Object.entries(row).filter(([, v]) => v !== undefined)) as T;
}

/** Run a log write; never throws, so logging can never fail a request. */
export async function recordSafely(write: () => Promise<unknown>): Promise<void> {
  try {
    await write();
  } catch (err) {
    console.error("agent activity log write failed:", err instanceof Error ? err.message : err);
  }
}

/** "2026-11-01", ms epoch or ISO datetime -> ms. Throws INVALID_ACTIVITY on garbage. */
export function parseTime(name: string, raw: string | undefined): number | undefined {
  if (raw === undefined || raw === "") return undefined;
  const n = /^\d+$/.test(raw) ? Number(raw) : Date.parse(raw);
  if (!Number.isFinite(n)) throw new Error(`${INVALID_ACTIVITY}${name} must be an ISO date or epoch ms, got '${raw}'`);
  return n;
}

export type SummaryGroup = {
  count: number;
  success: number;
  error: number;
  successRate: number;
  avgLatencyMs: number | null;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  /** Rows that reported token counts / a cost. 0 means "not reported", not "free". */
  tokenRows: number;
  costRows: number;
};

type Acc = { count: number; success: number; error: number; latSum: number; latN: number; inTok: number; outTok: number; cost: number; tokN: number; costN: number };

function finish(a: Acc): SummaryGroup {
  return {
    count: a.count,
    success: a.success,
    error: a.error,
    successRate: a.count ? Math.round((a.success / a.count) * 1000) / 1000 : 0,
    avgLatencyMs: a.latN ? Math.round(a.latSum / a.latN) : null,
    inputTokens: a.inTok,
    outputTokens: a.outTok,
    costUsd: Math.round(a.cost * 1e6) / 1e6,
    tokenRows: a.tokN,
    costRows: a.costN,
  };
}

export type SummaryRow = Pick<ActivityRow, "model" | "provider" | "actionType" | "status" | "latencyMs" | "inputTokens" | "outputTokens" | "costUsd"> & {
  agentName?: string;
};

/** One accumulator per key; the shared aggregation behind every summary. */
export function aggregate<K extends Record<string, string>>(rows: SummaryRow[], keyOf: (r: SummaryRow) => K): (K & SummaryGroup)[] {
  const groups = new Map<string, { keys: K; acc: Acc }>();
  for (const r of rows) {
    const keys = keyOf(r);
    const id = Object.values(keys).join("\u0000");
    let g = groups.get(id);
    if (!g) {
      g = { keys, acc: { count: 0, success: 0, error: 0, latSum: 0, latN: 0, inTok: 0, outTok: 0, cost: 0, tokN: 0, costN: 0 } };
      groups.set(id, g);
    }
    const a = g.acc;
    a.count++;
    if (r.status === "success") a.success++;
    else a.error++;
    if (typeof r.latencyMs === "number") {
      a.latSum += r.latencyMs;
      a.latN++;
    }
    if (typeof r.inputTokens === "number" || typeof r.outputTokens === "number") a.tokN++;
    a.inTok += r.inputTokens ?? 0;
    a.outTok += r.outputTokens ?? 0;
    if (typeof r.costUsd === "number") a.costN++;
    a.cost += r.costUsd ?? 0;
  }
  return [...groups.values()].map((g) => ({ ...g.keys, ...finish(g.acc) })).sort((a, b) => b.count - a.count);
}

/** Counts, success rate and avg latency by model, by action type, and by model x action type. */
export function summarize(rows: SummaryRow[], truncated = false) {
  return {
    total: rows.length,
    truncated,
    byModel: aggregate(rows, (r) => ({ model: r.model, provider: r.provider })),
    byActionType: aggregate(rows, (r) => ({ actionType: r.actionType })),
    byModelAndAction: aggregate(rows, (r) => ({ model: r.model, actionType: r.actionType })),
  };
}

// ---- in-app Agent activity page (convex/agent/activity.ts) ----

export type ActivityFilter = { agent?: string; model?: string; actionType?: string; status?: string };

/** Same equality filters the HTTP list applies, for rows already in memory. */
export function matchesFilter(r: { agentName: string; model: string; actionType: string; status: string }, f: ActivityFilter): boolean {
  return (
    (!f.agent || r.agentName === f.agent) &&
    (!f.model || r.model === f.model) &&
    (!f.actionType || r.actionType === f.actionType) &&
    (!f.status || r.status === f.status)
  );
}

/**
 * Per action type, the model with the highest success rate on it. Ties go to the model with more
 * runs, then to name order, so the pick is stable. Only models that actually ran the action count.
 */
export function bestModelByAction(rows: SummaryRow[]): Record<string, { model: string; successRate: number; count: number }> {
  const out: Record<string, { model: string; successRate: number; count: number }> = {};
  for (const g of aggregate(rows, (r) => ({ actionType: r.actionType, model: r.model }))) {
    const cur = out[g.actionType];
    const better =
      !cur ||
      g.successRate > cur.successRate ||
      (g.successRate === cur.successRate && (g.count > cur.count || (g.count === cur.count && g.model < cur.model)));
    if (better) out[g.actionType] = { model: g.model, successRate: g.successRate, count: g.count };
  }
  return out;
}

/** Per agent: the shared numbers plus the model it ran most often. */
export function summarizeAgents(rows: SummaryRow[]) {
  const usual: Record<string, string> = {};
  const byPair = aggregate(rows, (r) => ({ agentName: r.agentName ?? UNKNOWN, model: r.model }));
  // byPair is sorted by count desc, so the first model seen per agent is the usual one.
  for (const g of byPair) if (!(g.agentName in usual)) usual[g.agentName] = g.model;
  return aggregate(rows, (r) => ({ agentName: r.agentName ?? UNKNOWN })).map((g) => ({ ...g, usualModel: usual[g.agentName] }));
}

/** Everything the Agent activity page shows above the feed, from one scan of the user's rows. */
export function activityOverview(rows: (SummaryRow & { agentName: string; timestamp: number })[], opts: { todayStart: number; truncated?: boolean }) {
  const totals = aggregate(rows, () => ({}))[0] ?? null;
  const best = bestModelByAction(rows);
  return {
    ...summarize(rows, opts.truncated ?? false),
    totals,
    today: rows.filter((r) => r.timestamp >= opts.todayStart).length,
    byAgent: summarizeAgents(rows),
    byActionType: aggregate(rows, (r) => ({ actionType: r.actionType })).map((g) => ({ ...g, best: best[g.actionType] ?? null })),
  };
}

/** The distinct values a filter menu can offer, most used first. */
export function filterOptions(rows: { agentName: string; model: string; actionType: string }[]) {
  const ranked = (pick: (r: (typeof rows)[number]) => string) => {
    const n = new Map<string, number>();
    for (const r of rows) n.set(pick(r), (n.get(pick(r)) ?? 0) + 1);
    return [...n.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([k]) => k);
  };
  return { agents: ranked((r) => r.agentName), models: ranked((r) => r.model), actionTypes: ranked((r) => r.actionType) };
}
