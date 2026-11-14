import { NextRequest, NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { enforceAiRateLimit } from "@/lib/rateLimit/guard";
import { convexForCaller, compileResumePdf } from "@/lib/onboarding/server";
import { tailorResumeContent, tailoredResumeName } from "@/lib/emailAgent/draftMessage";
import { describeResumeChanges } from "@/lib/onboarding/resumeChanges";
import { canUseResumeTemplate } from "@/lib/templates";
import type { PlanRank } from "@/convex/plans";
import type { ResumeContent } from "@/lib/resume/types";

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

    const baseContent = base.content as ResumeContent;
    const tailored = (await tailorResumeContent({
      baseContent,
      company: job.company,
      role: job.title,
      jobDescription: job.description,
    })) as ResumeContent | null;
    if (!tailored) return NextResponse.json({ error: "The resume could not be written this time. Try again." }, { status: 502 });

    // The default template from Settings wins, then the base resume's own template, then Jake.
    // getDefaultTemplate already drops a template above the user's plan.
    const preferred = await convex.query(api.auth.getDefaultTemplate, {}).catch(() => null);
    const templateId = preferred
      ?? (base.template && canUseResumeTemplate(base.template, rank as PlanRank) ? base.template : "jake");
    const pdf = await compileResumePdf(tailored, templateId);
    const uploadUrl = await convex.mutation(api.documents.generateUploadUrl, {});
    const upload = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": "application/pdf" }, body: new Uint8Array(pdf) });
    if (!upload.ok) throw new Error(`upload failed ${upload.status}`);
    const { storageId } = (await upload.json()) as { storageId: Id<"_storage"> };
    const { displayName, fileName } = tailoredResumeName({ content: tailored, company: job.company, role: job.title });
    const resumeId = await convex.mutation(api.documents.saveGeneratedResumeWithFile, {
      name: displayName,
      fileId: storageId,
      fileName,
      fileSize: pdf.length,
      content: tailored,
      template: templateId,
    });
    await convex.mutation(api.jobs.update, { id: job._id, resumeUsed: displayName }).catch(() => undefined);

    const { changes, marks } = describeResumeChanges(baseContent, tailored, { role: job.title });
    return NextResponse.json({ resumeId, storageId, fileName, content: tailored, changes, marks, job: { title: job.title, company: job.company } });
  } catch (error) {
    console.error("[onboarding/tailor]", error instanceof Error ? error.message.slice(0, 300) : error);
    return NextResponse.json({ error: "The resume could not be written this time. Try again." }, { status: 500 });
  }
}
