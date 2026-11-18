import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { enforceAiRateLimit } from "@/lib/rateLimit/guard";
import { convexForCaller } from "@/lib/onboarding/server";
import { sanitizeAnswers } from "@/lib/resume/bulletQuestions";
import { isPremiumRank, tailorAndSave, TailorFailedError, type TailorJob } from "@/lib/resume/tailorServer";
import { canUseResumeTemplate } from "@/lib/templates";
import type { PlanRank } from "@/convex/plans";

export const maxDuration = 300;

const bodySchema = z.object({
  resumeId: z.string().min(1),
  answers: z
    .array(
      z.object({
        section: z.enum(["experience", "projects"]),
        index: z.number().int().min(0),
        bullet: z.string(),
        answer: z.string(),
      }),
    )
    .min(1)
    .max(20),
});

/**
 * The user answered questions about a tailored resume. Save the answers on its base
 * resume (so every later resume reuses them), re-tailor with all stored answers, and
 * replace the tailored resume's content and PDF in place.
 */
export async function POST(request: NextRequest) {
  const limited = await enforceAiRateLimit(request, "ai");
  if (limited) return limited;

  const convex = await convexForCaller();
  if (!convex) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Send a resume and at least one answer." }, { status: 400 });
  const answers = sanitizeAnswers(parsed.data.answers);
  if (!answers.length) return NextResponse.json({ error: "Write an answer first." }, { status: 400 });

  try {
    const resumeId = parsed.data.resumeId as Id<"resumes">;
    const tailored = await convex.query(api.documents.getResume, { resumeId }).catch(() => null);
    if (!tailored) return NextResponse.json({ error: "That resume is no longer saved." }, { status: 404 });

    const baseResumeId = tailored.tailoredFrom?.baseResumeId ?? tailored.tailoring?.baseResumeId;
    if (!baseResumeId) {
      return NextResponse.json({ code: "not_tailored", error: "This resume was not tailored to a job, so there is nothing to rewrite." }, { status: 400 });
    }
    const base = await convex.query(api.documents.getResume, { resumeId: baseResumeId }).catch(() => null);
    if (!base?.content) return NextResponse.json({ code: "no_base", error: "The resume this one came from is no longer saved." }, { status: 404 });

    const jobId = tailored.tailoredFrom?.jobId ?? tailored.tailoring?.jobId;
    const savedJob = jobId ? await convex.query(api.jobs.get, { id: jobId }).catch(() => null) : null;
    const job: TailorJob | null = savedJob
      ? { _id: savedJob._id, title: savedJob.title, company: savedJob.company, description: savedJob.description, skills: (savedJob as any).skills, keywords: (savedJob as any).keywords }
      : tailored.tailoring?.jobTitle && tailored.tailoring?.jobCompany
        ? { title: tailored.tailoring.jobTitle, company: tailored.tailoring.jobCompany }
        : null;
    if (!job) return NextResponse.json({ code: "no_job", error: "The job this resume was written for is no longer saved." }, { status: 404 });

    // A re-run is a new AI document, so it is held to the same monthly limit as a generation.
    const [can, rank] = await Promise.all([
      convex.query(api.usage.canGenerateDocument, {}),
      convex.query(api.usage.currentPlanRank, {}),
    ]);
    if (can && can.allowed === false) {
      return NextResponse.json({ code: "limit", error: `You have used all ${can.limit} AI documents this month.`, limitReached: true }, { status: 402 });
    }

    const templateId = tailored.template && canUseResumeTemplate(tailored.template, rank as PlanRank) ? tailored.template : "jake";
    const result = await tailorAndSave({
      convex,
      baseResume: base,
      job,
      templateId,
      premium: isPremiumRank(rank),
      extraAnswers: answers,
      replaceResumeId: resumeId,
      replaceFileName: tailored.fileName,
    });

    return NextResponse.json({
      resumeId: result.resumeId,
      content: result.content,
      questions: result.questions,
      scorecard: result.scorecard,
      changes: result.changes,
      marks: result.marks,
    });
  } catch (error) {
    if (error instanceof TailorFailedError) return NextResponse.json({ error: error.message }, { status: 502 });
    console.error("[resume/answers]", error instanceof Error ? error.message.slice(0, 300) : error);
    return NextResponse.json({ error: "The resume could not be rewritten this time. Try again." }, { status: 500 });
  }
}
