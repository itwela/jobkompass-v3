import { describe, it, expect } from "vitest";
import {
  companyFromEmail,
  resolveLeadFields,
  mergeTopMessages,
  type SenderHit,
} from "./manualLead";

describe("companyFromEmail", () => {
  it("titlecases the domain's second-level label", () => {
    expect(companyFromEmail("jane@acme-corp.com")).toBe("Acme-corp");
    expect(companyFromEmail("recruiter@google.com")).toBe("Google");
    expect(companyFromEmail("hr@mail.acme.com")).toBe("Acme");
  });
  it("falls back for junk input", () => {
    expect(companyFromEmail("not-an-email")).toBe("Unknown company");
    expect(companyFromEmail("")).toBe("Unknown company");
  });
});

describe("resolveLeadFields", () => {
  it("uses classifier company/role when personal_outreach", () => {
    expect(
      resolveLeadFields(
        { type: "personal_outreach", company: "Acme", role: "SWE", senderName: "Jane" },
        "j@acme.com"
      )
    ).toEqual({ company: "Acme", role: "SWE" });
  });
  it("forces a lead from domain when classifier says neither", () => {
    expect(resolveLeadFields({ type: "neither" }, "j@acme.com")).toEqual({
      company: "Acme",
      role: "Unknown role",
    });
  });
  it("forces a lead when classifier failed (null)", () => {
    expect(resolveLeadFields(null, "j@acme.com")).toEqual({
      company: "Acme",
      role: "Unknown role",
    });
  });
  it("forces a lead from domain when classifier returns a digest", () => {
    expect(resolveLeadFields({ type: "digest", listings: [] }, "j@acme.com")).toEqual({
      company: "Acme",
      role: "Unknown role",
    });
  });
});

describe("mergeTopMessages", () => {
  const hit = (id: string, receivedAt: number): SenderHit => ({
    accountId: "a",
    accountEmail: "me@x.com",
    messageId: id,
    threadId: "t",
    subject: "s",
    snippet: "sn",
    receivedAt,
    rfcMessageId: "<r>",
  });
  it("merges accounts, sorts newest-first, caps at 3", () => {
    const out = mergeTopMessages([
      [hit("1", 100), hit("2", 300)],
      [hit("3", 200), hit("4", 400)],
    ]);
    expect(out.map((h) => h.messageId)).toEqual(["4", "2", "3"]);
  });
  it("returns [] for no accounts", () => {
    expect(mergeTopMessages([])).toEqual([]);
  });
});
