import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@/convex/_generated/api';
import { isValidResumeTemplateId } from '@/lib/templates';
import { generateJakeLatex, ResumeContentForJake } from '@/lib/resume/generateJakeLatex';

const EXTRACTION_SYSTEM_PROMPT = `You are a resume parsing expert. Extract all information from the provided resume text and output a valid JSON object that matches this exact structure. Return ONLY valid JSON, no markdown or extra text.

Structure (ResumeContentForJake):
{
  "personalInfo": {
    "firstName": "string",
    "lastName": "string",
    "email": "string",
    "location": "string or null",
    "linkedin": "string or null",
    "github": "string or null",
    "portfolio": "string or null",
    "citizenship": "string or null"
  },
  "experience": [
    {
      "company": "string",
      "title": "string",
      "location": "string or null",
      "date": "string (e.g. 'Jan 2020 - Present' or 'Jun 2018 - Dec 2019')",
      "details": ["bullet point 1", "bullet point 2"]
    }
  ],
  "education": [
    {
      "name": "school name",
      "degree": "e.g. Bachelor of Science",
      "field": "e.g. Computer Science or null",
      "location": "string or null",
      "startDate": "e.g. Aug 2016 or null",
      "endDate": "e.g. May 2020 or Present",
      "details": ["GPA: 3.8", "honors", "etc"] or []
    }
  ],
  "projects": [
    {
      "name": "project name",
      "description": "brief description",
      "date": "string or null",
      "technologies": ["tech1", "tech2"] or null,
      "details": ["additional bullet"] or null
    }
  ] or null,
  "skills": {
    "technical": ["skill1", "skill2"],
    "additional": ["soft skill 1"] or null
  } or null,
  "additionalInfo": {
    "languages": [{"language": "English", "proficiency": "Native"}] or null,
    "interests": ["interest1"] or null
  } or null
}

Rules:
- Extract everything you can find. Use empty strings or null for missing optional fields.
- personalInfo.firstName, lastName, email are required - infer from content.
- For experience/education dates, use human-readable format like "Jan 2020 - Present".
- All arrays use [] if empty, not null (except optional top-level like projects, skills).
- Extract bullet points into details arrays.
- For skills, put programming languages/tools in technical, soft skills in additional.
- CRITICAL: Never include empty, blank, or whitespace-only items in any details arrays. Each bullet must have real content. Omit any bullet that would be empty—do not add placeholder bullets.`;

const MAX_PDF_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

