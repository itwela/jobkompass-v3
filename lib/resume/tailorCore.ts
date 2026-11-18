/**
 * The tailor-and-save pipeline shared by every server path that writes a tailored resume:
 * the Next.js routes (via ./tailorServer, signed-in Convex client) and the agent API
 * (convex/agent/tailor.ts, internal functions with an explicit userId). Only storage and
 * PDF rendering differ between them, so those come in as a TailorStore.
 *
 * Relative imports only: this file is bundled into Convex node actions too.
 */
import type { Id } from "../../convex/_generated/dataModel";
import { describeResumeChanges, type ResumeChange, type ResumeMarks } from "../onboarding/resumeChanges";
import { tailoredResumeName } from "../emailAgent/draftMessage";
import { extractMustHaves, scoreMustHaves, countPdfPages, type MustHaves } from "../chat/mustHaves";
import { canUseResumeTemplate } from "../templates";
import type { PlanRank } from "../../convex/plans";
import { sanitizeAnswers, type BulletAnswer, type BulletQuestion } from "./bulletQuestions";
import { scoreResume, type ResumeScorecard } from "./scorecard";
import { tailorResume } from "./tailorResume";
import type { ResumeContent } from "./types";

/** The base resume row (or an unsaved upload) that a tailored copy is written from. */
export interface TailorBase {
  _id?: Id<"resumes">;
  name?: string;
  content?: any;
  bulletAnswers?: Array<BulletAnswer & { answeredAt?: number }>;
}

export interface TailorJob {
  _id?: Id<"jobs">;
  title: string;
  company: string;
  description?: string;
  skills?: string[];
  keywords?: string[];
}

/** What resumes.tailoring stores; the Documents UI tints changed sections from it. */
export interface TailoringRecord {
  jobId?: Id<"jobs">;
  jobTitle?: string;
  jobCompany?: string;
  baseResumeId?: Id<"resumes">;
  baseResumeName?: string;
  pages?: number;
  changes: ResumeChange[];
  marks?: ResumeMarks;
  mustHaves?: MustHaves;
}

export interface PendingQuestion {
  id: string;
  section: BulletQuestion["section"];
  index: number;
  bullet: string;
  question: string;
  example?: string;
}

/** Where a tailored resume gets rendered and saved. */
export interface TailorStore {
  saveAnswers(baseResumeId: Id<"resumes">, answers: BulletAnswer[]): Promise<void>;
  renderPdf(content: ResumeContent, templateId: string): Promise<Uint8Array>;
  storePdf(pdf: Uint8Array): Promise<Id<"_storage">>;
  insertResume(row: {
    name: string;
    fileId: Id<"_storage">;
    fileName: string;
    fileSize: number;
    content: ResumeContent;
    template: string;
    tailoring: TailoringRecord;
  }): Promise<Id<"resumes">>;
  /** Only needed by callers that pass replaceResumeId. Also counts the re-run against the monthly limit. */
  replaceResume?(row: {
    resumeId: Id<"resumes">;
    fileId: Id<"_storage">;
    fileName: string;
    fileSize: number;
    content: ResumeContent;
  }): Promise<void>;
  setTailorMeta(meta: {
    resumeId: Id<"resumes">;
    tailoredFrom?: { baseResumeId: Id<"resumes">; jobId?: Id<"jobs"> };
    pendingQuestions: PendingQuestion[];
  }): Promise<void>;
}

export interface TailorCoreInput {
  baseResume: TailorBase;
  job: TailorJob;
  templateId: string;
  premium: boolean;
  /** Answers given in this request. Saved onto the base resume and used together with the stored ones. */
  extraAnswers?: BulletAnswer[];
  /** Preferences and one-off instructions: wording and emphasis only, never facts. */
  instructions?: string[];
  /** Re-run for an existing tailored resume: replace its content and PDF in place. */
  replaceResumeId?: Id<"resumes">;
  /** Display name of a resume being replaced, so a re-run keeps its name. */
  replaceFileName?: string;
}

export interface TailorAndSaveResult {
  resumeId: Id<"resumes">;
  storageId: Id<"_storage">;
  fileName: string;
  displayName: string;
  content: ResumeContent;
  questions: BulletQuestion[];
  scorecard: ResumeScorecard;
  mustHaves: MustHaves;
  changes: ResumeChange[];
  marks: ResumeMarks;
  pages?: number;
  model: string;
}

/** Plan rank 1 (starter) and above gets the stronger writer. */
export function isPremiumRank(rank: unknown): boolean {
  return typeof rank === "number" && rank >= 1;
}

/** Stored answers plus new ones; a newer answer about the same bullet wins. */
export function mergeAnswers(stored: unknown, extra: unknown): BulletAnswer[] {
  const out = new Map<string, BulletAnswer>();
  const key = (a: BulletAnswer) => `${a.section}|${a.index}|${a.bullet.replace(/\s+/g, " ").trim().toLowerCase()}`;
  for (const a of [...sanitizeAnswers(stored), ...sanitizeAnswers(extra)]) out.set(key(a), a);
  return [...out.values()];
}

