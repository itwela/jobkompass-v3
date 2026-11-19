import { describe, expect, it, vi } from "vitest";
import {
  INVALID_ACTIVITY,
  SUMMARY_MAX,
  TARGET_MAX,
  actionTypeFor,
  automaticRow,
  clean,
  forbiddenFields,
  identityFromHeaders,
  parseTime,
  pickTarget,
  recordSafely,
  sanitizeExternal,
  scrubSecrets,
  shouldAutoLog,
  summarize,
  aggregate,
  matchesFilter,
  bestModelByAction,
  summarizeAgents,
  activityOverview,
  filterOptions,
  type SummaryRow,
  type AgentIdentity,
} from "./activityLog";

vi.mock("../_generated/api", () => ({ internal: new Proxy({}, { get: () => new Proxy({}, { get: () => new Proxy({}, { get: () => ({}) }) }) }) }));
const { agentRoutes } = await import("./routes");

const summit: AgentIdentity = { agentName: "Summit", agentId: "summit-1", model: "claude-opus-5-5", provider: "anthropic" };
const headers = (h: Record<string, string>) => new Headers(h);

describe("identityFromHeaders", () => {
  it("reads the four X-Agent-* headers as sent", () => {
    expect(
      identityFromHeaders(
        headers({ "X-Agent-Name": "Summit", "X-Agent-Id": "summit-1", "X-Agent-Model": "claude-opus-5-5", "X-Agent-Provider": "anthropic" })
      )
    ).toEqual(summit);
  });

  it("missing or blank values are 'unknown', never inferred from other headers", () => {
    const id = identityFromHeaders(headers({ "User-Agent": "claude-code/2.0 (anthropic)", "X-Agent-Model": "   ", Authorization: "Bearer jk_abc" }));
    expect(id).toEqual({ agentName: "unknown", agentId: "unknown", model: "unknown", provider: "unknown" });
  });

  it("trims, caps length and scrubs secrets", () => {
    const id = identityFromHeaders(headers({ "X-Agent-Name": "  " + "a".repeat(500) + "  ", "X-Agent-Id": "Bearer abc.def.ghi" }));
    expect(id.agentName.length).toBeLessThanOrEqual(120);
    expect(id.agentId).toBe("[redacted]");
  });
});

describe("scrubSecrets", () => {
  it.each([
    ["Authorization: Bearer abcDEF123.xyz", "abcDEF123"],
    ["key sk-ant-api03-ABCDEFGHIJKLMNOP", "sk-ant"],
    ["openai sk-proj-abcdefghijklmnop", "sk-proj"],
    ["stripe sk_live_abcdefghijkl", "sk_live"],
    ["gh ghp_abcdefghijklmnopqrstuv", "ghp_"],
    ["slack xoxb-1234567890-abcdef", "xoxb"],
    ["aws AKIAABCDEFGHIJKLMNOP", "AKIA"],
    ["jwt eyJhbGciOi.eyJzdWIiOiIx.c2lnbmF0dXJl", "eyJ"],
    ["hex " + "a1b2c3d4".repeat(5), "a1b2c3d4a1b2"],
    ["b64 " + "QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVo0123456789+/abc=", "QUJDREVGR0hJ"],
  ])("redacts %s", (input, secret) => {
    const out = scrubSecrets(input);
    expect(out).toContain("[redacted]");
    expect(out).not.toContain(secret);
  });

  it("keeps the key name of key=value secrets and redacts the value", () => {
    expect(scrubSecrets("api_key=hunter2 password: s3cret token=abc")).toBe("api_key=[redacted] password: [redacted] token=[redacted]");
  });

  it("leaves ordinary text, emails and short ids alone", () => {
    const s = "Sent follow-up to jane@acme.com about the Staff Engineer role (thread 18c2f9a)";
    expect(scrubSecrets(s)).toBe(s);
  });
});

describe("clean / truncation", () => {
  it("truncates to the max with an ellipsis and collapses whitespace", () => {
    const out = clean("x ".repeat(400), SUMMARY_MAX)!;
    expect(out.length).toBe(SUMMARY_MAX);
    expect(out.endsWith("…")).toBe(true);
    expect(clean("a\n\n  b", 50)).toBe("a b");
    expect(clean("   ", 50)).toBeUndefined();
    expect(clean(42, 50)).toBeUndefined();
  });
});

