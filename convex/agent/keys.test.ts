import { describe, expect, it, vi } from "vitest";
import {
  KEY_FORBIDDEN,
  KEY_NOT_FOUND,
  assertCanMintKeys,
  assertCanRevoke,
  cleanKeyIdentity,
  identityPatch,
  isScoped,
  keyIdentityOf,
  keyOut,
} from "./keyIdentity";
import { resolveIdentity } from "./activityLog";

vi.mock("../_generated/api", () => ({ internal: new Proxy({}, { get: () => new Proxy({}, { get: () => new Proxy({}, { get: () => ({}) }) }) }) }));
const { agentRoutes } = await import("./routes");

type RowOver = Partial<{ revokedAt: number; lastUsedAt: number; agentName: string; agentId: string; model: string; provider: string }>;
const row = (over: RowOver = {}) => ({
  _id: "k1",
  userId: "u1",
  name: "laptop",
  keyHash: "f".repeat(64),
  createdAt: 1_700_000_000_000,
  ...over,
});

describe("scoped key round trip", () => {
  it("the identity stored on create is the identity every call resolves to", () => {
    const stored = cleanKeyIdentity({ agentName: " Claude Code ", model: "claude-opus-5-5", provider: "anthropic", agentId: "" });
    expect(stored).toEqual({ agentName: "Claude Code", model: "claude-opus-5-5", provider: "anthropic" });
    const looked = keyIdentityOf(row(stored));
    const spoof = new Headers({ "X-Agent-Name": "Someone Else", "X-Agent-Provider": "openai" });
    expect(resolveIdentity(looked, spoof)).toMatchObject({
      identity: { agentName: "Claude Code", agentId: "unknown", model: "claude-opus-5-5", provider: "anthropic" },
      identitySource: "key",
    });
  });

  it("a legacy key has no identity and resolves exactly as before (headers or unknown)", () => {
    expect(keyIdentityOf(row())).toBeNull();
    expect(isScoped(keyIdentityOf(row()))).toBe(false);
    expect(resolveIdentity(keyIdentityOf(row()), new Headers({ "X-Agent-Name": "Summit" })).identitySource).toBe("header");
    expect(resolveIdentity(keyIdentityOf(row()), new Headers()).identity.agentName).toBe("unknown");
  });

  it("identity values are scrubbed and capped like headers", () => {
    const id = cleanKeyIdentity({ agentName: "a".repeat(500), agentId: "Bearer abc.def.ghi" });
    expect(id.agentName!.length).toBeLessThanOrEqual(120);
    expect(id.agentId).toBe("[redacted]");
  });

  it("editing identity writes every field, so blanks clear it", () => {
    expect(identityPatch({ agentName: "Codex", model: "  " })).toEqual({ agentName: "Codex", agentId: undefined, model: undefined, provider: undefined });
    expect(isScoped(identityPatch({}))).toBe(false);
  });
});

describe("minting keys", () => {
  it("a scoped key cannot mint keys", () => {
    expect(() => assertCanMintKeys({ scoped: true })).toThrow(KEY_FORBIDDEN);
    expect(() => assertCanMintKeys({ scoped: true })).toThrow(/cannot create keys/);
  });

  it("a key with no identity can", () => {
    expect(() => assertCanMintKeys({ scoped: false })).not.toThrow();
  });
});

describe("revoking keys", () => {
  const caller = { id: "k1", callerKeyId: "k9" };

  it("own active keys only", () => {
    expect(() => assertCanRevoke(row(), "u1", caller)).not.toThrow();
    expect(() => assertCanRevoke(row(), "someone-else", caller)).toThrow(KEY_NOT_FOUND);
    expect(() => assertCanRevoke(null, "u1", caller)).toThrow(KEY_NOT_FOUND);
    expect(() => assertCanRevoke(row({ revokedAt: 1 }), "u1", caller)).toThrow(KEY_NOT_FOUND);
  });

  it("refuses the key making the call unless self is set", () => {
    expect(() => assertCanRevoke(row(), "u1", { id: "k1", callerKeyId: "k1" })).toThrow(/--self/);
    expect(() => assertCanRevoke(row(), "u1", { id: "k1", callerKeyId: "k1", self: true })).not.toThrow();
  });
});

describe("listing keys", () => {
  it("never returns the hash or the key", () => {
    const out = keyOut(row({ agentName: "Codex", model: "gpt-5-codex", provider: "openai", lastUsedAt: 5 }));
    expect(out).toEqual({
      id: "k1",
      name: "laptop",
      scoped: true,
      identity: { agentName: "Codex", model: "gpt-5-codex", provider: "openai" },
      createdAt: 1_700_000_000_000,
      lastUsedAt: 5,
    });
    expect(JSON.stringify(out)).not.toContain("f".repeat(64));
    expect(out).not.toHaveProperty("keyHash");
  });

  it("a legacy key lists with identity null", () => {
    expect(keyOut(row())).toMatchObject({ scoped: false, identity: null });
    expect(keyOut(row())).not.toHaveProperty("lastUsedAt");
  });
});

describe("/agent/keys routes", () => {
  const find = (method: string) => agentRoutes.find((r) => r.path === "/agent/keys" && r.method === method)!;

  it("create, list and revoke exist and get the calling key", () => {
    for (const m of ["POST", "GET", "DELETE"]) {
      expect(find(m)).toBeDefined();
      expect(find(m).injectCallerKey).toBe(true);
    }
    expect(find("POST").kind).toBe("action");
  });

  it("create takes a name and the four identity fields, nothing else", () => {
    expect(find("POST").params.map((p) => p.name).sort()).toEqual(["agentId", "agentName", "model", "name", "provider"]);
  });

  it("callers cannot pass callerKey or userId themselves", () => {
    for (const m of ["POST", "GET", "DELETE"]) {
      const names = find(m).params.map((p) => p.name);
      expect(names).not.toContain("callerKey");
      expect(names).not.toContain("userId");
    }
  });

  it("revoke requires id and takes self", () => {
    expect(find("DELETE").params.find((p) => p.name === "id")).toMatchObject({ required: true });
    expect(find("DELETE").params.find((p) => p.name === "self")).toMatchObject({ type: "boolean" });
  });
});
