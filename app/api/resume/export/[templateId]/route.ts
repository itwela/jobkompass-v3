import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { convexAuthNextjsToken } from '@convex-dev/auth/nextjs/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@/convex/_generated/api';
import { generateResumeLatex, isValidResumeTemplateId } from '@/lib/resume/generators';
import { canUseResumeTemplate, resumeTemplateMinRank } from '@/lib/templates';
import { rankLabel, type PlanRank } from '@/convex/plans';
import type { ResumeContent } from '@/lib/resume/types';

export const maxDuration = 300;

function getLatexServiceUrl() {
  if (process.env.NODE_ENV === 'development') return 'http://127.0.0.1:8080';
  return process.env.LATEX_SERVICE_URL ?? null;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ templateId: string }> }
) {
  try {
    const { templateId } = await params;

    // This route renders any template for any content, so it must never be
    // anonymous. Two kinds of caller are allowed, and each establishes the rank
    // a different way:
    //
    //   1. Our own infrastructure (Convex actions), proving itself with the
    //      shared secret and stating the user's rank in the body.
    //   2. A signed-in browser, proving itself with a Convex session. The rank
    //      is resolved server-side from that session and any rank in the body is
    //      ignored, since the browser is free to lie about it.
    const expectedSecret = process.env.RESUME_EXPORT_SECRET;
    if (!expectedSecret) {
      return NextResponse.json(
        { error: 'Export not configured', message: 'RESUME_EXPORT_SECRET is not set' },
        { status: 503 }
      );
    }
    const isTrustedCaller = req.headers.get('x-jk-export-secret') === expectedSecret;

    if (!templateId || !isValidResumeTemplateId(templateId)) {
      return NextResponse.json(
        { error: `Invalid template: ${templateId}. Valid: jake, joseph, mar` },
        { status: 400 }
      );
    }

    const { content, rank } = (await req.json()) as {
      content: ResumeContent;
      rank?: number;
    };
    if (!content) {
      return NextResponse.json({ error: 'Missing resume content' }, { status: 400 });
    }

    // Fail closed: an absent or malformed rank is treated as free.
    const coerceRank = (value: unknown): PlanRank =>
      (value === 0 || value === 1 || value === 2 || value === 3 ? value : 0) as PlanRank;

    let callerRank: PlanRank;
    if (isTrustedCaller) {
      callerRank = coerceRank(rank);
    } else {
      const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL;
      const convexToken = convexUrl ? await convexAuthNextjsToken() : null;
      if (!convexToken || !convexUrl) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      const convexClient = new ConvexHttpClient(convexUrl);
      convexClient.setAuth(convexToken);
      // Resolved from the session, never from the body.
      callerRank = coerceRank(await convexClient.query(api.usage.currentPlanRank, {}));
    }

    // The single tier gate. Callers state who is asking; this decides.
    if (!canUseResumeTemplate(templateId, callerRank)) {
      return NextResponse.json(
        {
          error: 'tier_required',
          message: `The '${templateId}' template requires the ${rankLabel(
            resumeTemplateMinRank(templateId)
          )} plan.`,
          hint: 'Upgrade at https://www.myjobkompass.com/pricing',
        },
        { status: 402 }
      );
    }

    const LATEX_SERVICE_URL = getLatexServiceUrl();
    if (!LATEX_SERVICE_URL) {
      return NextResponse.json(
        { error: 'LaTeX service not configured', message: 'LATEX_SERVICE_URL environment variable is not set' },
        { status: 503 }
      );
    }

    const latexContent = generateResumeLatex(content, templateId);
    const uniqueId = crypto.randomBytes(8).toString('hex');

    const compileResponse = await fetch(`${LATEX_SERVICE_URL}/compile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        latex: latexContent,
        filename: `resume-${uniqueId}`,
      }),
    });

    if (!compileResponse.ok) {
      const errorData = await compileResponse.json().catch(() => ({}));
      const log = errorData.log ?? '';
      console.error('LaTeX service error', { status: compileResponse.status, error: errorData.error, log });
      return NextResponse.json(
        { error: 'LaTeX compilation failed', log: log || errorData.error || compileResponse.statusText },
        { status: 500 }
      );
    }

    const { pdfBase64 } = await compileResponse.json();
    if (!pdfBase64) {
      return NextResponse.json({ error: 'LaTeX service did not return a PDF' }, { status: 500 });
    }

    const pdfBuffer = Buffer.from(pdfBase64, 'base64');

    let firstName = content.personalInfo.firstName || '';
    let lastName = content.personalInfo.lastName || '';
    if (!firstName && !lastName && content.personalInfo.name) {
      const nameParts = content.personalInfo.name.split(' ');
      firstName = nameParts[0] || '';
      lastName = nameParts.slice(1).join('-') || '';
    }
    const safeFileName = `${firstName}-${lastName}`.replace(/[^a-zA-Z0-9-]/g, '') || 'resume';

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${safeFileName}-resume.pdf"`,
        'Cache-Control': 'no-cache',
      },
      status: 200,
    });
  } catch (error) {
    console.error('Resume export error:', error);
    return NextResponse.json(
      { error: 'Failed to export resume', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