describe("forbiddenFields", () => {
  it("flags body/content/token/password (any case) and friends", () => {
    expect(forbiddenFields({ body: "x", Content: "y", TOKEN: "z", password: "p", summary: "ok" })).toEqual(["body", "Content", "TOKEN", "password"]);
    expect(forbiddenFields({ apiKey: "k", secret: "s", message: "m", text: "t" })).toHaveLength(4);
    expect(forbiddenFields({ actionType: "email_sent", summary: "s", target: "t", bodyHash: "h" })).toEqual([]);
  });

  it("the activity route opts in to rejection; other routes (email templates take content) do not", () => {
    const post = agentRoutes.find((r) => r.method === "POST" && r.path === "/agent/activity")!;
    expect(post.rejectSecretFields).toBe(true);
    expect(post.injectIdentity).toBe(true);
    expect(post.params.map((p) => p.name)).not.toEqual(expect.arrayContaining(["body"]));
    const tmpl = agentRoutes.find((r) => r.method === "POST" && r.path === "/agent/emailtemplates")!;
    expect(tmpl.rejectSecretFields).toBeUndefined();
  });
});

describe("which routes are logged", () => {
  it("every non-GET route except the activity log itself; no GET", () => {
    for (const r of agentRoutes) {
      const expected = r.method !== "GET" && !r.path.startsWith("/agent/activity");
      expect(shouldAutoLog(r), `${r.method} ${r.path}`).toBe(expected);
    }
    const logged = agentRoutes.filter(shouldAutoLog).map((r) => `${r.method} ${r.path}`);
    expect(logged).toEqual(
      expect.arrayContaining([
        "POST /agent/resumes/generate",
        "POST /agent/resumes/tailor",
        "PATCH /agent/resumes/content",
        "POST /agent/resumes/move",
        "POST /agent/coverletters/generate",
        "POST /agent/coverletters/move",
        "POST /agent/jobs",
        "PATCH /agent/jobs",
      ])
    );
    expect(logged.some((l) => l.startsWith("GET"))).toBe(false);
  });

  it("derives action types", () => {
    expect(actionTypeFor({ method: "POST", path: "/agent/resumes/generate" })).toBe("resumes.generate");
    expect(actionTypeFor({ method: "PATCH", path: "/agent/resumes/content" })).toBe("resumes.content");
    expect(actionTypeFor({ method: "POST", path: "/agent/jobs" })).toBe("jobs.create");
    expect(actionTypeFor({ method: "PATCH", path: "/agent/jobs" })).toBe("jobs.update");
    expect(actionTypeFor({ method: "DELETE", path: "/agent/coverletters" })).toBe("coverletters.delete");
    const types = agentRoutes.filter(shouldAutoLog).map(actionTypeFor);
    expect(new Set(types).size).toBe(types.length); // distinct per route
  });
});

describe("pickTarget", () => {
  it("prefers id, base, jobId, folder, then id lists, then the result id", () => {
    expect(pickTarget({ id: "r1", jobId: "j1" }, null)).toBe("r1");
    expect(pickTarget({ base: "r0", jobId: "j1" }, { id: "new" })).toBe("r0");
    expect(pickTarget({ folder: "Archive", resumeIds: ["a"] }, null)).toBe("Archive");
    expect(pickTarget({ coverLetterIds: ["c1", "c2"] }, null)).toBe("c1,c2");
    expect(pickTarget({ company: "Acme" }, { id: "res9" })).toBe("res9");
    expect(pickTarget({ company: "Acme" }, "jobId123")).toBe("jobId123");
    expect(pickTarget({}, null)).toBeUndefined();
    expect(pickTarget({ id: "jane doe ".repeat(60) }, null)!.length).toBe(TARGET_MAX);
    // Convex ids (32 chars) are kept as-is
    expect(pickTarget({ id: "n97dha19vtncgx7vnjsvrs7ta58brdp1" }, null)).toBe("n97dha19vtncgx7vnjsvrs7ta58brdp1");
  });
});

describe("automaticRow", () => {
  const route = { method: "POST", path: "/agent/resumes/generate", description: "Generate a resume PDF from the content YOU wrote" };

  it("success row: identity, action, route, target, latency; never the args' content", () => {
    const row = automaticRow(summit, route, { personalInfo: { email: "me@x.com" }, experience: ["secret plans"] }, { result: { id: "res1" }, latencyMs: 1234.4 });
    expect(row).toMatchObject({
      ...summit,
      actionType: "resumes.generate",
      source: "api",
      route: "POST /agent/resumes/generate",
      target: "res1",
      status: "success",
      latencyMs: 1234,
    });
    expect(row.errorMessage).toBeUndefined();
    expect(JSON.stringify(row)).not.toContain("secret plans");
    expect(JSON.stringify(row)).not.toContain("me@x.com");
  });

  it("error row carries a scrubbed, truncated error", () => {
    const row = automaticRow(summit, route, { id: "r1" }, { error: "boom Bearer abcdefghijk " + "z".repeat(400), latencyMs: 5 });
    expect(row.status).toBe("error");
    expect(row.errorMessage).toContain("[redacted]");
    expect(row.errorMessage!.length).toBeLessThanOrEqual(SUMMARY_MAX);
  });
});

