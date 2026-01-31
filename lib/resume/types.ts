/**
 * Shared resume content structure and helpers.
 * All templates use this unified format.
 */

export interface Language {
  language: string;
  proficiency: string;
}

export interface ResumeContent {
  personalInfo: {
    name?: string;
    firstName?: string;
    lastName?: string;
    citizenship?: string | null;
    email: string;
    location?: string | null;
    linkedin?: string | null;
    github?: string | null;
    portfolio?: string | null;
  };
  experience?: Array<{
    company: string;
    title: string;
    location?: string | null;
    date: string;
    details?: string[] | null;
  }> | null;
  education?: Array<{
    name: string;
    degree: string;
    field?: string | null;
    location?: string | null;
    startDate?: string | null;
    endDate: string;
    details?: string[] | null;
  }> | null;
  projects?: Array<{
    name: string;
    description: string;
    date?: string | null;
    technologies?: string[] | null;
    details?: string[] | null;
  }> | null;
  skills?: {
    technical?: string[] | null;
    additional?: string[] | null;
  } | null;
  additionalInfo?: {
    interests?: string[] | null;
    hobbies?: string[] | null;
    languages?: Language[] | null;
    references?: string | null;
  } | null;
}

export function escapeLatex(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/&/g, '\\&')
    .replace(/%/g, '\\%')
    .replace(/\$/g, '\\$')
    .replace(/#/g, '\\#')
    .replace(/_/g, '\\_')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}');
}

export function getFullName(content: ResumeContent): { firstName: string; lastName: string; fullName: string } {
  let firstName = content.personalInfo.firstName || '';
  let lastName = content.personalInfo.lastName || '';
  if (!firstName && !lastName && content.personalInfo.name) {
    const parts = content.personalInfo.name.split(' ');
    firstName = parts[0] || '';
    lastName = parts.slice(1).join(' ') || '';
  }
  return { firstName, lastName, fullName: `${firstName} ${lastName}`.trim() };
}

/** Build contact link parts with actual URLs displayed (linkedin.com/in/xyz, github.com/xyz, etc.) */
export function buildContactLinkParts(content: ResumeContent): string[] {
  const parts: string[] = [];
  parts.push(`\\href{mailto:${escapeLatex(content.personalInfo.email)}}{${escapeLatex(content.personalInfo.email)}}`);
  if (content.personalInfo.location) {
    parts.push(escapeLatex(content.personalInfo.location));
  }
  if (content.personalInfo.linkedin) {
    const h = content.personalInfo.linkedin
      .replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//i, '')
      .replace(/^linkedin\.com\/in\//i, '')
      .replace(/\/$/, '');
    parts.push(`\\href{https://linkedin.com/in/${escapeLatex(h)}}{linkedin.com/in/${escapeLatex(h)}}`);
  }
  if (content.personalInfo.github) {
    const h = content.personalInfo.github
      .replace(/^https?:\/\/(www\.)?github\.com\//i, '')
      .replace(/^github\.com\//i, '')
      .replace(/\/$/, '');
    parts.push(`\\href{https://github.com/${escapeLatex(h)}}{github.com/${escapeLatex(h)}}`);
  }
  if (content.personalInfo.portfolio) {
    let url = content.personalInfo.portfolio.trim();
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    const display = url.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '');
    parts.push(`\\href{${escapeLatex(url)}}{${escapeLatex(display)}}`);
  }
  return parts;
}
