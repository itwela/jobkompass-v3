import { describe, expect, it } from "vitest";
import { NO_MODEL_WARNING, agentHeaders, clientHeaders, keyIdentityBody, keyModelWarning } from "../src/agent";
import { commands } from "../src/commands";
import { agentLabel, formatOutput, identityNote, modelLabel } from "../src/output";
import pkg from "../package.json";

const find = (name: string) => commands.find((c) => c.name === name)!;

describe("agentHeaders", () => {
  it("flags become X-Agent-* headers", () => {
    expect(agentHeaders({ agent: "Summit", agentId: "s-1", model: "claude-opus-5-5", provider: "anthropic" }, {})).toEqual({
      "X-Agent-Name": "Summit",
      "X-Agent-Id": "s-1",
      "X-Agent-Model": "claude-opus-5-5",
      "X-Agent-Provider": "anthropic",
    });
  });

  it("env vars are the fallback; flags win", () => {
    const env = { JK_AGENT_NAME: "EnvAgent", JK_AGENT_ID: "e-1", JK_AGENT_MODEL: "env-model", JK_AGENT_PROVIDER: "openai" };
    expect(agentHeaders({ model: "flag-model" }, env)).toEqual({
      "X-Agent-Name": "EnvAgent",
      "X-Agent-Id": "e-1",
      "X-Agent-Model": "flag-model",
      "X-Agent-Provider": "openai",
    });
  });

  it("nothing set sends nothing (the server stores 'unknown'); never guessed", () => {
    expect(agentHeaders({}, { USER: "me", ANTHROPIC_API_KEY: "sk-ant-x", CLAUDECODE: "1" })).toEqual({});
    expect(agentHeaders({ agent: "   " }, {})).toEqual({});
  });

  it("drops values that are not valid header text instead of failing", () => {
    expect(agentHeaders({ agent: "a\nb" }, {})).toEqual({});
  });
});

describe("clientHeaders", () => {
  it("names the client as jk/<version>", () => {
    expect(clientHeaders("0.6.0")).toEqual({ "User-Agent": "jk/0.6.0" });
  });

  it("the package is 0.6.0", () => {
    expect(pkg.version).toBe("0.6.0");
  });
});

describe("keyIdentityBody (jk keys create)", () => {
  it("maps the identity flags to the key's fields", () => {
    expect(keyIdentityBody({ agent: "Claude Code", agentId: "cc-1", model: "claude-opus-5-5", provider: "anthropic" })).toEqual({
      agentName: "Claude Code",
      agentId: "cc-1",
      model: "claude-opus-5-5",
      provider: "anthropic",
    });
  });

  it("no flags: an unscoped key; blanks dropped", () => {
    expect(keyIdentityBody({})).toEqual({});
    expect(keyIdentityBody({ agent: "  ", model: "gpt-5" })).toEqual({ model: "gpt-5" });
  });
});

describe("identity in activity output", () => {
  it("names where the agent came from", () => {
    expect(identityNote({ agentName: "Claude Code", identitySource: "key", keyName: "laptop" })).toBe('via key "laptop"');
    expect(identityNote({ agentName: "Codex", identitySource: "header" })).toBe("self-reported");
    expect(identityNote({ agentName: "Codex", identitySource: "profile" })).toBe("self-reported");
    expect(identityNote({ agentName: "unknown", identitySource: "none" })).toBe("unknown agent");
  });

  it("rows from before identity sources still read", () => {
    expect(identityNote({ agentName: "Summit" })).toBe("self-reported");
    expect(identityNote({ agentName: "unknown" })).toBe("unknown agent");
  });

  it("the pretty table shows the agent with its source", () => {
    const out = formatOutput({ items: [{ timestamp: 0, agentName: "Claude Code", identitySource: "key", keyName: "laptop", model: "m", actionType: "jobs.create", status: "success" }], cursor: null, isDone: true }, false);
    expect(out).toContain('Claude Code (via key "laptop")');
    expect(agentLabel({ agentName: "unknown", identitySource: "none" })).toBe("unknown agent");
  });
});

