/**
 * Centralized resume and cover letter template definitions.
 * Used across the app: free resume generator, template selector, document editing, export.
 * Migrate to DB later by replacing this module with a Convex query.
 */

import { RANK_FREE, RANK_PRO, RANK_STARTER, type PlanRank } from '../convex/plans';

export interface Template {
  id: string;
  name: string;
  description: string;
  previewImage: string;
  tags?: string[];
  features?: string[];
  /** If true, available in free resume generator. Otherwise app-only. */
  freeResumeEligible?: boolean;
  /**
   * Lowest plan rank that may generate with this template. Absent means free.
   * Distinct from `freeResumeEligible`, which governs the logged-out lead-magnet
   * generator and is unrelated to subscriber tiering.
   */
  minRank?: PlanRank;
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
    minRank: RANK_FREE,
  },
  {
    id: 'joseph',
    name: 'JobKompass Joseph',
    description:
      'Clean Calibri-style resume with bold section headings, a competencies-forward layout, and a merged education & development section. Great for experienced, multi-domain professionals.',
    previewImage: '/images/jobkompass_preview_resume_joseph.png',
    tags: ['ATS-Friendly', 'Professional', 'Competencies'],
    features: ['Calibri-style typography', 'Core competencies section', 'Early career summary', 'Merged education & development'],
    freeResumeEligible: false,
    minRank: RANK_STARTER,
  },
  {
    id: 'mar',
    name: 'JobKompass Mar',
    description:
      'Classic Times serif resume with a centered name header, justified body copy, a categorized technical skills list, and a separate internships section. The name and contact details repeat at the top of every continuation page.',
    previewImage: '/images/jobkompass_preview_resume_mar.png',
    tags: ['ATS-Friendly', 'Classic', 'Academic'],
    features: [
      'Times serif typography',
      'Centered name header repeated on every page',
      'Categorized technical skills',
      'Separate internships section',
      'Merged education & certifications',
    ],
    freeResumeEligible: false,
    minRank: RANK_PRO,
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

export const RESUME_TEMPLATE_IDS = ['jake', 'joseph', 'mar'] as const;

/**
 * Template ids that were renamed. Resumes saved before a rename still carry the
 * old id, so keep resolving them instead of silently falling back to jake.
 *
 * NOTE: `mar` used to alias to `joseph`. That alias was removed when Mar was
 * reintroduced as its own template, so pre-rename resumes saved as `mar` now
 * render in the new Mar template.
 */
const LEGACY_TEMPLATE_IDS: Record<string, string> = {};

export function resolveResumeTemplateId(id: string): string {
  return LEGACY_TEMPLATE_IDS[id] ?? id;
}

export function isValidResumeTemplateId(id: string): boolean {
  return RESUME_TEMPLATES.some((t) => t.id === resolveResumeTemplateId(id));
}

/** Unknown ids return Pro, so a typo fails closed rather than granting access. */
export function resumeTemplateMinRank(id: string): PlanRank {
  const template = getResumeTemplateById(resolveResumeTemplateId(id));
  if (!template) return RANK_PRO;
  return template.minRank ?? RANK_FREE;
}

export function canUseResumeTemplate(id: string, rank: PlanRank): boolean {
  return rank >= resumeTemplateMinRank(id);
}

export function getResumeTemplatesForRank(rank: PlanRank): Template[] {
  return RESUME_TEMPLATES.filter((t) => rank >= (t.minRank ?? RANK_FREE));
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
const APP_SELECTABLE_TEMPLATE_IDS = ['jake', 'joseph', 'mar'];

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
