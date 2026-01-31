import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@/convex/_generated/api';
import { getFreeResumeTemplates, isValidResumeTemplateId } from '@/lib/templates';
import { generateResumeLatex } from '@/lib/resume/generators';
import { extractResumeContent } from '@/lib/resume/extractFromPdf';

const MAX_PDF_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { resumeText, resumePdf, email, templateId } = body as {
      resumeText?: string;
      resumePdf?: string;
      email?: string;
      templateId?: string;
    };

    const freeTemplates = getFreeResumeTemplates();
    const isFreeTemplate = freeTemplates.some((t) => t.id === templateId);
    if (!templateId || typeof templateId !== 'string' || !isValidResumeTemplateId(templateId) || !isFreeTemplate) {
      return NextResponse.json(
        { error: 'Please select a valid template' },
        { status: 400 }
      );
    }

    const hasText = resumeText && typeof resumeText === 'string' && resumeText.trim().length > 0;
    const hasPdf = resumePdf && typeof resumePdf === 'string' && resumePdf.length > 0;

    if (!hasText && !hasPdf) {
      return NextResponse.json(
        { error: 'Please paste your resume text or upload a PDF' },
        { status: 400 }
      );
    }

    if (hasPdf) {
      const base64 = resumePdf.replace(/^data:application\/pdf;base64,/, '');
      const sizeBytes = (base64.length * 3) / 4;
      if (sizeBytes > MAX_PDF_SIZE_BYTES) {
        return NextResponse.json(
          { error: 'PDF must be under 5MB' },
          { status: 400 }
        );
      }
    }

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email required - please sign up to the email list first' },
        { status: 400 }
      );
    }

    const sanitizedEmail = email.trim().toLowerCase();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(sanitizedEmail)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    // Verify email is on the free-resume email list
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL;
    if (!convexUrl) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 503 }
      );
    }

    const convexClient = new ConvexHttpClient(convexUrl);
    const { found } = await convexClient.query(api.emailList.checkEmail, {
      email: sanitizedEmail,
      submissionType: 'free-resume',
    });

    if (!found) {
      return NextResponse.json(
        { error: 'Email not found on list. Please sign up first or verify your email.' },
        { status: 403 }
      );
    }

    // Check free resume limit (2 per email, unlimited for plus/pro)
    const limitCheck = await convexClient.query(api.freeResumeStats.checkFreeResumeLimit, {
      email: sanitizedEmail,
    });
    if (!limitCheck.canGenerate) {
      return NextResponse.json(
        {
          error: "You've used your 2 free resumes. Sign up to unlock unlimited resume generation.",
          limitReached: true,
          count: limitCheck.count,
          limit: limitCheck.limit,
        },
        { status: 403 }
      );
    }
    const isPlusOrPro = limitCheck.isPlusOrPro ?? false;

    // Extract resume content via OpenRouter AI
    let parsed;
    try {
      parsed = await extractResumeContent({
        resumePdf: hasPdf ? (resumePdf as string) : undefined,
        resumeText: hasText ? (resumeText as string) : undefined,
        fallbackEmail: sanitizedEmail,
      });
    } catch (extractErr) {
      const errMsg = extractErr instanceof Error ? extractErr.message : String(extractErr);
      const errStack = extractErr instanceof Error ? extractErr.stack : undefined;
      const isRateLimit = errMsg.includes('429');
      return NextResponse.json(
        {
          error: isRateLimit
            ? 'This free tool is popular right now. Please try again in a minute.'
            : 'AI extraction failed. Please try again.',
          details: errMsg,
          ...(process.env.NODE_ENV === 'development' && errStack ? { stack: errStack } : {}),
        },
        { status: 502 }
      );
    }

    // Generate LaTeX and compile to PDF
    const LATEX_SERVICE_URL = process.env.LATEX_SERVICE_URL;
    if (!LATEX_SERVICE_URL) {
      return NextResponse.json(
        { error: 'LaTeX service not configured' },
        { status: 503 }
      );
    }

    const latexContent = generateResumeLatex(parsed, templateId);
    const uniqueId = crypto.randomBytes(8).toString('hex');

    const compileResponse = await fetch(`${LATEX_SERVICE_URL}/compile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        latex: latexContent,
        latexContent: latexContent,
        filename: `resume-${uniqueId}`,
      }),
    });

    if (!compileResponse.ok) {
      const errorData = await compileResponse.json().catch(() => ({}));
      const log = errorData.log ?? '';
      const details = log || errorData.error || compileResponse.statusText;
      console.error('LaTeX service error', { status: compileResponse.status, error: errorData.error, log });
      return NextResponse.json(
        { error: 'PDF generation failed', details: String(details) },
        { status: 500 }
      );
    }

    const { pdfBase64 } = await compileResponse.json();
    if (!pdfBase64) {
      return NextResponse.json({ error: 'LaTeX service did not return a PDF' }, { status: 500 });
    }

    // Record stats only for free users (not plus/pro) - so the count reflects actual free-tier usage
    if (!isPlusOrPro) {
      try {
        const textCharCount = hasText ? (resumeText as string).length : 0;
        const pdfBytes = hasPdf
          ? Math.floor(((resumePdf as string).replace(/^data:application\/pdf;base64,/, '').length * 3) / 4)
          : undefined;
        await convexClient.mutation(api.freeResumeStats.recordGeneration, {
          email: sanitizedEmail,
          inputType: hasPdf ? 'pdf' : 'text',
          textCharacterCount: textCharCount,
          pdfSizeBytes: pdfBytes,
          templateId,
        });
      } catch (statsErr) {
        console.warn('Free resume stats recording failed:', statsErr);
      }
    }

    return NextResponse.json({
      success: true,
      pdfBase64,
      content: parsed,
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    const errStack = error instanceof Error ? error.stack : undefined;
    console.error('Free resume parse error:', error);
    return NextResponse.json(
      {
        error: 'Failed to process resume',
        details: errMsg,
        ...(process.env.NODE_ENV === 'development' && errStack ? { stack: errStack } : {}),
      },
      { status: 500 }
    );
  }
}
