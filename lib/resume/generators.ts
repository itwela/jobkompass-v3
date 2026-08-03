/**
 * Resume generator router - dispatches to template-specific generators.
 */

import { generateJakeLatex } from './generateJakeLatex';
import { generateJosephLatex } from './generateJosephLatex';
import { generateMarLatex } from './generateMarLatex';
import type { ResumeContent } from './types';

export const RESUME_TEMPLATE_IDS = ['jake', 'joseph', 'mar'] as const;

/**
 * Template ids that were renamed. Resumes saved before a rename still carry the
 * old id in Convex, so keep resolving them instead of silently falling back to
 * jake.
 *
 * NOTE: `mar` used to alias to `joseph` (Joseph was named Mar until Aug 1 2026).
 * That alias was removed when Mar was reintroduced as its own distinct
 * Times/serif template, so pre-rename resumes saved as `mar` now render in the
 * new Mar template rather than Joseph.
 */
const LEGACY_TEMPLATE_IDS: Record<string, (typeof RESUME_TEMPLATE_IDS)[number]> = {};

export function resolveResumeTemplateId(id: string): string {
  return LEGACY_TEMPLATE_IDS[id] ?? id;
}

export function generateResumeLatex(content: ResumeContent, templateId: string): string {
  switch (resolveResumeTemplateId(templateId)) {
    case 'jake':
      return generateJakeLatex(content as any);
    case 'joseph':
      return generateJosephLatex(content);
    case 'mar':
      return generateMarLatex(content);
    default:
      return generateJakeLatex(content as any);
  }
}

export function isValidResumeTemplateId(id: string): boolean {
  return RESUME_TEMPLATE_IDS.includes(resolveResumeTemplateId(id) as any);
}
