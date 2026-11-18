import type { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { compileResumePdf } from "@/lib/onboarding/server";
import { describeResumeChanges, type ResumeChange, type ResumeMarks } from "@/lib/onboarding/resumeChanges";
import { tailoredResumeName } from "@/lib/emailAgent/draftMessage";
import { extractMustHaves, scoreMustHaves, countPdfPages, type MustHaves } from "@/lib/chat/mustHaves";
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

export interface TailorAndSaveInput {
  convex: ConvexHttpClient;
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

export class TailorFailedError extends Error {
  constructor() {
    super("The resume could not be written this time. Try again.");
  }
}

/**
 * Tailors a base resume to one job with the shared writer, renders the PDF, saves it to
 * Documents (or replaces an existing tailored resume in place) and records where it came
 * from and which questions are still open. Every server path that writes a tailored
 * resume goes through here.
 */
export async function tailorAndSave(input: TailorAndSaveInput): Promise<TailorAndSaveResult> {
  const { convex, baseResume, job, templateId, premium } = input;
  const baseContent = (baseResume.content ?? {}) as ResumeContent;
  const newAnswers = sanitizeAnswers(input.extraAnswers);
  const answers = mergeAnswers(baseResume.bulletAnswers ?? [], newAnswers);

  // Answers are the user's facts: keep them on the base even if this write fails.
  if (baseResume._id && newAnswers.length) {
    await convex.mutation(api.documents.saveBulletAnswers, { resumeId: baseResume._id, answers: newAnswers });
  }

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

  const pdf = await compileResumePdf(content, templateId);
  const uploadUrl = await convex.mutation(api.documents.generateUploadUrl, {});
  const upload = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": "application/pdf" }, body: new Uint8Array(pdf) });
  if (!upload.ok) throw new Error(`upload failed ${upload.status}`);
  const { storageId } = (await upload.json()) as { storageId: Id<"_storage"> };
  const pages = await countPdfPages(new Uint8Array(pdf));

  const named = tailoredResumeName({ content, company: job.company, role: job.title });
  const fileName = input.replaceFileName || named.fileName;
  const tailoring = {
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
    resumeId = input.replaceResumeId;
    await convex.mutation(api.documents.replaceResumeFile, {
      resumeId,
      newFileId: storageId,
      fileName,
      fileSize: pdf.length,
      content,
    });
    // A rewrite in place is a paid generation: count it against the monthly limit.
    await convex.mutation(api.documents.recordResumeRerun, { resumeId });
  } else {
    resumeId = await convex.mutation(api.documents.saveGeneratedResumeWithFile, {
      name: named.displayName,
      fileId: storageId,
      fileName,
      fileSize: pdf.length,
      content,
      template: templateId,
      tailoring,
    });
  }

  await convex
    .mutation(api.documents.setResumeTailorMeta, {
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
    model: tailored.model,
  };
}
