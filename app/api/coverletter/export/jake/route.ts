import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Helper function to escape LaTeX special characters
function escapeLatex(str: string | null | undefined) {
    if (!str) return '';
    return str.replace(/([\\{}&$%#_^~])/g, '\\$1');
}

interface CoverLetterContent {
    personalInfo: {
        firstName: string;
        lastName: string;
        email: string;
        phone?: string;
        location?: string;
    };
    jobInfo: {
        company: string;
        position: string;
        hiringManagerName?: string;
        companyAddress?: string;
    };
    letterContent: {
        openingParagraph: string;
        bodyParagraphs: string[];
        closingParagraph: string;
    };
}

export async function POST(req: Request) {
    try {
        const { content } = (await req.json()) as { content: CoverLetterContent };

        if (!content) {
            return NextResponse.json({ error: 'Missing cover letter content' }, { status: 400 });
        }

        const LATEX_SERVICE_URL = process.env.LATEX_SERVICE_URL;
        if (!LATEX_SERVICE_URL) {
            return NextResponse.json({ error: 'LATEX_SERVICE_URL is not configured' }, { status: 500 });
        }

        const templatePath = path.join(process.cwd(), 'templates/coverletter/jakeCoverLetter.tex');
        if (!fs.existsSync(templatePath)) {
            return NextResponse.json({ error: 'Cover letter template not found' }, { status: 500 });
        }

        let latexTemplate = fs.readFileSync(templatePath, 'utf-8');

        // Build header
        const fullName = `${escapeLatex(content.personalInfo.firstName)} ${escapeLatex(content.personalInfo.lastName)}`;
        const contactParts = [];
        contactParts.push(escapeLatex(content.personalInfo.email));
        if (content.personalInfo.phone) {
            contactParts.push(escapeLatex(content.personalInfo.phone));
        }
        if (content.personalInfo.location) {
            contactParts.push(escapeLatex(content.personalInfo.location));
        }
        const contactLine = contactParts.join(' $|$ ');

        // Replace header placeholders
        latexTemplate = latexTemplate.replace('{{YOUR NAME}}', fullName);
        latexTemplate = latexTemplate.replace('{{YOUR-EMAIL}}', escapeLatex(content.personalInfo.email));
        latexTemplate = latexTemplate.replace('{{YOUR-PHONE}}', content.personalInfo.phone ? escapeLatex(content.personalInfo.phone) : '');
        latexTemplate = latexTemplate.replace('{{YOUR-LOCATION}}', content.personalInfo.location ? escapeLatex(content.personalInfo.location) : '');

        // Replace date
        const today = new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        latexTemplate = latexTemplate.replace('{{DATE}}', escapeLatex(today));

        // Replace recipient info
        const hiringManagerName = content.jobInfo.hiringManagerName || 'Hiring Manager';
        latexTemplate = latexTemplate.replace('{{HIRING_MANAGER_NAME}}', escapeLatex(hiringManagerName));
        latexTemplate = latexTemplate.replace('{{COMPANY_NAME}}', escapeLatex(content.jobInfo.company));
        latexTemplate = latexTemplate.replace('{{COMPANY_ADDRESS}}', content.jobInfo.companyAddress ? escapeLatex(content.jobInfo.companyAddress) : '');

        // Replace salutation
        const salutation = content.jobInfo.hiringManagerName
            ? `${escapeLatex(content.jobInfo.hiringManagerName)}`
            : 'Hiring Manager';
        latexTemplate = latexTemplate.replace('{{SALUTATION}}', salutation);

        // Replace paragraphs
        latexTemplate = latexTemplate.replace('{{OPENING_PARAGRAPH}}', escapeLatex(content.letterContent.openingParagraph));

        const bodyContent = content.letterContent.bodyParagraphs
            .map(para => escapeLatex(para))
            .join('\n\n');
        latexTemplate = latexTemplate.replace('{{BODY_PARAGRAPHS}}', bodyContent);

        latexTemplate = latexTemplate.replace('{{CLOSING_PARAGRAPH}}', escapeLatex(content.letterContent.closingParagraph));

        // Replace signature name
        latexTemplate = latexTemplate.replace('{{YOUR NAME}}', fullName);

        // Compile via the Docker LaTeX service
        const compileResponse = await fetch(`${LATEX_SERVICE_URL}/compile`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ latex: latexTemplate }),
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

        // Create filename from user's name
        const firstName = content.personalInfo.firstName || '';
        const lastName = content.personalInfo.lastName || '';
        const safeFileName = `${firstName}-${lastName}`.replace(/[^a-zA-Z0-9-]/g, '') || 'coverletter';

        return new NextResponse(new Uint8Array(pdfBuffer), {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${safeFileName}-cover-letter.pdf"`,
                'Cache-Control': 'no-cache',
            },
            status: 200,
        });
    } catch (error) {
        console.error('Jake cover letter export error:', error);
        return NextResponse.json(
            { error: 'Failed to export cover letter', details: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}
