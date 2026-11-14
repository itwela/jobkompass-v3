import { NextRequest, NextResponse } from "next/server";
import { enforceAiRateLimit } from "@/lib/rateLimit/guard";
import { convexForCaller } from "@/lib/onboarding/server";
import { saveJobFromPosting } from "@/lib/onboarding/saveJob";

export const maxDuration = 90;

/**
 * My Jobs → Add job (D06 / M13). Same path as onboarding step 2: fetch the posting from
 * `link` (or read the pasted `description`), extract it, save it.
 *
 * Body: { link?: string, description?: string }. The older { jobInformation } body still
 * works: a bare URL is treated as the link, anything else as the pasted posting.
 * Errors: 400 bad input, 401 signed out, 402 { code: "limit" }, 422 { code: "unreadable" }.
 */
export async function POST(request: NextRequest) {
  const limited = await enforceAiRateLimit(request, "ai");
  if (limited) return limited;

  const convex = await convexForCaller();
  if (!convex) return NextResponse.json({ success: false, error: "Sign in first." }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { link?: unknown; description?: unknown; jobInformation?: unknown };
  let { link, description } = body;
  if (link === undefined && description === undefined && typeof body.jobInformation === "string") {
    const info = body.jobInformation.trim();
    if (/^https?:\/\/\S+$/i.test(info) || /^[\w-]+(\.[\w-]+)+\/\S*$/.test(info)) link = info;
    else description = info;
  }

  const r = await saveJobFromPosting(convex, { link, description });
  if (!r.ok) {
    return NextResponse.json({ success: false, ...(r.code ? { code: r.code } : {}), error: r.error }, { status: r.status });
  }
  return NextResponse.json({
    success: true,
    message: "Job added successfully!",
    jobsAdded: 1,
    jobId: r.jobId,
    job: { ...r.job, link: r.link },
  });
}
