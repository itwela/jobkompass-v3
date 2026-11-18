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

const CONTENT_KEYS = [
  "personalInfo", "education", "experience", "projects", "skills", "certifications",
  "internships", "coreCompetencies", "earlyCareer", "additionalInfo",
] as const;

/**
 * Server-side tailoring: base resume + saved job + the base's stored answers in,
 * a NEW tailored resume (PDF) out, with the questions that would still make it
 * stronger. The base resume is never modified.
 */
export const resumesTailor = internalAction({
  args: {
    userId: v.string(),
    base: v.id("resumes"),
    jobId: v.id("jobs"),
    template: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    id: Id<"resumes">;
    name: string;
    fileUrl: string | null;
    baseResumeId: Id<"resumes">;
    jobId: Id<"jobs">;
    model: string;
    resume: any;
    questions: BulletQuestion[];
    scorecard: ResumeScorecard;
    baseScorecard: ResumeScorecard;
    answersUsed: number;
    rule: string;
  }> => {
    requireModelKey();
    // Ownership: both queries throw "... not found" for another user's record.
    const base: any = await ctx.runQuery(internal.agent.fns.resumesGet, { userId: args.userId, id: args.base });
    const job: any = await ctx.runQuery(internal.agent.fns.jobsGet, { userId: args.userId, id: args.jobId });
    if (!base?.content) throw new Error("Resume has no structured content to tailor. Pick a resume created by JobKompass (jk resumes get shows content).");

    // Check the monthly document quota BEFORE spending a model call.
    const canGenerate = await ctx.runQuery(internal.agent.fns.resumesCanGenerate, { userId: args.userId });
    if (!canGenerate.allowed) {
      throw new Error(`Limit reached: you've used ${canGenerate.used} of ${canGenerate.limit} documents this month.`);
    }
    await spendAi(ctx, args.userId);

    const answers = storedToAnswers(base.bulletAnswers);
    const result = await tailorResume({
      baseContent: base.content,
      company: job.company,
      role: job.title,
      jobDescription: job.description,
      answers,
      premium: true,
    });
    if (!result) throw new Error("Tailoring failed: the resume writer returned no usable output. Retry in a minute.");

    const tailored = result.resume ?? {};
    const contentArgs: Record<string, unknown> = {};
    for (const k of CONTENT_KEYS) {
      const value = tailored[k] ?? base.content[k];
      if (value !== undefined && value !== null) contentArgs[k] = value;
    }
    if (!contentArgs.personalInfo) contentArgs.personalInfo = base.content.personalInfo ?? {};

    const generated: { id: Id<"resumes">; name: string; fileUrl: string | null } = await ctx.runAction(
      internal.agent.fns.resumesGenerate,
      {
        userId: args.userId,
        ...(contentArgs as any),
        targetCompany: job.company,
        template: args.template || base.template || "jake",
        skipQuestions: true,
      }
    );

    await ctx.runMutation(internal.documents.setResumeTailorMetaInternal, {
      userId: args.userId,
      resumeId: generated.id,
      tailoredFrom: { baseResumeId: args.base, jobId: args.jobId },
      pendingQuestions: result.questions,
    });

    return {
      ...generated,
      baseResumeId: args.base,
      jobId: args.jobId,
      model: result.model,
      resume: tailored,
      questions: result.questions,
      scorecard: scorecardFor(tailored, job),
      baseScorecard: scorecardFor(base.content, job),
      answersUsed: answers.length,
      rule: QUESTIONS_RULE,
    };
  },
});
