import { NextResponse } from 'next/server';
import { generateJakeLatex, ResumeContentForJake } from '@/lib/resume/generateJakeLatex';

export async function POST(req: Request) {
    try {
        const { content } = (await req.json()) as { content: ResumeContentForJake };

        if (!content) {
            return NextResponse.json({ error: 'Missing resume content' }, { status: 400 });
        }

        const LATEX_SERVICE_URL = process.env.LATEX_SERVICE_URL;
        if (!LATEX_SERVICE_URL) {
            return NextResponse.json({ error: 'LATEX_SERVICE_URL is not configured' }, { status: 500 });
        }

        // Generate LaTeX from content
        const jakeResume = generateJakeLatex(content);

        // Compile via the Docker LaTeX service
        const compileResponse = await fetch(`${LATEX_SERVICE_URL}/compile`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ latex: jakeResume }),
        });

        const compileResult = await compileResponse.json();

        if (!compileResponse.ok || !compileResult.success) {
            console.error('LaTeX service compilation error:', compileResult.error);
            return NextResponse.json(
                { error: 'LaTeX compilation failed', log: compileResult.log },
                { status: 500 }
            );
        }

        const pdfBuffer = Buffer.from(compileResult.pdfBase64, 'base64');

        // Create filename from user's name - support both firstName/lastName and combined name
        let firstName = content.personalInfo.firstName || '';
        let lastName = content.personalInfo.lastName || '';

        // Fallback to splitting name if firstName/lastName not provided
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
        console.error('Jake resume export error:', error);
        return NextResponse.json(
            { error: 'Failed to export resume', details: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}
