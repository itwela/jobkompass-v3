/**
 * Centralized resume and cover letter template definitions.
 * Used across the app: free resume generator, template selector, document editing, export.
 * Migrate to DB later by replacing this module with a Convex query.
 */

export interface Template {
  id: string;
  name: string;
  description: string;
  previewImage: string;
  tags?: string[];
  features?: string[];
  /** If true, available in free resume generator. Otherwise app-only. */
  freeResumeEligible?: boolean;
}

/** Resume templates - single source of truth */
export const RESUME_TEMPLATES: Template[] = [
  {
    id: 'jake',
    name: 'JobKompass Jake',
    description:
      'A clean, ATS-optimized professional resume template. Perfect for tech roles with clear section hierarchy and modern typography.',
    previewImage: '/images/jobkompass_preview_resume_jake.png',
    tags: ['ATS-Friendly', 'Professional', 'Tech'],
    features: ['Optimized for ATS systems', 'Clean section hierarchy', 'Modern typography', 'Tech-focused layout'],
    freeResumeEligible: true,
  },
  {
    id: 'joseph',
    name: 'Joseph',
    description:
      'Clean Calibri-style resume with bold section headings, a competencies-forward layout, and a merged education & development section. Great for experienced, multi-domain professionals.',
    previewImage: '/images/jobkompass_preview_resume_joseph.png',
    tags: ['ATS-Friendly', 'Professional', 'Competencies'],
    features: ['Calibri-style typography', 'Core competencies section', 'Early career summary', 'Merged education & development'],
    freeResumeEligible: false,
  },
];

/** Cover letter templates - single source of truth */
export const COVER_LETTER_TEMPLATES: Template[] = [
  {
    id: 'jake',
    name: 'JobKompass Jake',
    description:
      'A matching cover letter template that pairs perfectly with the Jake resume. Clean formatting with professional structure.',
    previewImage: '/images/jobkompass_preview_cover_letter_jake.png',
    tags: ['Professional', 'Matching', 'Clean'],
    features: ['Matches Jake resume', 'Professional tone', 'Clear structure', 'ATS-compatible'],
  },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

export function getResumeTemplateById(id: string): Template | undefined {
  return RESUME_TEMPLATES.find((t) => t.id === id);
}

export function getCoverLetterTemplateById(id: string): Template | undefined {
  return COVER_LETTER_TEMPLATES.find((t) => t.id === id);
}

export function getDefaultResumeTemplateId(): string {
  return 'jake';
}

export function getDefaultCoverLetterTemplateId(): string {
  return 'jake';
}

export function isValidResumeTemplateId(id: string): boolean {
  return RESUME_TEMPLATES.some((t) => t.id === id);
}

export function isValidCoverLetterTemplateId(id: string): boolean {
  return COVER_LETTER_TEMPLATES.some((t) => t.id === id);
}

/** Templates available in the free resume generator. For now only Jake. */
export function getFreeResumeTemplates(): Template[] {
  return RESUME_TEMPLATES.filter((t) => t.freeResumeEligible);
}

/** Templates shown in the free generator but locked behind a subscription (preview only). */
export function getLockedFreeResumeTemplates(): Template[] {
  return RESUME_TEMPLATES.filter((t) => !t.freeResumeEligible);
}

/** Templates available only in the app (authenticated) */
export function getAppOnlyResumeTemplates(): Template[] {
  return RESUME_TEMPLATES.filter((t) => !t.freeResumeEligible);
}

/**
 * Templates shown as options in the app (context panel, My Jobs gen, Documents form).
 * Explicit allowlist so a half-finished template can't leak into the picker just by
 * being added to RESUME_TEMPLATES.
 */
const APP_SELECTABLE_TEMPLATE_IDS = ['jake', 'joseph'];

export function getAppResumeTemplateOptions(): Template[] {
  return RESUME_TEMPLATES.filter((t) => APP_SELECTABLE_TEMPLATE_IDS.includes(t.id));
}

/** API route for exporting a resume by template ID */
export function getResumeExportRoute(templateId: string): string {
  return `/api/resume/export/${templateId}`;
}

/** API route for exporting a cover letter by template ID */
export function getCoverLetterExportRoute(templateId: string): string {
  if (templateId === 'jake') return '/api/coverletter/export/jake';
  return '/api/coverletter/export/jake';
}

/** Template type for selector modals */
export type TemplateType = 'resume' | 'cover-letter';
