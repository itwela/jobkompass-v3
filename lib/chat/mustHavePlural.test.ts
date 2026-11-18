import { describe, expect, it } from "vitest";
import { GENERIC_SUFFIXES, matchMustHave, stripGenericSuffix } from "./mustHaveMatch";

const skillsLine = "AI & LLMs: Claude API, MCP, RAG, Claude API tool use, MCP servers, LangChain";
const resume = {
  experience: [{ company: "Acme", details: ["Built REST API services in TypeScript and JavaScript"] }],
  skills: { technical: [skillsLine, "TypeScript, JavaScript, Python, AWS, Redis"] },
};
const noApi = { skills: { technical: ["Python, Pandas, SQL Server"] } };

describe("plural/singular must-haves", () => {
  it("Claude APIs matches Claude API with the real snippet", () => {
    expect(matchMustHave(resume, "Claude APIs")).toBe(skillsLine);
  });
  it("LLMs and LLM match", () => {
    expect(matchMustHave(resume, "LLMs")).toBe(skillsLine);
    expect(matchMustHave({ skills: ["LLM"] }, "LLMs")).toBe("LLM");
    expect(matchMustHave({ skills: ["Claude APIs"] }, "Claude API")).toBe("Claude APIs");
  });
  it("keeps AWS / Redis intact", () => {
    expect(matchMustHave(resume, "AWS")).not.toBeNull();
    expect(matchMustHave(resume, "Redis")).not.toBeNull();
  });
});

describe("generic trailing words", () => {
  it("MCP Integration matches MCP", () => {
    expect(matchMustHave(resume, "MCP Integration")).toBe(skillsLine);
  });
  it("REST API Integration matches REST API", () => {
    expect(matchMustHave(resume, "REST API Integration")).toContain("REST API");
  });
  it("keeps the list in one constant and never strips to an empty or vague core", () => {
    expect(GENERIC_SUFFIXES).toContain("integration");
    expect(stripGenericSuffix("Integration")).toBeNull();
    expect(stripGenericSuffix("Integration Experience")).toBeNull();
    expect(stripGenericSuffix("Web Development")).toBeNull();
    expect(stripGenericSuffix("MCP Integration")).toBe("MCP");
  });
});

describe("negatives stay missing", () => {
  it("Java does not match JavaScript", () => {
    expect(matchMustHave(resume, "Java")).toBeNull();
    expect(matchMustHave(resume, "Java Development")).toBeNull();
  });
  it("Integration alone / API Integration without an API stay missing", () => {
    expect(matchMustHave(noApi, "Integration")).toBeNull();
    expect(matchMustHave(noApi, "API Integration")).toBeNull();
    expect(matchMustHave(noApi, "APIs")).toBeNull();
  });
  it("Jenkins, Oracle, PL/SQL stay missing", () => {
    for (const t of ["Jenkins", "Oracle", "PL/SQL", "Oracle Development"]) expect(matchMustHave(noApi, t)).toBeNull();
  });
});
