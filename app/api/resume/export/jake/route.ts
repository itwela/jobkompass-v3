import { NextResponse } from 'next/server';
import { promisify } from 'util';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { generateJakeLatex, ResumeContentForJake } from '@/lib/resume/generateJakeLatex';

const execAsync = promisify(exec);

export async function POST(req: Request) {
    try {
        const { content } = (await req.json()) as { content: ResumeContentForJake };

        if (!content) {
            return NextResponse.json({ error: 'Missing resume content' }, { status: 400 });
        }

        // Generate LaTeX from content
        const jakeResume = generateJakeLatex(content);

        // Create temporary directory and file
        const tempDir = path.join(process.cwd(), 'temp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
        const uniqueId = crypto.randomBytes(8).toString('hex');
        const tempFile = path.join(tempDir, `resume-${uniqueId}.tex`);
        fs.writeFileSync(tempFile, jakeResume, 'utf-8');

        // Compile LaTeX to PDF
        try {
            await execAsync(`pdflatex -interaction=nonstopmode -output-directory ${tempDir} ${tempFile}`);
            await execAsync(`pdflatex -interaction=nonstopmode -output-directory ${tempDir} ${tempFile}`);
        } catch (latexError: unknown) {
            const logPath = path.join(tempDir, `resume-${uniqueId}.log`);
            const logContent = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf-8') : String(latexError);
            console.error('LaTeX compilation error:', logContent);
            return NextResponse.json({ error: 'LaTeX compilation failed', log: logContent }, { status: 500 });
        }

        // Read the generated PDF
        const pdfPath = path.join(tempDir, `resume-${uniqueId}.pdf`);
        const pdfBuffer = fs.readFileSync(pdfPath);

        // Clean up temp files
        ['aux', 'log', 'out', 'tex', 'pdf'].forEach(ext => {
            const file = path.join(tempDir, `resume-${uniqueId}.${ext}`);
            if (fs.existsSync(file)) fs.unlinkSync(file);
        });

        // Create filename from user's name
        const nameParts = content.personalInfo.name.split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join('-') || '';
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


