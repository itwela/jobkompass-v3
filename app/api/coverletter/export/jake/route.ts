import { NextResponse } from 'next/server';
import { promisify } from 'util';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const execAsync = promisify(exec);

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

        // Create temporary directory and file
        const tempDir = path.join(process.cwd(), 'temp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
        const uniqueId = crypto.randomBytes(8).toString('hex');
        const tempFile = path.join(tempDir, `coverletter-${uniqueId}.tex`);
        fs.writeFileSync(tempFile, latexTemplate, 'utf-8');

        // Compile LaTeX to PDF
        const pdfPath = path.join(tempDir, `coverletter-${uniqueId}.pdf`);
        
        try {
            await execAsync(`pdflatex -interaction=nonstopmode -output-directory ${tempDir} ${tempFile}`);
            await execAsync(`pdflatex -interaction=nonstopmode -output-directory ${tempDir} ${tempFile}`);
        } catch (latexError: unknown) {
            if (!fs.existsSync(pdfPath)) {
                const logPath = path.join(tempDir, `coverletter-${uniqueId}.log`);
                const logContent = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf-8') : String(latexError);
                console.error('LaTeX compilation error:', logContent);
                return NextResponse.json({ error: 'LaTeX compilation failed', log: logContent }, { status: 500 });
            }
        }

        // Verify PDF exists
        if (!fs.existsSync(pdfPath)) {
            return NextResponse.json({ error: 'PDF generation failed - no output file' }, { status: 500 });
        }
        const pdfBuffer = fs.readFileSync(pdfPath);

        // Clean up temp folder
        try {
            if (fs.existsSync(tempDir)) {
                fs.rmSync(tempDir, { recursive: true, force: true });
            }
        } catch (cleanupError) {
            console.error('Error cleaning up temp folder:', cleanupError);
        }

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
        // Clean up temp folder even on error
        try {
            const tempDir = path.join(process.cwd(), 'temp');
            if (fs.existsSync(tempDir)) {
                fs.rmSync(tempDir, { recursive: true, force: true });
            }
        } catch (cleanupError) {
            console.error('Error cleaning up temp folder:', cleanupError);
        }
        return NextResponse.json(
            { error: 'Failed to export cover letter', details: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}

