import type { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { compileResumePdf } from "@/lib/onboarding/server";
import type { BulletAnswer } from "./bulletQuestions";
import {
  tailorAndSaveWith,
  type TailorAndSaveResult,
  type TailorBase,
  type TailorJob,
  type TailorStore,
} from "./tailorCore";

export {
  isPremiumRank,
  mergeAnswers,
  tailorInstructions,
  TailorFailedError,
  type TailorAndSaveResult,
  type TailorBase,
  type TailorJob,
} from "./tailorCore";

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

/** Saves through the signed-in caller's Convex client (Next.js routes). */
export function convexClientStore(convex: ConvexHttpClient): TailorStore {
  return {
    async saveAnswers(resumeId, answers) {
      await convex.mutation(api.documents.saveBulletAnswers, { resumeId, answers });
    },
    renderPdf: (content, templateId) => compileResumePdf(content, templateId),
    async storePdf(pdf) {
      const uploadUrl = await convex.mutation(api.documents.generateUploadUrl, {});
      const upload = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": "application/pdf" }, body: new Uint8Array(pdf) });
      if (!upload.ok) throw new Error(`upload failed ${upload.status}`);
      const { storageId } = (await upload.json()) as { storageId: Id<"_storage"> };
      return storageId;
    },
    insertResume: (row) => convex.mutation(api.documents.saveGeneratedResumeWithFile, row),
    async replaceResume({ resumeId, fileId, fileName, fileSize, content }) {
      await convex.mutation(api.documents.replaceResumeFile, { resumeId, newFileId: fileId, fileName, fileSize, content });
      // A rewrite in place is a paid generation: count it against the monthly limit.
      await convex.mutation(api.documents.recordResumeRerun, { resumeId });
    },
    async setTailorMeta(meta) {
      await convex.mutation(api.documents.setResumeTailorMeta, meta);
    },
  };
}

/**
 * Tailors a base resume to one job with the shared writer, renders the PDF, saves it to
 * Documents (or replaces an existing tailored resume in place) and records where it came
 * from and which questions are still open. The agent API runs the same pipeline
 * (lib/resume/tailorCore.ts) with an internal-function store.
 */
export async function tailorAndSave(input: TailorAndSaveInput): Promise<TailorAndSaveResult> {
  const { convex, ...rest } = input;
  return tailorAndSaveWith(convexClientStore(convex), rest);
}
