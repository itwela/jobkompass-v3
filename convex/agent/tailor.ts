"use node";

/**
 * Model-backed resume work for the agent API. Node runtime because the tailoring
 * engine's fact guard (lib/resume/noInventedFacts.ts) imports node:fs.
 * Every action here takes an explicit userId and re-checks ownership through the
 * owned-by-user queries in ./fns.
 */
import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { tailorResume } from "../../lib/resume/tailorResume";
import type { BulletAnswer, BulletQuestion } from "../../lib/resume/bulletQuestions";
import type { ResumeScorecard } from "../../lib/resume/scorecard";
import { consumeOrFailOpen } from "../rateLimit";
import { RATE_LIMIT_FRIENDLY } from "../rateLimitConfig";
import { pointQuestionsAt, scorecardFor, storedToAnswers, QUESTIONS_RULE } from "./resumeQuestions";
import type { TailorStore } from "../../lib/resume/tailorCore";
import { exportResumePdf } from "./resumePdf";
import { agentTailor } from "./tailorFlow";

function requireModelKey(): void {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error(
      "AI questions/tailoring unavailable: OPENROUTER_API_KEY is not set on the JobKompass server. Omit --ai to get the built-in questions instead."
    );
  }
}

async function spendAi(ctx: any, userId: string): Promise<void> {
  const limit = await consumeOrFailOpen(ctx, "ai", userId);
  if (!limit.ok) throw new Error(`Rate limited: ${RATE_LIMIT_FRIENDLY}`);
}

/**
 * Questions from the model about the SUBMITTED content. The model's rewrite is
 * thrown away: on this path the calling agent is the writer.
 */
export const modelQuestions = internalAction({
  args: {
    userId: v.string(),
    content: v.any(),
    company: v.optional(v.string()),
    role: v.optional(v.string()),
    jobDescription: v.optional(v.string()),
    answers: v.optional(v.any()),
  },
  handler: async (ctx, args): Promise<BulletQuestion[]> => {
    requireModelKey();
    await spendAi(ctx, args.userId);
    const answers: BulletAnswer[] = storedToAnswers(args.answers);
    const result = await tailorResume({
      baseContent: args.content,
      company: args.company || "the target company",
      role: args.role || "the target role",
      jobDescription: args.jobDescription,
      answers,
      premium: true, // the CLI is gated to Pro
    });
    if (!result) throw new Error("AI questions failed: the resume writer returned no usable output. Retry, or omit --ai.");
    return pointQuestionsAt(args.content, result.questions, answers);
  },
});

/** Internal-function storage for the shared tailor pipeline (lib/resume/tailorCore.ts). */
function agentStore(ctx: any, userId: string, rank: () => Promise<number>): TailorStore {
  return {
    async saveAnswers(resumeId, answers) {
      await ctx.runMutation(internal.documents.saveBulletAnswersInternal, { userId, resumeId, answers });
    },
    async renderPdf(content, templateId) {
      return new Uint8Array(await exportResumePdf(content, templateId, await rank()));
    },
    storePdf: (pdf) => ctx.storage.store(new Blob([pdf], { type: "application/pdf" })),
    insertResume: (row) => ctx.runMutation(internal.agent.fns.resumesInsertGenerated, { userId, ...row }),
    async setTailorMeta(meta) {
      await ctx.runMutation(internal.documents.setResumeTailorMetaInternal, { userId, ...meta });
    },
  };
}

/**
 * Server-side tailoring: base resume + saved job + the base's stored answers in,
 * a NEW tailored resume (PDF) out, with the questions that would still make it
 * stronger. Same pipeline and saved result as the in-app tailor. The base resume is
 * never modified.
 */
export const resumesTailor = internalAction({
  args: {
    userId: v.string(),
    base: v.id("resumes"),
    jobId: v.id("jobs"),
    template: v.optional(v.string()),
    instructions: v.optional(v.string()),
    preferences: v.optional(v.any()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    id: Id<"resumes">;
    name: string;
    fileName: string;
    fileUrl: string | null;
    template: string;
    notice?: string;
    baseResumeId: Id<"resumes">;
    requestedBase: Id<"resumes">;
    jobId: Id<"jobs">;
    model: string;
    resume: any;
    questions: BulletQuestion[];
    scorecard: ResumeScorecard;
    baseScorecard: ResumeScorecard;
    changes: unknown[];
    marks: unknown;
    mustHaves: unknown;
    pages?: number;
    instructionsUsed: number;
    answersUsed: number;
    rule: string;
  }> => {
    requireModelKey();
    let rank: number | undefined;
    const settingsOnce = async () => ctx.runQuery(internal.agent.fns.tailorSettings, { userId: args.userId });
    const out = await agentTailor(
      {
        // Ownership: both queries throw "... not found" for another user's record.
        getResume: (id) => ctx.runQuery(internal.agent.fns.resumesGet, { userId: args.userId, id }),
        getJob: (id) => ctx.runQuery(internal.agent.fns.jobsGet, { userId: args.userId, id }),
        settings: async () => {
          const s = await settingsOnce();
          rank = s.rank;
          return s;
        },
        canGenerate: () => ctx.runQuery(internal.agent.fns.resumesCanGenerate, { userId: args.userId }),
        spendAi: () => spendAi(ctx, args.userId),
        store: agentStore(ctx, args.userId, async () => rank ?? (await settingsOnce()).rank),
        setJobResumeUsed: async (id, resumeUsed) => {
          await ctx.runMutation(internal.agent.fns.jobsUpdate, { userId: args.userId, id, resumeUsed });
        },
        fileUrl: (storageId) => ctx.storage.getUrl(storageId),
      },
      {
        base: args.base,
        jobId: args.jobId,
        template: args.template,
        instructions: args.instructions,
        preferences: args.preferences,
      }
    );
    const { result, job, baseRow } = out;

    return {
      id: result.resumeId,
      name: result.displayName,
      fileName: result.fileName,
      fileUrl: out.fileUrl,
      template: out.template,
      ...(out.notice ? { notice: out.notice } : {}),
      baseResumeId: out.base,
      requestedBase: args.base,
      jobId: args.jobId,
      model: result.model,
      resume: result.content,
      questions: result.questions,
      scorecard: result.scorecard,
      baseScorecard: scorecardFor(baseRow.content, job),
      changes: result.changes,
      marks: result.marks,
      mustHaves: result.mustHaves,
      pages: result.pages,
      instructionsUsed: out.instructions.length,
      answersUsed: storedToAnswers(baseRow.bulletAnswers).length,
      rule: QUESTIONS_RULE,
    };
  },
});
