/**
 * Shared resume extraction logic for PDF/text input.
 * Used by: free-resume parser, My Documents upload.
 */

import type { ResumeContentForJake } from './generateJakeLatex';

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

export const OPENROUTER_MODEL_PRIMARY = 'arcee-ai/trinity-mini:free';
export const OPENROUTER_MODEL_FALLBACK = 'google/gemma-3-27b-it:free';

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
  const hasText = resumeText && typeof resumeText === 'string' && resumeText.trim().length > 0;
  const hasPdf = resumePdf && typeof resumePdf === 'string' && resumePdf.length > 0;

  if (!hasText && !hasPdf) {
    throw new Error('Please provide resume text or PDF');
  }

  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (!openRouterKey) {
    throw new Error('OpenRouter not configured');
  }

  const buildOpenRouterBody = (model: string) => {
    if (hasPdf) {
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
        { role: 'user', content: `Extract and format this resume:\n\n${(resumeText as string).trim()}` },
      ],
      temperature: 0.2,
      max_tokens: 4096,
    };
  };

  const callOpenRouter = async (model: string) => {
    const body = buildOpenRouterBody(model);
    if (!hasPdf) (body as any).model = model;
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

  let res = await callOpenRouter(OPENROUTER_MODEL_PRIMARY);
  if (!res.ok && [502, 429, 503].includes(res.status)) {
    await sleep(2000);
    res = await callOpenRouter(OPENROUTER_MODEL_PRIMARY);
  }
  if (!res.ok && [502, 429, 503].includes(res.status)) {
    await sleep(1000);
    res = await callOpenRouter(OPENROUTER_MODEL_FALLBACK);
  }

  if (!res.ok) {
    const errText = await res.text();
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
