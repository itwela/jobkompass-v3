import { NextResponse } from 'next/server';
import { convexAuthNextjsToken } from '@convex-dev/auth/nextjs/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@/convex/_generated/api';
import { isValidResumeTemplateId } from '@/lib/templates';
import type { Id } from '@/convex/_generated/dataModel';

export const maxDuration = 300;

/**
 * Re-render an existing resume in a different template, in place.
 *
 * The saved content is unchanged — only the template differs — so this replaces
 * the stored PDF on the same record. No new resume row is created and no
 * document-generation credit is consumed, because `canGenerateDocument` is
 * never called.
 *
 * This route performs NO tier check of its own. The export route is the single
 * gate and answers 402 for an over-tier template; that 402 is forwarded through
 * unchanged. The UI renders locked templates as non-clickable, but that is
 * presentation: a hand-crafted request here is rejected all the same.
 */
export async function POST(req: Request) {
  try {
    const { resumeId, templateId } = (await req.json()) as {
      resumeId?: string;
      templateId?: string;
    };

    if (!resumeId || !templateId) {
      return NextResponse.json(
        { error: 'Missing resumeId or templateId' },
        { status: 400 }
      );
    }
    if (!isValidResumeTemplateId(templateId)) {
      return NextResponse.json(
        { error: `Invalid template: ${templateId}` },
        { status: 400 }
      );
    }

    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL;
    const convexToken = await convexAuthNextjsToken();
    if (!convexToken || !convexUrl) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const convex = new ConvexHttpClient(convexUrl);
    convex.setAuth(convexToken);

    // Ownership is enforced by getResume itself.
    const resume = await convex.query(api.documents.getResume, {
      resumeId: resumeId as Id<'resumes'>,
    });
    if (!resume?.content) {
      return NextResponse.json(
        { error: 'Resume has no saved content to re-render' },
        { status: 400 }
      );
    }

    const rank = await convex.query(api.usage.currentPlanRank, {});

    const secret = process.env.RESUME_EXPORT_SECRET;
    if (!secret) {
      return NextResponse.json(
        { error: 'Export not configured', message: 'RESUME_EXPORT_SECRET is not set' },
        { status: 503 }
      );
    }

    const origin = new URL(req.url).origin;
    const exportRes = await fetch(`${origin}/api/resume/export/${templateId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-jk-export-secret': secret,
      },
      body: JSON.stringify({ content: resume.content, rank }),
    });

    if (!exportRes.ok) {
      // Forward the export route's answer verbatim, including its 402.
      const body = await exportRes.json().catch(() => ({ error: 'Export failed' }));
      return NextResponse.json(body, { status: exportRes.status });
    }

    const pdfBuffer = Buffer.from(await exportRes.arrayBuffer());

    const uploadUrl = await convex.mutation(api.documents.generateUploadUrl, {});
    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/pdf' },
      body: new Blob([new Uint8Array(pdfBuffer)], { type: 'application/pdf' }),
    });
    if (!uploadRes.ok) {
      return NextResponse.json(
        { error: 'Failed to store the regenerated PDF' },
        { status: 502 }
      );
    }
    const { storageId } = await uploadRes.json();

    // Same record id, same name, same label, same favorite flag. Only the file
    // and the template it was rendered with change.
    await convex.mutation(api.documents.replaceResumeFile, {
      resumeId: resumeId as Id<'resumes'>,
      newFileId: storageId as Id<'_storage'>,
      fileName: resume.fileName || 'resume.pdf',
      fileSize: pdfBuffer.length,
      content: resume.content,
    });
    await convex.mutation(api.documents.updateResumeFileMetadata, {
      resumeId: resumeId as Id<'resumes'>,
      template: templateId,
    });

    return NextResponse.json({ success: true, storageId, template: templateId });
  } catch (error) {
    console.error('Template switch error:', error);
    return NextResponse.json(
      {
        error: 'Failed to switch template',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
