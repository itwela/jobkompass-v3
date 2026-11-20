import { describe, expect, it } from "vitest";
import {
  agentDisplayName, allUnknown, canScopeKey, fmtKeyCreated, fmtKeyUsed, hasIdentity, identityNote,
  identitySourceLabel, identityTail, isUnknownAgent, keyNameLabel, maskKey,
} from "./identity";

describe("agent names", () => {
  it("unknown reads as Unknown", () => {
    expect(agentDisplayName("unknown")).toBe("Unknown");
    expect(agentDisplayName("")).toBe("Unknown");
    expect(agentDisplayName("Claude Code")).toBe("Claude Code");
    expect(isUnknownAgent("Codex")).toBe(false);
  });

  it("all-unknown only when there is at least one agent and every one is unknown", () => {
    expect(allUnknown([{ agentName: "unknown" }])).toBe(true);
    expect(allUnknown([{ agentName: "unknown" }, { agentName: "Codex" }])).toBe(false);
    expect(allUnknown([])).toBe(false);
  });
});

describe("identityNote (the sub-label under the agent)", () => {
  it("scoped key, self-reported, unknown", () => {
    expect(identityNote({ agentName: "Claude Code", identitySource: "key", keyName: "laptop" })).toBe('via key "laptop"');
    expect(identityNote({ agentName: "Claude Code", identitySource: "key" })).toBe("via key");
    expect(identityNote({ agentName: "Codex", identitySource: "header" })).toBe("self-reported");
    expect(identityNote({ agentName: "Codex", identitySource: "profile" })).toBe("self-reported");
    expect(identityNote({ agentName: "unknown", identitySource: "none" })).toBe("unknown agent");
  });

  it("rows from before identity sources", () => {
    expect(identityNote({ agentName: "Summit" })).toBe("self-reported");
    expect(identityNote({ agentName: "unknown" })).toBe("unknown agent");
  });
});

describe("details panel rows", () => {
  it("key name: the key's name when it is scoped, else legacy; old rows say not recorded", () => {
    expect(keyNameLabel({ agentName: "Claude Code", keyId: "k1", keyName: "laptop", keyScoped: true })).toBe("laptop");
    expect(keyNameLabel({ agentName: "Codex", keyId: "k2", keyName: "mbp-2023", keyScoped: false })).toBe("Legacy key, no identity");
    expect(keyNameLabel({ agentName: "Codex", keyId: "k3" })).toBe("Revoked key");
    expect(keyNameLabel({ agentName: "Codex" })).toBe("Not recorded");
  });

  it("identity source", () => {
    expect(identitySourceLabel({ agentName: "Claude Code", identitySource: "key", keyName: "laptop" })).toBe('From key "laptop"');
    expect(identitySourceLabel({ agentName: "Codex", identitySource: "header" })).toBe("Self-reported (X-Agent headers)");
    expect(identitySourceLabel({ agentName: "Codex", identitySource: "profile" })).toBe("Self-reported (jk profile)");
    expect(identitySourceLabel({ agentName: "unknown", identitySource: "none" })).toBe("Unknown agent, nothing sent");
  });

  it("Scope this key shows only for a live key with no identity", () => {
    expect(canScopeKey({ agentName: "Codex", keyId: "k2", keyName: "mbp-2023", keyScoped: false })).toBe(true);
    expect(canScopeKey({ agentName: "Codex", keyId: "k1", keyName: "laptop", keyScoped: true })).toBe(false);
    expect(canScopeKey({ agentName: "Codex", keyId: "k3" })).toBe(false);
    expect(canScopeKey({ agentName: "Codex" })).toBe(false);
  });
});

describe("key identity chips", () => {
  it("has identity when any field is set", () => {
    expect(hasIdentity({ model: "gpt-5" })).toBe(true);
    expect(hasIdentity({})).toBe(false);
    expect(hasIdentity(null)).toBe(false);
  });

  it("tail: model and provider; phones drop the provider", () => {
    expect(identityTail({ agentName: "Claude Code", model: "claude-opus-5-5", provider: "anthropic" })).toEqual(["claude-opus-5-5", "anthropic"]);
    expect(identityTail({ agentName: "Claude Code", model: "claude-opus-5-5", provider: "anthropic" }, { provider: false })).toEqual(["claude-opus-5-5"]);
    expect(identityTail({ agentName: "Codex" })).toEqual([]);
  });
});

describe("key display", () => {
  it("masks everything after the prefix", () => {
    const key = "jk_sk_" + "0123456789abcdef".repeat(3);
    const masked = maskKey(key);
    expect(masked.startsWith("jk_sk_")).toBe(true);
    expect(masked).not.toContain("0123");
  });

  it("created and last used", () => {
    const now = new Date(2026, 10, 19, 15, 0).getTime();
    expect(fmtKeyCreated(new Date(2026, 10, 3).getTime())).toBe("created Nov 3");
    expect(fmtKeyUsed(undefined, now)).toBe("never used");
    expect(fmtKeyUsed(now - 4 * 60_000, now)).toBe("used 4 min ago");
    expect(fmtKeyUsed(now - 3 * 3_600_000, now)).toBe("used 3h ago");
    expect(fmtKeyUsed(new Date(2026, 10, 18, 9).getTime(), now)).toBe("used yesterday");
    expect(fmtKeyUsed(new Date(2026, 8, 14).getTime(), now)).toBe("used Sep 14");
  });
});
