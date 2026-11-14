import { describe, expect, it } from "vitest";
import { scoreMustHaves } from "@/lib/chat/mustHaves";
import { traceSteps, turnArtifacts, resumeTitle } from "@/lib/chat/toolTrace";

const base = {
  personalInfo: { firstName: "Jordan", summary: "Engineer who builds Next.js apps." },
  skills: { technical: ["TypeScript", "React", "Next.js", "Node.js", "C++"] },
  experience: [{ company: "Brightline", title: "Engineer", details: ["Moved a React app to the App Router.", "Built an LLM assistant."] }],
};

describe("scoreMustHaves", () => {
  it("counts a must-have only when the person's own resume shows it", () => {
    const mh = scoreMustHaves(["TypeScript", "Next.js", "App Router", "Azure", "Copilot Studio", "MCP"], base);
    expect(mh.met).toEqual(["TypeScript", "Next.js", "App Router"]);
    expect(mh.missing).toEqual(["Azure", "Copilot Studio", "MCP"]);
    expect(mh.total).toBe(6);
  });

  it("matches whole words, tolerant of dots and symbols, and drops duplicates", () => {
    const mh = scoreMustHaves(["nextjs", "C++", "React", "react", "Java", "LLM"], base);
    expect(mh.met).toEqual(["nextjs", "C++", "React", "LLM"]);
    expect(mh.missing).toEqual(["Java"]); // "JavaScript" is not on the resume, and "Java" must not match "Java" inside another word
  });

  it("never treats the posting as evidence: an empty resume meets nothing", () => {
    expect(scoreMustHaves(["TypeScript"], {}).met).toEqual([]);
  });
});

describe("traceSteps", () => {
  it("reads the job and resume from the resume tool's tailoring when no fetch tools ran", () => {
    const steps = traceSteps([
      { name: "createResumeJakeTemplate", result: { success: true, storageId: "s1", resumeId: "r1", tailoring: { jobTitle: "GTM AI Solutions Engineer", jobCompany: "PTC", baseResumeName: "Software Engineer, base", pages: 1, changes: [{ section: "summary", title: "Summary", note: "x" }, { section: "skills", title: "Skills", note: "y" }, { section: "experience", title: "Experience", note: "z" }] } } },
    ]);
    expect(steps.map((s) => s.text)).toEqual([
      "Read job · GTM AI Solutions Engineer, PTC",
      "Read resume · Software Engineer, base",
      "Wrote resume · 1 page · 3 changes",
    ]);
    expect(steps[2].tone).toBe("ok");
  });

  it("does not repeat a job or resume the model already fetched", () => {
    const steps = traceSteps([
      { name: "getJobById", result: { success: true, job: { title: "FDE", company: "Vercel" } } },
      { name: "createResumeJakeTemplate", result: JSON.stringify({ success: true, storageId: "s", tailoring: { jobTitle: "FDE", jobCompany: "Vercel", changes: [] } }) },
    ]);
    expect(steps.map((s) => s.text)).toEqual(["Read job · FDE, Vercel", "Wrote resume · 0 changes"]);
  });

  it("marks a failed write", () => {
    expect(traceSteps([{ name: "createResumeJakeTemplate", result: { success: false } }])[0].tone).toBe("destructive");
  });
});

describe("turnArtifacts", () => {
  it("collects written resumes and letters with a storage id, skipping failures", () => {
    const a = turnArtifacts([
      { name: "createResumeJakeTemplate", result: { success: true, storageId: "s1", resumeId: "r1", fileName: "r.pdf", linkedToJob: true, tailoring: { jobTitle: "FDE", jobCompany: "Vercel", changes: [] } } },
      { name: "createResumeJakeTemplate", result: { success: false, storageId: "s2" } },
      { name: "createCoverLetterJakeTemplate", result: { success: true, storageId: "s3", coverLetterName: "Jordan Avery Cover Letter - Vercel (Nov 13, 2026 10:00 AM)" } },
    ]);
    expect(a).toHaveLength(2);
    expect(a[0]).toMatchObject({ kind: "resume", key: "r1", title: "Resume · Vercel FDE.pdf", linkedToJob: true });
    expect(a[1]).toMatchObject({ kind: "cover-letter", title: "Jordan Avery Cover Letter - Vercel.pdf" });
  });

  it("falls back to the saved resume name without its timestamp", () => {
    expect(resumeTitle(undefined, "Jordan Avery Resume - Vercel (Nov 13, 2026 10:00 AM)")).toBe("Jordan Avery Resume - Vercel.pdf");
  });
});
