import type { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { fetchPostingText, normalizeJobUrl } from "@/lib/onboarding/fetchPosting";
import { extractJob, type ExtractedJob } from "@/lib/onboarding/extractJob";

export type SaveJobResult =
  | { ok: true; jobId: string; job: ExtractedJob; link: string | null }
  | { ok: false; status: number; code?: "unreadable" | "limit"; error: string };

/**
 * Saves one job from a link (the page is fetched here) or a pasted description.
 * Shared by onboarding step 2 (/api/onboarding/job) and My Jobs → Add job (/api/jobs/add).
 * A link that can't be read answers { code: "unreadable" } so the screen can ask for the text.
 */
export async function saveJobFromPosting(
  convex: ConvexHttpClient,
  input: { link?: unknown; description?: unknown; status?: string },
): Promise<SaveJobResult> {
  const pasted = typeof input.description === "string" ? input.description.trim() : "";
  const rawLink = typeof input.link === "string" ? input.link.trim() : "";
  const url = rawLink ? normalizeJobUrl(rawLink) : null;
  if (rawLink && !url) return { ok: false, status: 400, error: "That does not look like a link to a job posting." };
  if (!url && pasted.length < 80) return { ok: false, status: 400, error: "Paste a link to the posting, or the full description." };

  let text = pasted;
  if (!text && url) {
    const page = await fetchPostingText(url.toString());
    if (!page) return { ok: false, status: 422, code: "unreadable", error: "That page could not be read. Paste the job description below." };
    text = page.text;
  }

  const limit = { ok: false as const, status: 402, code: "limit" as const, error: "Your plan's job limit is reached. Upgrade to save more jobs." };
  try {
    const can = await convex.query(api.usage.canAddJob, {});
    if (can && can.allowed === false) return limit;
    const job = await extractJob(text, url?.toString());
    if (!job) return { ok: false, status: 422, code: "unreadable", error: "That does not read like a job posting. Paste the description below." };
    const jobId = await convex.mutation(api.jobs.add, {
      company: job.company,
      title: job.title,
      link: url?.toString() ?? "",
      status: input.status ?? "Interested",
      compensation: job.compensation,
      keywords: job.keywords,
      skills: job.skills,
      description: job.description,
      notes: job.location ? `Location: ${job.location}` : undefined,
    });
    return { ok: true, jobId: String(jobId), job, link: url?.toString() ?? null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    console.error("[saveJobFromPosting]", message.slice(0, 300));
    if (/limit/i.test(message)) return limit;
    return { ok: false, status: 500, error: "Could not save that job. Try again." };
  }
}
