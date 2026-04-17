import type { ResumeContentForJake } from './generateJakeLatex';
import { normalizeExtractedContent } from './normalizeResumeContent';

const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;

/**
 * Build the same structured resume object used elsewhere, from plain pasted text.
 * No AI — avoids JSON parse failures. User can restructure in the editor.
 */
export function buildResumeContentFromPastedText(pastedText: string): ResumeContentForJake {
  const text = pastedText.replace(/\r\n/g, '\n').trim();
  const emailMatch = text.match(EMAIL_RE);
  const email = emailMatch?.[0] ?? '';

  let firstName = '';
  let lastName = '';
  const linesRaw = text.split('\n');
  const firstMeaningful =
    linesRaw
      .map((l) => l.trim())
      .find((l) => l.length > 0 && !EMAIL_RE.test(l) && !/^[-•*\u2022]/.test(l)) ?? '';

  if (firstMeaningful.length > 0 && firstMeaningful.length < 120) {
    const parts = firstMeaningful.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      firstName = parts[0];
      lastName = parts.slice(1).join(' ');
    } else {
      firstName = parts[0] ?? '';
    }
  }

  const detailLines = linesRaw.map((l) => l.trim()).filter((l) => l.length > 0);

  const partial: Partial<ResumeContentForJake> = {
    personalInfo: {
      firstName,
      lastName,
      email,
      location: null,
      linkedin: null,
      github: null,
      portfolio: null,
      citizenship: null,
    },
    experience: [
      {
        company: 'Uploaded document',
        title: 'Resume text (edit sections below)',
        location: null,
        date: '—',
        details: detailLines.length > 0 ? detailLines : [text],
      },
    ],
    education: [],
    projects: null,
    skills: { technical: [], additional: null },
    additionalInfo: {
      references: text,
      languages: null,
      interests: null,
      hobbies: null,
    },
  };

  return normalizeExtractedContent(partial, email || undefined);
}
