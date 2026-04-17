import { NextRequest, NextResponse } from 'next/server';
import { convexAuthNextjsToken } from '@convex-dev/auth/nextjs/server';
import { extractResumeContent } from '@/lib/resume/extractFromPdf';

const MAX_PDF_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const MAX_RESUME_TEXT_CHARS = 400_000;

/** Allow long OpenRouter + PDF extraction runs (Vercel / similar; capped by plan). */
export const maxDuration = 300;

/**
 * Extract structured resume content from a PDF and/or pasted text.
 * Pasted text skips PDF parsing (use for scanned PDFs). Requires authenticated user.
 */
export async function POST(request: NextRequest) {
  try {
    const token = await convexAuthNextjsToken();
    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { resumePdf, resumeText } = body as { resumePdf?: string; resumeText?: string };

    const trimmedText =
      typeof resumeText === 'string' ? resumeText.replace(/\r\n/g, '\n').trim() : '';
    const hasText = trimmedText.length > 0;
    const hasPdf = typeof resumePdf === 'string' && resumePdf.length > 0;

    if (!hasText && !hasPdf) {
      return NextResponse.json(
        { error: 'Upload a PDF or paste your resume text (for scanned PDFs).' },
        { status: 400 }
      );
    }

    if (hasText && trimmedText.length > MAX_RESUME_TEXT_CHARS) {
      return NextResponse.json({ error: 'Resume text is too long.' }, { status: 400 });
    }

    if (hasText) {
      const content = await extractResumeContent({
        resumeText: trimmedText,
        fallbackEmail: '',
      });
      return NextResponse.json({ success: true, content });
    }

    const base64 = resumePdf!.replace(/^data:application\/pdf;base64,/, '');
    const sizeBytes = (base64.length * 3) / 4;
    if (sizeBytes > MAX_PDF_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'PDF must be under 5MB' },
        { status: 400 }
      );
    }

    const content = await extractResumeContent({
      resumePdf: resumePdf!.startsWith('data:') ? resumePdf! : `data:application/pdf;base64,${resumePdf!}`,
      fallbackEmail: '',
    });

    return NextResponse.json({ success: true, content });
  } catch (error) {
    console.error('Parse resume PDF error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to parse resume',
      },
      { status: 500 }
    );
  }
}
