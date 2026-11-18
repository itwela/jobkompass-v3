import { NextRequest, NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { enforceAiRateLimit } from "@/lib/rateLimit/guard";
import { convexForCaller } from "@/lib/onboarding/server";
import { isPremiumRank, tailorAndSave, TailorFailedError } from "@/lib/resume/tailorServer";
import { pickTailorTemplate } from "@/lib/resume/tailorCore";

export const maxDuration = 300;

/**
 * Onboarding step 3: tailor the base resume to the saved job, render the PDF,
 * save it to Documents (one AI document) and say what changed.
 */
export async function POST(request: NextRequest) {
  const limited = await enforceAiRateLimit(request, "ai");
  if (limited) return limited;

  const convex = await convexForCaller();
  if (!convex) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const { jobId } = (await request.json().catch(() => ({}))) as { jobId?: string };
  if (!jobId) return NextResponse.json({ error: "Save a job first." }, { status: 400 });

  try {
    const [job, resumes, can, rank] = await Promise.all([
      convex.query(api.jobs.get, { id: jobId as Id<"jobs"> }),
      convex.query(api.documents.listResumes, {}),
      convex.query(api.usage.canGenerateDocument, {}),
      convex.query(api.usage.currentPlanRank, {}),
    ]);
    if (!job) return NextResponse.json({ error: "That job is no longer saved." }, { status: 404 });
    const base = resumes.find((r) => r.isActive && r.content) ?? resumes.find((r) => r.content);
    if (!base?.content) return NextResponse.json({ code: "no_base", error: "Add your resume first." }, { status: 400 });
    if (can && can.allowed === false) {
      return NextResponse.json({ code: "limit", error: `You have used all ${can.limit} AI documents this month.` }, { status: 402 });
    }

    // The default template from Settings wins, then the base resume's own template, then Jake.
    // getDefaultTemplate already drops a template above the user's plan.
    const preferred = await convex.query(api.auth.getDefaultTemplate, {}).catch(() => null);
    const templateId = pickTailorTemplate({ accountDefault: preferred, baseTemplate: base.template, rank });

    const result = await tailorAndSave({
      convex,
      baseResume: base,
      job,
      templateId,
      premium: isPremiumRank(rank),
    });
    await convex.mutation(api.jobs.update, { id: job._id, resumeUsed: result.displayName }).catch(() => undefined);

    return NextResponse.json({
      resumeId: result.resumeId,
      storageId: result.storageId,
      fileName: result.fileName,
      content: result.content,
      changes: result.changes,
      marks: result.marks,
      job: { title: job.title, company: job.company },
      questions: result.questions,
      scorecard: result.scorecard,
    });
  } catch (error) {
    if (error instanceof TailorFailedError) return NextResponse.json({ error: error.message }, { status: 502 });
    console.error("[onboarding/tailor]", error instanceof Error ? error.message.slice(0, 300) : error);
    return NextResponse.json({ error: "The resume could not be written this time. Try again." }, { status: 500 });
  }
}
