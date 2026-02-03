import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { generateResumeLatex, isValidResumeTemplateId } from '@/lib/resume/generators';
import type { ResumeContent } from '@/lib/resume/types';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ templateId: string }> }
) {
  try {
    const { templateId } = await params;
    if (!templateId || !isValidResumeTemplateId(templateId)) {
      return NextResponse.json(
        { error: `Invalid template: ${templateId}. Valid: jake, vertex, minimal, executive, momentum` },
        { status: 400 }
      );
    }

    const { content } = (await req.json()) as { content: ResumeContent };
    if (!content) {
      return NextResponse.json({ error: 'Missing resume content' }, { status: 400 });
    }

    const LATEX_SERVICE_URL = process.env.LATEX_SERVICE_URL;
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
