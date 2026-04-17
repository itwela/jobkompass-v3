import type { ResumeContentForJake } from './generateJakeLatex';

export function filterEmptyBullets(arr: string[] | null | undefined): string[] {
  return Array.isArray(arr) ? arr.filter((s) => typeof s === 'string' && s.trim().length > 0) : [];
}

export function normalizeExtractedContent(
  parsed: Partial<ResumeContentForJake>,
  fallbackEmail?: string,
): ResumeContentForJake {
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
