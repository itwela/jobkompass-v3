import { NextRequest, NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { extractResumeContent } from "@/lib/resume/extractFromPdf";
import { enforceAiRateLimit } from "@/lib/rateLimit/guard";
import { convexForCaller } from "@/lib/onboarding/server";

export const maxDuration = 120;
const MAX_PDF_BYTES = 5 * 1024 * 1024;

/** Rough page count from the PDF's page objects; good enough for "1 page · uploaded". */
function countPdfPages(base64: string): number | undefined {
  const raw = Buffer.from(base64.replace(/^data:application\/pdf;base64,/, ""), "base64").toString("latin1");
  const n = raw.match(/\/Type\s*\/Page(?!s)/g)?.length ?? 0;
  return n > 0 ? n : undefined;
}

/**
 * Onboarding step 1: read the resume someone already has (PDF or pasted text)
 * and save it as their base resume. Saved as structured content without a PDF,
 * so it does not count against the plan's AI document allowance.
 */
export async function POST(request: NextRequest) {
  const limited = await enforceAiRateLimit(request, "ai");
  if (limited) return limited;

  const convex = await convexForCaller();
  if (!convex) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const { resumePdf, resumeText, fileName } = (await request.json().catch(() => ({}))) as { resumePdf?: string; resumeText?: string; fileName?: string };
  const hasPdf = typeof resumePdf === "string" && resumePdf.length > 0;
  const hasText = typeof resumeText === "string" && resumeText.trim().length > 0;
  if (!hasPdf && !hasText) return NextResponse.json({ error: "Add a PDF or paste your resume." }, { status: 400 });
  if (hasPdf && (resumePdf!.replace(/^data:application\/pdf;base64,/, "").length * 3) / 4 > MAX_PDF_BYTES) {
    return NextResponse.json({ error: "The PDF must be under 5 MB." }, { status: 400 });
  }

  try {
    const me = await convex.query(api.auth.currentUser, {});
    const content = await extractResumeContent({
      resumePdf: hasPdf ? resumePdf : undefined,
      resumeText: hasText ? resumeText : undefined,
      fallbackEmail: me?.email ?? undefined,
    });
    const pi = (content as { personalInfo?: { firstName?: string; lastName?: string; name?: string } }).personalInfo ?? {};
    const fullName = `${pi.firstName ?? ""} ${pi.lastName ?? ""}`.trim() || pi.name || me?.name || "My";
    const resumeId = (await convex.mutation(api.documents.saveResume, {
      name: `${fullName} — Base resume`,
      content,
      template: "jake",
      label: "Base",
    })) as Id<"resumes">;
    // Onboarding says "the resume you already have": it is the base, even if an older one existed.
    await convex.mutation(api.documents.setBaseResume, { resumeId });
    return NextResponse.json({
      resumeId,
      content,
      fileName: hasPdf ? fileName || "Resume.pdf" : null,
      pages: hasPdf ? countPdfPages(resumePdf!) : undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const friendly = /scan|image-only|selectable text|could not read/i.test(message)
      ? "That PDF has no readable text (it may be a scan). Paste the text instead."
      : "Could not read that resume. Try again, or paste the text instead.";
    console.error("[onboarding/resume]", message.slice(0, 300));
    return NextResponse.json({ error: friendly }, { status: 422 });
  }
}
