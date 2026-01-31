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
    features: [
      'Optimized for ATS systems',
      'Clean section hierarchy',
      'Modern typography',
      'Tech-focused layout',
    ],
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
    features: [
      'Matches Jake resume',
      'Professional tone',
      'Clear structure',
      'ATS-compatible',
    ],
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

/** API route for exporting a resume by template ID (used by DynamicJSONEditor, etc.) */
export function getResumeExportRoute(templateId: string): string {
  if (templateId === 'jake') return '/api/resume/export/jake';
  // Default to jake until more templates exist
  return '/api/resume/export/jake';
}

/** API route for exporting a cover letter by template ID */
export function getCoverLetterExportRoute(templateId: string): string {
  if (templateId === 'jake') return '/api/coverletter/export/jake';
  return '/api/coverletter/export/jake';
}

/** Template type for selector modals (resume vs cover letter) */
export type TemplateType = 'resume' | 'cover-letter';