describe("sanitizeExternal (POST /agent/activity)", () => {
  it("normalizes a valid email_sent action", () => {
    const row = sanitizeExternal(summit, {
      actionType: "Email_Sent",
      target: "jane@acme.com",
      summary: "Follow-up on Staff Engineer application",
      latencyMs: 820,
      inputTokens: 1200,
      outputTokens: 300,
      costUsd: 0.012,
      bodyHash: "A".repeat(64),
    });
    expect(row).toMatchObject({ ...summit, actionType: "email_sent", source: "external", status: "success", target: "jane@acme.com", bodyHash: "a".repeat(64) });
  });

  it("scrubs secrets from summary and target, and truncates", () => {
    const row = sanitizeExternal(summit, { actionType: "slack_message", target: "#jobs xoxb-1234567890-abcdef", summary: "Posted with token=abc123 " + "y".repeat(400) });
    expect(row.summary).not.toContain("abc123");
    expect(row.summary.length).toBeLessThanOrEqual(SUMMARY_MAX);
    expect(row.target).not.toContain("xoxb");
  });

  it("errorMessage is kept only for status=error", () => {
    expect(sanitizeExternal(summit, { actionType: "email_sent", summary: "s", status: "error", errorMessage: "SMTP 550" }).errorMessage).toBe("SMTP 550");
    expect(sanitizeExternal(summit, { actionType: "email_sent", summary: "s", errorMessage: "ignored" }).errorMessage).toBeUndefined();
  });

  it.each([
    [{ actionType: "Email Sent!", summary: "s" }, /actionType/],
    [{ actionType: "email_sent", summary: "   " }, /summary/],
    [{ actionType: "email_sent", summary: "s", status: "ok" }, /status/],
    [{ actionType: "email_sent", summary: "s", bodyHash: "not-a-hash" }, /bodyHash/],
    [{ actionType: "email_sent", summary: "s", latencyMs: -1 }, /latencyMs/],
    [{ actionType: "email_sent", summary: "s", inputTokens: 1.5 }, /inputTokens/],
  ])("rejects %j", (input, msg) => {
    expect(() => sanitizeExternal(summit, input)).toThrow(INVALID_ACTIVITY);
    expect(() => sanitizeExternal(summit, input)).toThrow(msg);
  });
});

