import { NextRequest, NextResponse } from "next/server";
import { enforceAiRateLimit } from "@/lib/rateLimit/guard";
import { convexForCaller } from "@/lib/onboarding/server";
import { saveJobFromPosting } from "@/lib/onboarding/saveJob";

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

  const body = (await request.json().catch(() => ({}))) as { link?: unknown; description?: unknown };
  const r = await saveJobFromPosting(convex, { link: body.link, description: body.description });
  if (!r.ok) return NextResponse.json(r.code ? { code: r.code, error: r.error } : { error: r.error }, { status: r.status });
  return NextResponse.json({ jobId: r.jobId, ...r.job, link: r.link });
}
