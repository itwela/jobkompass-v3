import { describe, expect, it } from "vitest";
import { cleanResumeContent, countPdfPages, editedAgo, linkedCompanyFor, moveItem, parseRewrite, templateShortName } from "./documentMeta";

describe("linkedCompanyFor", () => {
  const jobs = [
    { company: "Stripe", resumeUsed: "Itwela Resume - Stripe", updatedAt: 1 },
    { company: "Vercel", resumeUsed: "itwela resume - stripe ", updatedAt: 5 },
    { company: "Anthropic", coverLetterUsed: "Cover letter - Anthropic", updatedAt: 2 },
    { company: "ById", resumeUsed: "abc123", updatedAt: 1 },
  ];
  it("matches by name, case-insensitive, latest job wins", () => {
    expect(linkedCompanyFor({ name: "Itwela Resume - Stripe", documentType: "resume" }, jobs)).toBe("Vercel");
  });
  it("matches cover letters on coverLetterUsed", () => {
    expect(linkedCompanyFor({ name: "Cover letter - Anthropic", documentType: "cover-letter" }, jobs)).toBe("Anthropic");
    expect(linkedCompanyFor({ name: "Cover letter - Anthropic", documentType: "resume" }, jobs)).toBeNull();
  });
  it("matches by id", () => {
    expect(linkedCompanyFor({ _id: "abc123", name: "x", documentType: "resume" }, jobs)).toBe("ById");
  });
  it("returns null without jobs or match", () => {
    expect(linkedCompanyFor({ name: "nope" }, jobs)).toBeNull();
    expect(linkedCompanyFor({ name: "nope" }, undefined)).toBeNull();
  });
});

describe("small helpers", () => {
  it("templateShortName", () => {
    expect(templateShortName("JobKompass Mar")).toBe("Mar");
    expect(templateShortName(undefined)).toBeNull();
  });
  it("editedAgo", () => {
    const now = new Date("2026-11-13T12:00:00Z").getTime();
    expect(editedAgo(now - 2 * 86400000, now)).toBe("edited 2 days ago");
    expect(editedAgo(now - 3 * 3600000, now)).toBe("edited 3 hours ago");
    expect(editedAgo(now, now)).toBe("edited just now");
  });
  it("moveItem", () => {
    expect(moveItem(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
    expect(moveItem(["a", "b"], 0, 5)).toEqual(["a", "b"]);
  });
  it("countPdfPages ignores /Pages", () => {
    const pdf = new TextEncoder().encode("<< /Type /Pages /Count 2 >> << /Type /Page >> << /Type/Page /Parent 1 0 R >>");
    expect(countPdfPages(pdf)).toBe(2);
    expect(countPdfPages(new TextEncoder().encode("nothing"))).toBeNull();
  });
});

describe("parseRewrite", () => {
  it("splits reason and quoted suggestion", () => {
    const r = parseRewrite('Bullet 1 says what you built. Lead with the result:\n"Cut manual job entry to zero by building an MCP server."', "Built an MCP server.");
    expect(r).toEqual({ reason: "Bullet 1 says what you built. Lead with the result:", suggestion: "Cut manual job entry to zero by building an MCP server." });
  });
  it("falls back to the last line and ignores updates blocks", () => {
    const r = parseRewrite("Lead with the outcome.\n- Shipped features end to end with Claude Code.\n```updates\n[]\n```", "x");
    expect(r?.suggestion).toBe("Shipped features end to end with Claude Code.");
  });
  it("null when unchanged or empty", () => {
    expect(parseRewrite('"Same bullet text here"', "same bullet text here")).toBeNull();
    expect(parseRewrite("", "x")).toBeNull();
  });
});

describe("cleanResumeContent", () => {
  it("drops blank bullets and skill lines", () => {
    const out = cleanResumeContent({ skills: { technical: ["A", " ", ""] }, experience: [{ details: ["x ", "", "y"] }], personalInfo: { email: "" } });
    expect(out.skills.technical).toEqual(["A"]);
    expect(out.experience[0].details).toEqual(["x", "y"]);
  });
});
