/**
 * Shared resume extraction logic for PDF/text input.
 * Used by: free-resume generator, My Documents upload.
 */

import type { ResumeContentForJake } from './generateJakeLatex';
import { FREE_RESUME_MODEL_IDS } from '@/lib/aiModels';
import { extractTextFromPdfBase64, isLikelyReadableResumeText } from './pdfToText';

const OPENROUTER_MODEL_PRIMARY = FREE_RESUME_MODEL_IDS[0];
const OPENROUTER_MODEL_FALLBACK = FREE_RESUME_MODEL_IDS[1];

export const EXTRACTION_SYSTEM_PROMPT = `You are a resume parsing expert. Extract all information from the provided resume text and output a valid JSON object that matches this exact structure. Return ONLY valid JSON, no markdown or extra text.

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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function filterEmptyBullets(arr: string[] | null | undefined): string[] {
  return Array.isArray(arr) ? arr.filter((s) => typeof s === 'string' && s.trim().length > 0) : [];
}

export function normalizeExtractedContent(parsed: Partial<ResumeContentForJake>, fallbackEmail?: string): ResumeContentForJake {
  if (!parsed.personalInfo) parsed.personalInfo = { email: fallbackEmail || '', firstName: '', lastName: '' };
  if (!parsed.personalInfo!.email && fallbackEmail) parsed.personalInfo!.email = fallbackEmail;
  parsed.experience = parsed.experience || [];
  parsed.education = parsed.education || [];
  parsed.projects = parsed.projects || null;
  parsed.skills = parsed.skills || { technical: [], additional: null };
  if (!Array.isArray(parsed.skills!.technical)) parsed.skills!.technical = [];

  parsed.experience!.forEach((e) => {
    if (e.details) e.details = filterEmptyBullets(e.details);
  });
  parsed.education!.forEach((e) => {
    if (e.details) e.details = filterEmptyBullets(e.details);
  });
  if (parsed.projects) {
    parsed.projects.forEach((p) => {
      if (p.details) p.details = filterEmptyBullets(p.details);
    });
  }

  return parsed as ResumeContentForJake;
}

export interface ExtractOptions {
  resumePdf?: string; // base64, optionally with data:application/pdf;base64, prefix
  resumeText?: string;
  fallbackEmail?: string;
}

export async function extractResumeContent(options: ExtractOptions): Promise<ResumeContentForJake> {
  const { resumePdf, resumeText, fallbackEmail } = options;
  const trimmedUserText =
    resumeText && typeof resumeText === 'string' ? resumeText.trim() : '';
  const hasText = trimmedUserText.length > 0;
  const hasPdf = resumePdf && typeof resumePdf === 'string' && resumePdf.length > 0;

  if (!hasText && !hasPdf) {
    throw new Error('Please provide resume text or PDF');
  }

  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (!openRouterKey) {
    throw new Error('OpenRouter not configured');
  }

  /** When the user pasted text, use it only (no OpenRouter file upload). */
  let textForLlm = hasText ? trimmedUserText : '';
  /** Send PDF + file-parser only if we could not get enough text locally (OpenRouter often 400s on scans / odd PDFs). */
  let sendPdfFile = false;
  /** Full local extract (may be short); used to retry as text if OpenRouter file-parser returns 400. */
  let weakLocalText = '';

  if (!hasText && hasPdf) {
    weakLocalText = await extractTextFromPdfBase64(resumePdf!);
    if (isLikelyReadableResumeText(weakLocalText)) {
      textForLlm = weakLocalText;
    } else {
      sendPdfFile = true;
    }
  }

  if (!textForLlm && !sendPdfFile) {
    throw new Error(
      'Could not read text from this PDF. If it is a scan or image-only file, paste your resume text instead, or export a PDF with selectable text from Word or Google Docs.',
    );
  }

  const buildOpenRouterBody = (model: string) => {
    if (sendPdfFile) {
      const fileData = resumePdf!.startsWith('data:') ? resumePdf! : `data:application/pdf;base64,${resumePdf!}`;
      return {
        model,
        messages: [
          { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Extract and format this resume from the attached PDF into the required JSON structure. Return ONLY valid JSON.' },
              { type: 'file', file: { filename: 'resume.pdf', file_data: fileData } },
            ],
          },
        ],
        plugins: [{ id: 'file-parser', pdf: { engine: 'pdf-text' } }],
        temperature: 0.2,
        max_tokens: 4096,
      };
    }
    return {
      model,
      messages: [
        { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
        { role: 'user', content: `Extract and format this resume:\n\n${textForLlm}` },
      ],
      temperature: 0.2,
      max_tokens: 4096,
    };
  };

  const callOpenRouter = async (model: string) => {
    const body = buildOpenRouterBody(model);
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openRouterKey}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://jobkompass.com',
      },
      body: JSON.stringify(body),
    });
    return res;
  };

  const runExtractionRound = async (): Promise<Response> => {
    let r = await callOpenRouter(OPENROUTER_MODEL_PRIMARY);
    if (!r.ok && [502, 429, 503].includes(r.status)) {
      await sleep(2000);
      r = await callOpenRouter(OPENROUTER_MODEL_PRIMARY);
    }
    if (!r.ok) {
      await sleep(1000);
      r = await callOpenRouter(OPENROUTER_MODEL_FALLBACK);
    }
    if (!r.ok && [502, 429, 503].includes(r.status)) {
      await sleep(1000);
      r = await callOpenRouter(OPENROUTER_MODEL_FALLBACK);
    }
    return r;
  };

  let res = await runExtractionRound();

  if (
    !res.ok &&
    sendPdfFile &&
    res.status === 400 &&
    weakLocalText.length >= 10
  ) {
    const errPeek = await res.clone().text();
    if (/parse|pdf|file/i.test(errPeek)) {
      textForLlm = weakLocalText;
      sendPdfFile = false;
      res = await runExtractionRound();
    }
  }

  if (!res.ok) {
    const errText = await res.text();
    if (sendPdfFile && res.status === 400 && /parse|pdf|file/i.test(errText)) {
      throw new Error(
        'Could not read text from this PDF on the server. Scanned or image-only PDFs are not supported. Copy the text from your resume and paste it into the text field, or export a new PDF with selectable text.',
      );
    }
    throw new Error(`AI extraction failed: ${res.status} ${errText}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error('AI did not return valid content');

  let jsonStr = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) jsonStr = jsonMatch[1].trim();

  let parsed: Partial<ResumeContentForJake>;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error('Failed to parse extracted resume data');
  }

  return normalizeExtractedContent(parsed, fallbackEmail);
}
