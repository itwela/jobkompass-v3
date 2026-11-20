function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function renderPretty(data: unknown): string {
  if (data === null || data === undefined) return "(none)";
  if (Array.isArray(data)) {
    if (data.length === 0) return "(none)";
    if (typeof data[0] !== "object" || data[0] === null) return data.map(cell).join("\n");
    const rows = data as Record<string, unknown>[];
    const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
    const widths = cols.map((c) => Math.max(c.length, ...rows.map((r) => cell(r[c]).length)));
    const line = (vals: string[]) => vals.map((v, i) => v.padEnd(widths[i])).join("  ");
    return [line(cols), ...rows.map((r) => line(cols.map((c) => cell(r[c]))))].join("\n");
  }
  if (typeof data === "object") {
    return Object.entries(data as Record<string, unknown>)
      .map(([k, v]) => `${k}: ${cell(v)}`)
      .join("\n");
  }
  return String(data);
}

/**
 * What emit writes. Machine mode is the JSON as-is (a `notice` field stays in it). Pretty
 * mode puts a server `notice` (e.g. a template fallback) on its own line first so it is seen.
 */
type MoveShape = {
  dryRun: boolean;
  folder: { id: string; name: string };
  moved: { id: string; name: string }[];
  skipped: { id: string; name?: string; reason: string }[];
  alreadyInFolder: unknown[];
  counts: { moved: number; skipped: number; alreadyInFolder: number; total: number };
  hint?: string;
};

function isMoveResult(data: unknown): data is MoveShape {
  const d = data as Partial<MoveShape> | null;
  return Boolean(d && typeof d === "object" && typeof d.dryRun === "boolean" && d.counts && d.folder && Array.isArray(d.moved));
}

/** Pretty output for `jk resumes move` / `jk coverletters move`: a summary line, then the items. */
export function renderMove(r: MoveShape, itemNoun = "resume"): string {
  const verb = r.dryRun ? "DRY RUN: would move" : "Moved";
  const lines = [
    `${verb} ${r.counts.moved} of ${r.counts.total} ${itemNoun}(s) into '${r.folder.name}' (${r.folder.id}).`,
    `Already in folder: ${r.counts.alreadyInFolder}. Skipped: ${r.counts.skipped}.`,
  ];
  if (r.moved.length) lines.push("", ...r.moved.map((m) => `  ${m.id}  ${m.name}`));
  if (r.skipped.length) lines.push("", "Skipped:", ...r.skipped.map((s) => `  ${s.id}  ${s.name ?? ""}  (${s.reason})`));
  if (r.hint) lines.push("", r.hint);
  return lines.join("\n");
}

type ActivityPage = { items: Record<string, unknown>[]; cursor: string | null; isDone: boolean };

function isActivityPage(data: unknown): data is ActivityPage {
  const d = data as Partial<ActivityPage> | null;
  return Boolean(d && typeof d === "object" && Array.isArray(d.items) && typeof d.isDone === "boolean");
}

type Group = Record<string, unknown> & { count: number; successRate: number; avgLatencyMs: number | null };
type ActivitySummaryShape = { total: number; truncated: boolean; byModel: Group[]; byActionType: Group[]; byModelAndAction: Group[] };

function isActivitySummary(data: unknown): data is ActivitySummaryShape {
  const d = data as Partial<ActivitySummaryShape> | null;
  return Boolean(d && typeof d === "object" && typeof d.total === "number" && Array.isArray(d.byModel) && Array.isArray(d.byActionType));
}

/**
 * Where an activity row's agent name came from: `via key "laptop"` (the key names it),
 * `self-reported` (headers), or `unknown agent`. Rows from before scoped keys have no source.
 */
export function identityNote(r: { agentName?: unknown; identitySource?: unknown; keyName?: unknown }): string {
  if (r.identitySource === "key") return typeof r.keyName === "string" && r.keyName ? `via key "${r.keyName}"` : "via key";
  if (r.identitySource === "header" || r.identitySource === "profile") return "self-reported";
  if (r.identitySource === "none" || !r.agentName || r.agentName === "unknown") return "unknown agent";
  return "self-reported";
}

/** "Claude Code (via key "laptop")", "unknown agent". */
export function agentLabel(r: { agentName?: unknown; identitySource?: unknown; keyName?: unknown }): string {
  const note = identityNote(r);
  if (note === "unknown agent") return note;
  return `${String(r.agentName)} (${note})`;
}

