import { NextResponse } from 'next/server';
import { promisify } from 'util';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { toLatex } from '@/lib/resume/toLatex';
import { ResumeIR } from '@/types/resumeIR';

const execAsync = promisify(exec);

export async function POST(req: Request) {
	try {
		const { ir } = (await req.json()) as { ir: ResumeIR };
		if (!ir) {
			return NextResponse.json({ error: 'Missing IR' }, { status: 400 });
		}

		// Render LaTeX
		const latex = toLatex(ir);

		// Prepare temp files
		const tempDir = path.join(process.cwd(), 'temp');
		if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
		const uniqueId = crypto.randomBytes(8).toString('hex');
		const texPath = path.join(tempDir, `resume-${uniqueId}.tex`);
		fs.writeFileSync(texPath, latex, 'utf-8');

		// Compile with pdflatex twice for references
		try {
			await execAsync(`pdflatex -interaction=nonstopmode -output-directory ${tempDir} ${texPath}`);
			await execAsync(`pdflatex -interaction=nonstopmode -output-directory ${tempDir} ${texPath}`);
		} catch (e) {
			const logPath = path.join(tempDir, `resume-${uniqueId}.log`);
			const logContent = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf-8') : String(e);
			return NextResponse.json({ error: 'LaTeX compilation failed', log: logContent }, { status: 500 });
		}

		const pdfPath = path.join(tempDir, `resume-${uniqueId}.pdf`);
		const pdfBuffer = fs.readFileSync(pdfPath);

		// Cleanup aux files (keep .tex for debugging)
		for (const ext of ['aux', 'log', 'out']) {
			const p = path.join(tempDir, `resume-${uniqueId}.${ext}`);
			if (fs.existsSync(p)) fs.unlinkSync(p);
		}

		return new NextResponse(pdfBuffer, {
			headers: {
				'Content-Type': 'application/pdf',
				'Content-Disposition': 'attachment; filename="resume.pdf"',
				'Cache-Control': 'no-cache',
			},
			status: 200,
		});
	} catch (error) {
		console.error('IR export error:', error);
		return NextResponse.json(
			{ error: 'Failed to export resume', details: error instanceof Error ? error.message : String(error) },
			{ status: 500 }
		);
	}
}