describe("keys list output", () => {
  const keys = [
    { id: "k1", name: "laptop", scoped: true, identity: { agentName: "Claude Code", model: "claude-opus-5-5", provider: "anthropic" }, createdAt: Date.UTC(2026, 10, 3), lastUsedAt: Date.UTC(2026, 10, 19), current: true },
    { id: "k2", name: "old-ci", scoped: false, identity: null, createdAt: Date.UTC(2026, 7, 2) },
  ];

  it("pretty: model column first, identity on one line, legacy keys say so, never a key", () => {
    const out = formatOutput(keys, false);
    expect(out).toContain("claude-opus-5-5");
    expect(out).toContain("Claude Code · anthropic");
    expect(out).toContain("no model");
    expect(out).toContain("laptop (this key)");
    expect(out).toContain("none (agent reports its own)");
    expect(out).toContain("never");
    expect(out).not.toContain("jk_sk_");
  });

  it("machine mode is the raw JSON", () => {
    expect(JSON.parse(formatOutput(keys, true))).toEqual(keys);
  });
});

describe("activity commands", () => {
  it("map to the right routes", () => {
    expect(find("activity log")).toMatchObject({ method: "POST", path: "/agent/activity" });
    expect(find("activity list")).toMatchObject({ method: "GET", path: "/agent/activity" });
    expect(find("activity summary")).toMatchObject({ method: "GET", path: "/agent/activity/summary" });
  });

  it("log maps flags to API params; type and summary required; no body flag", () => {
    const by = (api: string) => find("activity log").opts.find((o) => o.api === api);
    expect(by("actionType")).toMatchObject({ flag: "--type <type>", required: true });
    expect(by("summary")).toMatchObject({ flag: "--summary <text>", required: true });
    expect(by("target")).toMatchObject({ flag: "--target <target>" });
    expect(by("latencyMs")).toMatchObject({ flag: "--latency-ms <n>", type: "num" });
    expect(by("inputTokens")).toMatchObject({ flag: "--input-tokens <n>", type: "num" });
    expect(by("outputTokens")).toMatchObject({ flag: "--output-tokens <n>", type: "num" });
    expect(by("bodyHash")).toMatchObject({ flag: "--body-hash <sha256>" });
    const flags = find("activity log").opts.map((o) => o.flag.split(" ")[0]);
    for (const banned of ["--body", "--content", "--token", "--password"]) expect(flags).not.toContain(banned);
  });

  it("filters never collide with the global --agent/--agent-id/--model/--provider flags", () => {
    for (const name of ["activity list", "activity summary", "activity log"]) {
      const flags = find(name).opts.map((o) => o.flag.split(" ")[0]);
      for (const g of ["--agent", "--agent-id", "--model", "--provider"]) expect(flags).not.toContain(g);
    }
    const apis = find("activity list").opts.map((o) => o.api);
    expect(apis).toEqual(expect.arrayContaining(["agent", "agentId", "model", "actionType", "status", "from", "to", "limit", "cursor"]));
  });
});