type KeyRow = { id: string; name: string; scoped: boolean; identity: Record<string, string> | null; createdAt: number; lastUsedAt?: number; current?: boolean };

function isKeyList(data: unknown): data is KeyRow[] {
  return Array.isArray(data) && data.length > 0 && data.every((k) => k && typeof k === "object" && typeof k.id === "string" && typeof k.scoped === "boolean" && "identity" in k && typeof k.createdAt === "number");
}

const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Pretty `jk keys list`: one row per key; identity as "Agent · model · provider". */
export function renderKeys(keys: KeyRow[]): string {
  return renderPretty(
    keys.map((k) => ({
      id: k.id,
      name: k.current ? `${k.name} (this key)` : k.name,
      model: k.identity?.model ?? "no model",
      identity: k.identity ? [k.identity.agentName, k.identity.provider, k.identity.agentId].filter(Boolean).join(" · ") || "model only" : "none (agent reports its own)",
      created: day(k.createdAt),
      lastUsed: k.lastUsedAt ? day(k.lastUsedAt) : "never",
    }))
  );
}

/** The model as shown in tables: "unknown model" when none was recorded. */
export function modelLabel(model: unknown): string {
  return typeof model === "string" && model.trim() && model !== "unknown" ? model : "unknown model";
}

/** Pretty `jk activity list`: one row per action, then the next-page command. */
export function renderActivityPage(p: ActivityPage): string {
  const rows = p.items.map((r) => ({
    when: typeof r.timestamp === "number" ? new Date(r.timestamp).toISOString().replace("T", " ").slice(0, 19) : "",
    model: modelLabel(r.model),
    agent: agentLabel(r),
    action: r.actionType,
    status: r.status,
    ms: r.latencyMs,
    target: r.target,
    summary: r.summary,
  }));
  const lines = [renderPretty(rows)];
  if (!p.isDone && p.cursor) lines.push("", `More: jk activity list --cursor ${p.cursor}`);
  return lines.join("\n");
}

/** Pretty `jk activity summary`: totals, then a table per grouping. */
export function renderActivitySummary(s: ActivitySummaryShape): string {
  const pct = (g: Group) => ({
    ...Object.fromEntries(Object.entries(g).filter(([k]) => !["count", "success", "error", "successRate", "avgLatencyMs", "inputTokens", "outputTokens", "costUsd"].includes(k))),
    ...("model" in g ? { model: modelLabel(g.model) } : {}),
    count: g.count,
    success: `${Math.round(g.successRate * 1000) / 10}%`,
    avgMs: g.avgLatencyMs ?? "",
  });
  const lines = [`${s.total} action(s)${s.truncated ? " (truncated: narrow with --from/--to)" : ""}.`];
  lines.push("", "By model:", renderPretty(s.byModel.map(pct)));
  const unknown = s.byModel.find((g) => modelLabel(g.model) === "unknown model");
  if (unknown) lines.push("", `${unknown.count} action(s) have no model. Tie the key to a model: jk keys create --agent <name> --model <m> --provider <p>, or send --model / JK_AGENT_MODEL.`);
  lines.push("", "By action type:", renderPretty(s.byActionType.map(pct)));
  lines.push("", "By model and action type:", renderPretty(s.byModelAndAction.map(pct)));
  return lines.join("\n");
}

export function formatOutput(data: unknown, machine: boolean, itemNoun?: string): string {
  if (machine) return JSON.stringify(data, null, 2);
  if (isMoveResult(data)) return renderMove(data, itemNoun);
  if (isActivityPage(data)) return renderActivityPage(data);
  if (isActivitySummary(data)) return renderActivitySummary(data);
  if (isKeyList(data)) return renderKeys(data);
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const { notice, ...rest } = data as Record<string, unknown>;
    if (typeof notice === "string" && notice) return `Notice: ${notice}\n\n${renderPretty(rest)}`;
  }
  return renderPretty(data);
}

export function emit(data: unknown, opts: { json?: boolean; itemNoun?: string } = {}): void {
  const machine = Boolean(opts.json) || !process.stdout.isTTY;
  process.stdout.write(formatOutput(data, machine, opts.itemNoun) + "\n");
}
