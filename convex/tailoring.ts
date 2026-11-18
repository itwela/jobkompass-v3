import { v } from "convex/values";

/** What chat's tailoring did to a resume. Stored on resumes.tailoring (optional). */
export const tailoringValidator = v.object({
  jobId: v.optional(v.id("jobs")),
  jobTitle: v.optional(v.string()),
  jobCompany: v.optional(v.string()),
  baseResumeId: v.optional(v.id("resumes")),
  baseResumeName: v.optional(v.string()),
  pages: v.optional(v.number()),
  changes: v.array(v.object({ section: v.string(), title: v.string(), note: v.string() })),
  marks: v.optional(v.object({
    summary: v.boolean(),
    skills: v.boolean(),
    experience: v.array(v.number()),
    projects: v.array(v.number()),
  })),
  mustHaves: v.optional(v.object({
    total: v.number(),
    met: v.array(v.string()),
    missing: v.array(v.string()),
    // Each met must-have with the resume line that evidences it (lib/chat/mustHaves.ts).
    matched: v.optional(v.array(v.object({ term: v.string(), evidence: v.string() }))),
  })),
});
