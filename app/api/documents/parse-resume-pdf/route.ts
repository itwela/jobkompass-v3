import { NextRequest, NextResponse } from 'next/server';
import { convexAuthNextjsToken } from '@convex-dev/auth/nextjs/server';
import { extractResumeContent } from '@/lib/resume/extractFromPdf';

const MAX_PDF_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

/**
 * Parse a resume PDF and extract structured content.
 * Requires authenticated user.
 */
export async function POST(request: NextRequest) {
  try {
    const token = await convexAuthNextjsToken();
    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { resumePdf } = body as { resumePdf?: string };

    if (!resumePdf || typeof resumePdf !== 'string') {
      return NextResponse.json(
        { error: 'Please upload a PDF file' },
        { status: 400 }
      );
    }

    const base64 = resumePdf.replace(/^data:application\/pdf;base64,/, '');
    const sizeBytes = (base64.length * 3) / 4;
    if (sizeBytes > MAX_PDF_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'PDF must be under 5MB' },
        { status: 400 }
      );
    }

    const content = await extractResumeContent({
      resumePdf: resumePdf.startsWith('data:') ? resumePdf : `data:application/pdf;base64,${resumePdf}`,
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