describe("recordSafely", () => {
  it("swallows a failing write so the request still succeeds", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(recordSafely(async () => { throw new Error("db down"); })).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("runs the write when it works", async () => {
    const write = vi.fn(async () => "ok");
    await recordSafely(write);
    expect(write).toHaveBeenCalledOnce();
  });
});

describe("parseTime", () => {
  it("accepts ISO dates and epoch ms; rejects garbage", () => {
    expect(parseTime("from", "2026-11-01")).toBe(Date.parse("2026-11-01"));
    expect(parseTime("from", "1763500000000")).toBe(1763500000000);
    expect(parseTime("from", undefined)).toBeUndefined();
    expect(() => parseTime("from", "yesterday-ish")).toThrow(INVALID_ACTIVITY);
  });
});

describe("summarize", () => {
  it("groups counts, success rate, avg latency and tokens by model and action type", () => {
    const rows = [
      { model: "opus", provider: "anthropic", actionType: "email_sent", status: "success" as const, latencyMs: 100, inputTokens: 10, outputTokens: 5, costUsd: 0.01 },
      { model: "opus", provider: "anthropic", actionType: "email_sent", status: "error" as const, latencyMs: 300 },
      { model: "opus", provider: "anthropic", actionType: "resumes.generate", status: "success" as const },
      { model: "gpt", provider: "openai", actionType: "email_sent", status: "success" as const, latencyMs: 50 },
    ];
    const s = summarize(rows);
    expect(s.total).toBe(4);
    expect(s.truncated).toBe(false);
    expect(s.byModel[0]).toMatchObject({ model: "opus", provider: "anthropic", count: 3, success: 2, error: 1, successRate: 0.667, avgLatencyMs: 200, inputTokens: 10, outputTokens: 5, costUsd: 0.01 });
    expect(s.byModel[1]).toMatchObject({ model: "gpt", count: 1, successRate: 1, avgLatencyMs: 50 });
    expect(s.byActionType.find((g) => g.actionType === "resumes.generate")).toMatchObject({ count: 1, avgLatencyMs: null });
    expect(s.byModelAndAction.find((g) => g.model === "opus" && g.actionType === "email_sent")).toMatchObject({ count: 2, successRate: 0.5 });
  });

  it("empty input", () => {
    expect(summarize([], true)).toEqual({ total: 0, truncated: true, byModel: [], byActionType: [], byModelAndAction: [] });
  });

  it("counts rows that reported tokens and cost separately from zero totals", () => {
    const s = summarize([
      { model: "m", provider: "p", actionType: "a", status: "success", inputTokens: 0, outputTokens: 0, costUsd: 0 },
      { model: "m", provider: "p", actionType: "a", status: "success" },
      { model: "u", provider: "p", actionType: "a", status: "success" },
    ]);
    expect(s.byModel.find((g) => g.model === "m")).toMatchObject({ tokenRows: 1, costRows: 1, inputTokens: 0, costUsd: 0 });
    expect(s.byModel.find((g) => g.model === "u")).toMatchObject({ tokenRows: 0, costRows: 0 });
  });
});

const row = (o: Partial<SummaryRow> & { timestamp?: number; agentName?: string }) => ({
  model: "opus",
  provider: "anthropic",
  actionType: "jobs.create",
  status: "success" as const,
  agentName: "Summit",
  timestamp: 0,
  ...o,
});

describe("aggregate", () => {
  it("groups by any key and sorts by count", () => {
    const g = aggregate([row({}), row({ model: "gpt" }), row({ model: "gpt", status: "error" })], (r) => ({ model: r.model }));
    expect(g.map((x) => [x.model, x.count, x.error])).toEqual([["gpt", 2, 1], ["opus", 1, 0]]);
  });
});

describe("matchesFilter", () => {
  const r = { agentName: "Kepa", model: "gpt-5", actionType: "email_sent", status: "error" };
  it("passes with no filter and applies each one", () => {
    expect(matchesFilter(r, {})).toBe(true);
    expect(matchesFilter(r, { agent: "Kepa", status: "error" })).toBe(true);
    expect(matchesFilter(r, { model: "opus" })).toBe(false);
    expect(matchesFilter(r, { actionType: "jobs.create" })).toBe(false);
    expect(matchesFilter(r, { status: "success" })).toBe(false);
  });
});

describe("bestModelByAction", () => {
  it("picks the highest success rate, then more runs, then name", () => {
    const best = bestModelByAction([
      row({ model: "a" }), row({ model: "a", status: "error" }),
      row({ model: "b" }),
      row({ model: "c" }), row({ model: "c" }),
      row({ actionType: "email_sent", model: "z" }), row({ actionType: "email_sent", model: "y" }),
    ]);
    expect(best["jobs.create"]).toEqual({ model: "c", successRate: 1, count: 2 });
    expect(best["email_sent"].model).toBe("y");
  });

  it("only knows actions that ran", () => {
    expect(bestModelByAction([])).toEqual({});
  });
});

describe("summarizeAgents", () => {
  it("gives each agent its numbers and the model it used most", () => {
    const a = summarizeAgents([
      row({ agentName: "Kepa", model: "sonnet" }), row({ agentName: "Kepa", model: "sonnet", status: "error" }), row({ agentName: "Kepa", model: "gpt" }),
      row({ agentName: "Orbit", model: "unknown" }),
    ]);
    expect(a[0]).toMatchObject({ agentName: "Kepa", count: 3, success: 2, usualModel: "sonnet" });
    expect(a[1]).toMatchObject({ agentName: "Orbit", count: 1, usualModel: "unknown" });
  });
});

describe("activityOverview", () => {
  it("totals, today count, best model per action", () => {
    const rows = [
      row({ timestamp: 100, latencyMs: 1000, inputTokens: 10, outputTokens: 5, costUsd: 0.5 }),
      row({ timestamp: 200, status: "error", latencyMs: 3000 }),
      row({ timestamp: 50, actionType: "email_sent", model: "gpt" }),
    ];
    const o = activityOverview(rows, { todayStart: 100 });
    expect(o.total).toBe(3);
    expect(o.today).toBe(2);
    expect(o.totals).toMatchObject({ count: 3, error: 1, avgLatencyMs: 2000, inputTokens: 10, outputTokens: 5, costUsd: 0.5, tokenRows: 1, costRows: 1 });
    expect(o.byActionType.find((g) => g.actionType === "jobs.create")).toMatchObject({ count: 2, error: 1, best: { model: "opus", successRate: 0.5 } });
    expect(o.byAgent[0]).toMatchObject({ agentName: "Summit", count: 3 });
  });

  it("no rows: null totals", () => {
    expect(activityOverview([], { todayStart: 0 }).totals).toBeNull();
  });
});

describe("filterOptions", () => {
  it("lists distinct values, most used first", () => {
    const o = filterOptions([
      { agentName: "Kepa", model: "gpt", actionType: "a" },
      { agentName: "Orbit", model: "gpt", actionType: "b" },
      { agentName: "Orbit", model: "opus", actionType: "b" },
    ]);
    expect(o).toEqual({ agents: ["Orbit", "Kepa"], models: ["gpt", "opus"], actionTypes: ["b", "a"] });
  });
});
