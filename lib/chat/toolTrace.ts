import type { ResumeChange, ResumeMarks } from "@/lib/onboarding/resumeChanges";
import type { MustHaves } from "@/lib/chat/mustHaves";
import type { BulletQuestion } from "@/lib/resume/bulletQuestions";

export interface ChatToolCall {
  name: string;
  arguments?: unknown;
  result?: unknown;
}

/** One line of the step trace under "JobKompass". `tone` picks the tick colour. */
export interface TraceStep {
  tone: "bar-1" | "bar-2" | "bar-3" | "bar-4" | "ok" | "destructive";
  text: string;
}

export interface ResumeTailoring {
  jobId?: string;
  jobTitle?: string;
  jobCompany?: string;
  baseResumeId?: string;
  baseResumeName?: string;
  pages?: number;
  changes: ResumeChange[];
  marks?: ResumeMarks;
  mustHaves?: MustHaves;
}

/** A document the chat wrote, as the result card and Artifacts panel need it. */
export interface ChatArtifact {
  kind: "resume" | "cover-letter";
  /** Stable key: the resume id, or the storage id for a letter. */
  key: string;
  resumeId?: string;
  storageId?: string;
  fileName: string;
  /** Display name, e.g. "Resume · PTC GTM AI Solutions Engineer.pdf". */
  title: string;
  seconds?: number;
  tailoring?: ResumeTailoring;
  linkedToJob?: boolean;
  /** Questions about bullets missing a number; answers rewrite this resume. */
  questions?: BulletQuestion[];
  /** Writing-standard readout (lib/resume/scorecard.ts shape), when the tool returned one. */
  scorecard?: { bullets: number; quantified: number; dutyStyle: number; quantifiedPct: number; mustHaves?: { met: number; total: number; missing: string[]; matched?: { term: string; evidence: string }[] } };
}

/** Tool results arrive in a few shapes depending on how the run was serialised. */
export function unwrapToolResult(result: unknown): Record<string, any> {
  let payload: any = result ?? {};
  if (typeof payload === "string") {
    try { payload = JSON.parse(payload); } catch { return {}; }
  } else if (payload?.text && typeof payload.text === "string") {
    try { payload = JSON.parse(payload.text); } catch { /* keep */ }
  } else if (payload?.output) {
    payload = payload.output;
  } else if (payload?.data) {
    payload = payload.data;
  }
  if (typeof payload === "string") {
    try { payload = JSON.parse(payload); } catch { return {}; }
  }
  return payload && typeof payload === "object" ? payload : {};
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "GTM AI Solutions Engineer, PTC" */
function jobLabel(title?: string, company?: string) {
  return [title, company].filter(Boolean).join(", ");
}

/** Trace lines for one assistant turn, in the order the tools ran. */
export function traceSteps(calls: ChatToolCall[] | undefined): TraceStep[] {
  const steps: TraceStep[] = [];
  let readJob = false;
  let readResume = false;
  for (const call of calls ?? []) {
    const r = unwrapToolResult(call.result);
    const failed = r.success === false;
    switch (call.name) {
      case "getJobById":
        if (r.job) { steps.push({ tone: "bar-1", text: `Read job · ${jobLabel(r.job.title, r.job.company)}` }); readJob = true; }
        break;
      case "getResumeById":
        if (r.resume) { steps.push({ tone: "bar-2", text: `Read resume · ${r.resume.name || "Untitled"}` }); readResume = true; }
        break;
      case "getUserJobs":
        steps.push({ tone: "bar-1", text: Array.isArray(r.jobs) ? `Read My Jobs · ${plural(r.jobs.length, "job")}` : "Read My Jobs" });
        break;
      case "getUserResumes":
        steps.push({ tone: "bar-2", text: Array.isArray(r.resumes) ? `Read My Documents · ${plural(r.resumes.length, "resume")}` : "Read My Documents" });
        break;
      case "getUserResumePreferences":
        steps.push({ tone: "bar-3", text: "Read resume preferences" });
        break;
      case "getUserUsage":
        steps.push({ tone: "bar-3", text: "Checked plan usage" });
        break;
      case "addJobToTracker":
        steps.push(failed ? { tone: "destructive", text: "Could not save the job" } : { tone: "ok", text: "Saved job · My Jobs" });
        break;
      case "addResourceToLibrary":
        steps.push(failed ? { tone: "destructive", text: "Could not save the link" } : { tone: "ok", text: "Saved link · Links & Resources" });
        break;
      case "createResumeJakeTemplate": {
        if (failed) { steps.push({ tone: "destructive", text: "Could not write the resume" }); break; }
        const t = r.tailoring as ResumeTailoring | undefined;
        if (t?.jobTitle && !readJob) steps.push({ tone: "bar-1", text: `Read job · ${jobLabel(t.jobTitle, t.jobCompany)}` });
        if (t?.baseResumeName && !readResume) steps.push({ tone: "bar-2", text: `Read resume · ${t.baseResumeName}` });
        const parts = ["Wrote resume"];
        if (t?.pages) parts.push(plural(t.pages, "page"));
        if (t) parts.push(plural(t.changes.length, "change"));
        steps.push({ tone: "ok", text: parts.join(" · ") });
        break;
      }
      case "createCoverLetterJakeTemplate":
        steps.push(failed ? { tone: "destructive", text: "Could not write the cover letter" } : { tone: "ok", text: "Wrote cover letter" });
        break;
      case "web_search":
      case "web_search_call":
        steps.push({ tone: "bar-3", text: "Searched the web" });
        break;
      default:
        steps.push({ tone: "bar-3", text: call.name.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()) });
    }
  }
  return steps;
}

/** "Resume · PTC GTM AI Solutions Engineer.pdf" */
export function resumeTitle(t: ResumeTailoring | undefined, fallback?: string) {
  if (t?.jobTitle || t?.jobCompany) return `Resume · ${[t.jobCompany, t.jobTitle].filter(Boolean).join(" ")}.pdf`;
  return fallback ? `${fallback.replace(/\s*\([^)]*\)\s*$/, "")}.pdf` : "Resume.pdf";
}

/** Documents one assistant turn wrote. */
export function turnArtifacts(calls: ChatToolCall[] | undefined): ChatArtifact[] {
  const out: ChatArtifact[] = [];
  for (const call of calls ?? []) {
    const r = unwrapToolResult(call.result);
    if (r.success === false || !r.storageId) continue;
    if (call.name === "createResumeJakeTemplate") {
      const t = r.tailoring as ResumeTailoring | undefined;
      out.push({
        kind: "resume",
        key: String(r.resumeId ?? r.storageId),
        resumeId: r.resumeId,
        storageId: r.storageId,
        fileName: r.fileName || "resume.pdf",
        title: resumeTitle(t, r.resumeName),
        seconds: typeof r.seconds === "number" ? r.seconds : undefined,
        tailoring: t,
        linkedToJob: !!r.linkedToJob,
        questions: Array.isArray(r.questions) ? r.questions : [],
        ...(r.scorecard && typeof r.scorecard === "object" ? { scorecard: r.scorecard } : {}),
      });
    } else if (call.name === "createCoverLetterJakeTemplate") {
      out.push({
        kind: "cover-letter",
        key: String(r.storageId),
        storageId: r.storageId,
        fileName: r.fileName || "cover-letter.pdf",
        title: `${(r.coverLetterName as string | undefined)?.replace(/\s*\([^)]*\)\s*$/, "") || "Cover letter"}.pdf`,
      });
    }
  }
  return out;
}
