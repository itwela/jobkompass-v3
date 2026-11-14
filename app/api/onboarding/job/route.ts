import { NextRequest, NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import { enforceAiRateLimit } from "@/lib/rateLimit/guard";
import { convexForCaller } from "@/lib/onboarding/server";
import { fetchPostingText, normalizeJobUrl } from "@/lib/onboarding/fetchPosting";
import { extractJob } from "@/lib/onboarding/extractJob";

export const maxDuration = 90;

/**
 * Onboarding step 2: save a job from a link (fetched here) or a pasted
 * description. Answers 422 { code: "unreadable" } when the link can't be read,
 * so the screen can ask for the description instead.
 */
export async function POST(request: NextRequest) {
  const limited = await enforceAiRateLimit(request, "ai");
  if (limited) return limited;

  const convex = await convexForCaller();
  if (!convex) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const { link, description } = (await request.json().catch(() => ({}))) as { link?: string; description?: string };
  const pasted = typeof description === "string" ? description.trim() : "";
  const url = typeof link === "string" && link.trim() ? normalizeJobUrl(link) : null;
  if (typeof link === "string" && link.trim() && !url) {
    return NextResponse.json({ error: "That does not look like a link to a job posting." }, { status: 400 });
  }
  if (!url && pasted.length < 80) {
    return NextResponse.json({ error: "Paste a link to the posting, or the full description." }, { status: 400 });
  }

  let text = pasted;
  if (!text && url) {
    const page = await fetchPostingText(url.toString());
    if (!page) {
      return NextResponse.json({ code: "unreadable", error: "That page could not be read. Paste the job description below." }, { status: 422 });
    }
    text = page.text;
  }

  try {
    const can = await convex.query(api.usage.canAddJob, {});
    if (can && can.allowed === false) {
      return NextResponse.json({ code: "limit", error: "Your plan's job limit is reached. Upgrade to save more jobs." }, { status: 402 });
    }
    const job = await extractJob(text, url?.toString());
    if (!job) {
      return NextResponse.json({ code: "unreadable", error: "That does not read like a job posting. Paste the description below." }, { status: 422 });
    }
    const jobId = await convex.mutation(api.jobs.add, {
      company: job.company,
      title: job.title,
      link: url?.toString() ?? "",
      status: "Interested",
      compensation: job.compensation,
      keywords: job.keywords,
      skills: job.skills,
      description: job.description,
      notes: job.location ? `Location: ${job.location}` : undefined,
    });
    return NextResponse.json({ jobId, ...job, link: url?.toString() ?? null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    console.error("[onboarding/job]", message.slice(0, 300));
    if (/limit/i.test(message)) return NextResponse.json({ code: "limit", error: "Your plan's job limit is reached. Upgrade to save more jobs." }, { status: 402 });
    return NextResponse.json({ error: "Could not save that job. Try again." }, { status: 500 });
  }
}