describe("activity output", () => {
  const page = {
    items: [
      { id: "a1", timestamp: Date.UTC(2026, 10, 19, 12, 0, 0), agentName: "Summit", model: "claude-opus-5-5", actionType: "email_sent", status: "success", latencyMs: 820, target: "jane@acme.com", summary: "Follow-up" },
    ],
    cursor: "c123",
    isDone: false,
  };

  it("list pretty mode is a table plus the next-page command", () => {
    const out = formatOutput(page, false);
    expect(out).toContain("2026-11-19 12:00:00");
    expect(out).toContain("Summit");
    expect(out).toContain("email_sent");
    expect(out).toContain("jk activity list --cursor c123");
  });

  it("summary pretty mode shows each grouping with success rate", () => {
    const summary = {
      total: 3,
      truncated: false,
      byModel: [{ model: "opus", provider: "anthropic", count: 3, success: 2, error: 1, successRate: 0.667, avgLatencyMs: 200, inputTokens: 0, outputTokens: 0, costUsd: 0 }],
      byActionType: [{ actionType: "email_sent", count: 3, success: 2, error: 1, successRate: 0.667, avgLatencyMs: null, inputTokens: 0, outputTokens: 0, costUsd: 0 }],
      byModelAndAction: [],
    };
    const out = formatOutput(summary, false);
    expect(out.split("\n")[0]).toBe("3 action(s).");
    expect(out).toContain("By model:");
    expect(out).toContain("66.7%");
    expect(out).toContain("By action type:");
  });

  it("machine mode is the raw JSON", () => {
    expect(JSON.parse(formatOutput(page, true))).toEqual(page);
  });
});

describe("model identification (CLI side)", () => {
  it("--model flag is sent as X-Agent-Model", () => {
    expect(agentHeaders({ model: "claude-opus-5-5" }, {})["X-Agent-Model"]).toBe("claude-opus-5-5");
  });
  it("JK_AGENT_MODEL env var is sent when there is no flag", () => {
    expect(agentHeaders({}, { JK_AGENT_MODEL: "gpt-5" })["X-Agent-Model"]).toBe("gpt-5");
  });
  it("the flag beats the env var", () => {
    expect(agentHeaders({ model: "flag" }, { JK_AGENT_MODEL: "env" })["X-Agent-Model"]).toBe("flag");
  });
  it("blank / whitespace / non-latin1 values are not sent", () => {
    expect(agentHeaders({ model: "   " }, {})).not.toHaveProperty("X-Agent-Model");
    expect(agentHeaders({}, { JK_AGENT_MODEL: "" })).not.toHaveProperty("X-Agent-Model");
    expect(agentHeaders({ model: "bad\nvalue" }, {})).not.toHaveProperty("X-Agent-Model");
  });
  it("keys create warns (does not fail) when --model is missing", () => {
    expect(keyModelWarning(keyIdentityBody({ agent: "Claude Code" }))).toBe(NO_MODEL_WARNING);
    expect(keyModelWarning(keyIdentityBody({ model: "  " }))).toBe(NO_MODEL_WARNING);
    expect(keyModelWarning(keyIdentityBody({ agent: "A", model: "opus" }))).toBeUndefined();
    expect(NO_MODEL_WARNING).toContain("Unknown model");
    expect(NO_MODEL_WARNING).toContain("JK_AGENT_MODEL");
  });
  it("activity list shows a model column, 'unknown model' when missing", () => {
    const out = formatOutput({ items: [
      { timestamp: 0, agentName: "A", model: "unknown", actionType: "jobs.create", status: "success" },
      { timestamp: 0, agentName: "B", model: "gpt-5", actionType: "jobs.create", status: "success" },
    ], cursor: null, isDone: true }, false);
    expect(out).toContain("model");
    expect(out).toContain("unknown model");
    expect(out).toContain("gpt-5");
  });
  it("activity summary says 'unknown model' and points to the fix", () => {
    const g = { count: 2, success: 2, error: 0, successRate: 1, avgLatencyMs: null, inputTokens: 0, outputTokens: 0, costUsd: 0 };
    const out = formatOutput({ total: 2, truncated: false, byModel: [{ model: "unknown", provider: "unknown", ...g }], byActionType: [{ actionType: "a", ...g }], byModelAndAction: [{ model: "unknown", actionType: "a", ...g }] }, false);
    expect(out).toContain("unknown model");
    expect(out).toContain("2 action(s) have no model");
  });
  it("modelLabel", () => {
    expect(modelLabel("opus")).toBe("opus");
    expect(modelLabel("unknown")).toBe("unknown model");
    expect(modelLabel(undefined)).toBe("unknown model");
    expect(modelLabel(" ")).toBe("unknown model");
  });
});