const OPENROUTER_MODEL_PRIMARY = 'arcee-ai/trinity-mini:free';
const OPENROUTER_MODEL_FALLBACK = 'google/gemma-3-27b-it:free';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { resumeText, resumePdf, email, templateId } = body as {
      resumeText?: string;
      resumePdf?: string;
      email?: string;
      templateId?: string;
    };

    if (!templateId || typeof templateId !== 'string' || !isValidResumeTemplateId(templateId)) {
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

    // Call OpenRouter to extract resume content
    const openRouterKey = process.env.OPENROUTER_API_KEY;
    if (!openRouterKey) {
      return NextResponse.json(
        { error: 'OpenRouter not configured. Please set OPENROUTER_API_KEY.' },
        { status: 503 }
      );
    }

    const buildOpenRouterBody = (model: string) => {
      if (hasPdf) {
        const fileData =
          resumePdf!.startsWith('data:') ? resumePdf! : `data:application/pdf;base64,${resumePdf!}`;
        const pdfUserText =
          'Extract and format this resume from the attached PDF into the required JSON structure. Return ONLY valid JSON.';
        return {
          model,
          messages: [
            { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: pdfUserText,
                },
                {
                  type: 'file',
                  file: {
                    filename: 'resume.pdf',
                    file_data: fileData,
                  },
                },
              ],
            },
          ],
          plugins: [
            {
              id: 'file-parser',
              pdf: { engine: 'pdf-text' },
            },
          ],
          temperature: 0.2,
          max_tokens: 4096,
        };
      }
      const textToExtract = (resumeText as string).trim();
      return {
        model,
        messages: [
          { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Extract and format this resume:\n\n${textToExtract}`,
          },
        ],
        temperature: 0.2,
        max_tokens: 4096,
      };
    };

    const callOpenRouter = async (model: string) => {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openRouterKey}`,
          'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://jobkompass.com',
        },
        body: JSON.stringify(buildOpenRouterBody(model)),
      });
      return res;
    };

    let openRouterResponse = await callOpenRouter(OPENROUTER_MODEL_PRIMARY);

    // Retry primary model once on 502/429/503
    if (!openRouterResponse.ok && [502, 429, 503].includes(openRouterResponse.status)) {
      await sleep(2000);
      openRouterResponse = await callOpenRouter(OPENROUTER_MODEL_PRIMARY);
    }

    // Fallback to alternate model if still failing
    if (!openRouterResponse.ok && [502, 429, 503].includes(openRouterResponse.status)) {
      await sleep(1000);
      openRouterResponse = await callOpenRouter(OPENROUTER_MODEL_FALLBACK);
    }

    if (!openRouterResponse.ok) {
      const errText = await openRouterResponse.text();
      console.error('OpenRouter error:', openRouterResponse.status, errText);
      const isRateLimit = openRouterResponse.status === 429;
      return NextResponse.json(
        {
          error: isRateLimit
            ? 'This free tool is popular right now. Please try again in a minute.'
            : 'AI extraction failed. Please try again.',
        },
        { status: 502 }
      );
    }

    const openRouterData = await openRouterResponse.json();
    const content = openRouterData.choices?.[0]?.message?.content?.trim();
    if (!content) {
      return NextResponse.json(
        { error: 'AI did not return valid content' },
        { status: 502 }
      );
    }

    // Parse JSON - strip DeepSeek R1 <think></think> blocks, then handle markdown code blocks
    let jsonStr = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1].trim();

    let parsed: ResumeContentForJake;
    try {
      parsed = JSON.parse(jsonStr) as ResumeContentForJake;
    } catch {
      return NextResponse.json(
        { error: 'Failed to parse extracted resume data' },
        { status: 502 }
      );
    }

    // Validate and normalize
    if (!parsed.personalInfo) parsed.personalInfo = { email: sanitizedEmail, firstName: '', lastName: '' };
    if (!parsed.personalInfo.email) parsed.personalInfo.email = sanitizedEmail;
    parsed.experience = parsed.experience || [];
    parsed.education = parsed.education || [];
    parsed.projects = parsed.projects || null;
    parsed.skills = parsed.skills || { technical: [], additional: null };
    if (!Array.isArray(parsed.skills.technical)) parsed.skills.technical = [];

    // Strip empty/blank bullets from all details arrays
    const filterEmptyBullets = (arr: string[] | null | undefined) =>
      Array.isArray(arr) ? arr.filter((s) => typeof s === 'string' && s.trim().length > 0) : [];
    parsed.experience.forEach((e) => {
      if (e.details) e.details = filterEmptyBullets(e.details);
    });
    parsed.education.forEach((e) => {
      if (e.details) e.details = filterEmptyBullets(e.details);
    });
    if (parsed.projects) {
      parsed.projects.forEach((p) => {
        if (p.details) p.details = filterEmptyBullets(p.details);
      });
    }

    // Generate LaTeX and compile to PDF
    const LATEX_SERVICE_URL = process.env.LATEX_SERVICE_URL;
    if (!LATEX_SERVICE_URL) {
      return NextResponse.json(
        { error: 'LaTeX service not configured' },
        { status: 503 }
      );
    }

    const latexContent = generateJakeLatex(parsed);
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
      console.error('LaTeX service error', { status: compileResponse.status, error: errorData.error, log });
      return NextResponse.json(
        { error: 'PDF generation failed', log: log || errorData.error || compileResponse.statusText },
        { status: 500 }
      );
    }

    const { pdfBase64 } = await compileResponse.json();
    if (!pdfBase64) {
      return NextResponse.json({ error: 'LaTeX service did not return a PDF' }, { status: 500 });
    }

    // Record stats (fire-and-forget, don't block response)
    try {
      const textCharCount = hasText ? (resumeText as string).length : 0;
      const pdfBytes = hasPdf
        ? Math.floor(((resumePdf as string).replace(/^data:application\/pdf;base64,/, '').length * 3) / 4)
        : undefined;
      await convexClient.mutation(api.freeResumeStats.recordGeneration, {
        inputType: hasPdf ? 'pdf' : 'text',
        textCharacterCount: textCharCount,
        pdfSizeBytes: pdfBytes,
        templateId,
      });
    } catch (statsErr) {
      console.warn('Free resume stats recording failed:', statsErr);
    }

    return NextResponse.json({
      success: true,
      pdfBase64,
      content: parsed,
    });
  } catch (error) {
    console.error('Free resume parse error:', error);
    return NextResponse.json(
      {
        error: 'Failed to process resume',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
