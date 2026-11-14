import { describe, expect, it } from "vitest";
import { describeResumeChanges } from "@/lib/onboarding/resumeChanges";
import { isPrivateAddress, normalizeJobUrl, htmlToText } from "@/lib/onboarding/fetchPosting";

const base = {
  personalInfo: { email: "a@b.co", summary: "Engineer who builds tools." },
  skills: { technical: ["React", "Python", "RAG", "MCP"] },
  experience: [
    { company: "JobKompass", title: "Founder", date: "2024", details: ["Built UI.", "Built an MCP server."] },
    { company: "Dope Marketing", title: "Engineer", date: "2023", details: ["Built RAG."] },
  ],
};

describe("describeResumeChanges", () => {
  it("names what moved, from the documents themselves", () => {
    const tailored = {
      ...base,
      personalInfo: { ...base.personalInfo, summary: "Engineer who builds AI agents and tools." },
      skills: { technical: ["MCP", "RAG", "React", "Python"] },
      experience: [{ ...base.experience[0], details: ["Built an MCP server.", "Built UI."] }, base.experience[1]],
    };
    const { changes, marks } = describeResumeChanges(base, tailored, { role: "AI Engineer" });
    expect(changes.map((c) => [c.title, c.note])).toEqual([
      ["Summary", "Rewritten for AI Engineer"],
      ["Skills", "MCP and RAG moved first"],
      ["Experience", "The most relevant JobKompass work on top"],
    ]);
    expect(marks).toEqual({ summary: true, skills: true, experience: [0], projects: [] });
  });

  it("reports nothing when nothing changed", () => {
    expect(describeResumeChanges(base, base, { role: "X" }).changes).toEqual([]);
  });
});

describe("job link guard", () => {
  it("accepts bare and full public links", () => {
    expect(normalizeJobUrl("careers.blackrock.com/job/22417")?.toString()).toBe("https://careers.blackrock.com/job/22417");
    expect(normalizeJobUrl("https://boards.greenhouse.io/x/jobs/1")?.hostname).toBe("boards.greenhouse.io");
  });
  it("refuses non-web schemes, credentials and private hosts", () => {
    for (const bad of ["file:///etc/passwd", "ftp://x.com/a", "http://127.0.0.1/", "http://10.0.0.5/x", "http://169.254.169.254/latest", "https://u:p@x.com/", "not a url", "localhost:3000"]) {
      expect(normalizeJobUrl(bad), bad).toBeNull();
    }
  });
  it("knows private address ranges", () => {
    expect(["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "::1", "fd00::1", "::ffff:10.0.0.1"].every(isPrivateAddress)).toBe(true);
    expect(["8.8.8.8", "172.32.0.1", "2606:4700::1111"].some(isPrivateAddress)).toBe(false);
  });
  it("keeps posting text and JSON-LD, drops scripts", () => {
    const t = htmlToText('<title>AI Engineer</title><script>evil()</script><script type="application/ld+json">{"@type":"JobPosting","title":"AI Engineer"}</script><p>Build agents.</p>');
    expect(t).toContain("Page title: AI Engineer");
    expect(t).toContain("JobPosting");
    expect(t).toContain("Build agents.");
    expect(t).not.toContain("evil");
  });
});