/** Saved resume preferences first, then this request's one-off instruction, as the app sends them. */
export function tailorInstructions(preferences: unknown, oneOff?: string | null): string[] {
  const prefs = Array.isArray(preferences) ? preferences.filter((p): p is string => typeof p === "string") : [];
  const extra = typeof oneOff === "string" ? oneOff.trim() : "";
  return [...prefs, ...(extra ? [extra] : [])];
}

/**
 * Template for a new tailored resume: an explicit choice, then the account default from
 * Settings (already dropped when above the plan), then the base resume's own template when
 * the plan allows it, then Jake.
 */
export function pickTailorTemplate(input: {
  explicit?: string | null;
  accountDefault?: string | null;
  baseTemplate?: string | null;
  rank: unknown;
}): string {
  if (input.explicit) return input.explicit;
  if (input.accountDefault) return input.accountDefault;
  const rank = (typeof input.rank === "number" ? input.rank : 0) as PlanRank;
  if (input.baseTemplate && canUseResumeTemplate(input.baseTemplate, rank)) return input.baseTemplate;
  return "jake";
}

/** The original base a resume was tailored from, or undefined when it is not a tailored copy. */
export function originalBaseId(row: {
  tailoredFrom?: { baseResumeId?: Id<"resumes"> } | null;
  tailoring?: { baseResumeId?: Id<"resumes"> } | null;
}): Id<"resumes"> | undefined {
  return row.tailoredFrom?.baseResumeId ?? row.tailoring?.baseResumeId ?? undefined;
}

export class TailorFailedError extends Error {
  constructor() {
    super("The resume could not be written this time. Try again.");
  }
}

/**
 * Tailors a base resume to one job with the shared writer, renders the PDF, saves it to
 * Documents (or replaces an existing tailored resume in place) and records where it came
 * from and which questions are still open.
 */
export async function tailorAndSaveWith(store: TailorStore, input: TailorCoreInput): Promise<TailorAndSaveResult> {
  const { baseResume, job, templateId, premium } = input;
  const baseContent = (baseResume.content ?? {}) as ResumeContent;
  const newAnswers = sanitizeAnswers(input.extraAnswers);
  const answers = mergeAnswers(baseResume.bulletAnswers ?? [], newAnswers);

  // Answers are the user's facts: keep them on the base even if this write fails.
  if (baseResume._id && newAnswers.length) await store.saveAnswers(baseResume._id, newAnswers);

  const [tailored, mustHaveTerms] = await Promise.all([
    tailorResume({
      baseContent,
      company: job.company,
      role: job.title,
      jobDescription: job.description,
      answers,
      premium,
      instructions: input.instructions,
    }),
    extractMustHaves(job).catch(() => [] as string[]),
  ]);
  if (!tailored) throw new TailorFailedError();

  const content = tailored.resume as ResumeContent;
  // Must-haves count only when the candidate's own resume (plus their answers) shows them.
  const mustHaves = scoreMustHaves(mustHaveTerms, { base: baseContent, answers: answers.map((a) => a.answer) });
  const scorecard = scoreResume(content, { mustHaves });
  const { changes, marks } = describeResumeChanges(baseContent, content, { role: job.title });

  const pdf = await store.renderPdf(content, templateId);
  const storageId = await store.storePdf(pdf);
  const pages = await countPdfPages(new Uint8Array(pdf));

  const named = tailoredResumeName({ content, company: job.company, role: job.title });
  const fileName = input.replaceFileName || named.fileName;
  const tailoring: TailoringRecord = {
    jobId: job._id,
    jobTitle: job.title,
    jobCompany: job.company,
    baseResumeId: baseResume._id,
    baseResumeName: baseResume.name,
    pages,
    changes,
    marks,
    mustHaves,
  };

  let resumeId: Id<"resumes">;
  if (input.replaceResumeId) {
    if (!store.replaceResume) throw new Error("This caller cannot replace a resume in place.");
    resumeId = input.replaceResumeId;
    await store.replaceResume({ resumeId, fileId: storageId, fileName, fileSize: pdf.length, content });
  } else {
    resumeId = await store.insertResume({
      name: named.displayName,
      fileId: storageId,
      fileName,
      fileSize: pdf.length,
      content,
      template: templateId,
      tailoring,
    });
  }

  await store
    .setTailorMeta({
      resumeId,
      ...(baseResume._id ? { tailoredFrom: { baseResumeId: baseResume._id, ...(job._id ? { jobId: job._id } : {}) } } : {}),
      pendingQuestions: tailored.questions.map((q) => ({
        id: q.id,
        section: q.section,
        index: q.index,
        bullet: q.bullet,
        question: q.question,
        ...(q.example ? { example: q.example } : {}),
      })),
    })
    .catch((e: unknown) => console.warn("[tailorAndSave] tailor meta not saved", e instanceof Error ? e.message.slice(0, 200) : e));

  return {
    resumeId,
    storageId,
    fileName,
    displayName: named.displayName,
    content,
    questions: tailored.questions,
    scorecard,
    mustHaves,
    changes,
    marks,
    pages,
    model: tailored.model,
  };
}
