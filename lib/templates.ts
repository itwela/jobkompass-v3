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
    id: 'vertex',
    name: 'Vertex',
    description:
      'Clean single-column layout with accent headers. Professional and modern. Great for tech and creative roles.',
    previewImage: '/images/jobkompass_preview_resume_jake.png',
    tags: ['Professional', 'Clean', 'Modern'],
    features: ['Single-column layout', 'Accent section headers', 'No blank page issues', 'Tech & design'],
    freeResumeEligible: true,
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description:
      'Ultra-clean single column with generous whitespace. Elegant and understated. Ideal for design, product, and senior roles.',
    previewImage: '/images/jobkompass_preview_resume_jake.png',
    tags: ['Clean', 'Elegant', 'Whitespace'],
    features: ['Minimalist design', 'Easy to scan', 'Design-focused', 'Executive-ready'],
    freeResumeEligible: true,
  },
  {
    id: 'executive',
    name: 'Executive',
    description:
      'Traditional serif typography with conservative structure. Timeless format for finance, law, and C-suite positions.',
    previewImage: '/images/jobkompass_preview_resume_jake.png',
    tags: ['Traditional', 'Serif', 'Formal'],
    features: ['Classic typography', 'Conservative layout', 'Finance & law', 'Senior leadership'],
    freeResumeEligible: true,
  },
  {
    id: 'momentum',
    name: 'Momentum',
    description:
      'Modern single column with blue accent bars. Startup-friendly and energetic. Great for product, growth, and tech roles.',
    previewImage: '/images/jobkompass_preview_resume_jake.png',
    tags: ['Modern', 'Accent Bars', 'Startup'],
    features: ['Bold section headers', 'High-energy design', 'Product & growth', 'Tech startups'],
    freeResumeEligible: true,
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
  return RESUME_TEMPLATES.filter((t) => t.id === 'jake');
  // vertex, minimal, executive, momentum - commented out for now
  // return RESUME_TEMPLATES.filter((t) => t.freeResumeEligible);
}

/** Templates available only in the app (authenticated) */
export function getAppOnlyResumeTemplates(): Template[] {
  return RESUME_TEMPLATES.filter((t) => !t.freeResumeEligible);
}

/** Templates shown as options in the app (context panel, My Jobs gen, etc.). For now only Jake. */
export function getAppResumeTemplateOptions(): Template[] {
  return RESUME_TEMPLATES.filter((t) => t.id === 'jake');
  // vertex, minimal, executive, momentum - commented out for now
  // return RESUME_TEMPLATES;
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
