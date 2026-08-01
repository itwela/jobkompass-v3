/**
 * Resume generator router - dispatches to template-specific generators.
 */

import { generateJakeLatex } from './generateJakeLatex';
import { generateJosephLatex } from './generateJosephLatex';
import type { ResumeContent } from './types';

export const RESUME_TEMPLATE_IDS = ['jake', 'joseph'] as const;

/**
 * Template ids that were renamed. Resumes saved before the rename still carry
 * the old id in Convex, so keep resolving them instead of silently falling
 * back to jake.
 */
const LEGACY_TEMPLATE_IDS: Record<string, (typeof RESUME_TEMPLATE_IDS)[number]> = {
  mar: 'joseph',
};

export function resolveResumeTemplateId(id: string): string {
  return LEGACY_TEMPLATE_IDS[id] ?? id;
}

export function generateResumeLatex(content: ResumeContent, templateId: string): string {
  switch (resolveResumeTemplateId(templateId)) {
    case 'jake':
      return generateJakeLatex(content as any);
    case 'joseph':
      return generateJosephLatex(content);
    default:
      return generateJakeLatex(content as any);
  }
}

export function isValidResumeTemplateId(id: string): boolean {
  return RESUME_TEMPLATE_IDS.includes(resolveResumeTemplateId(id) as any);
}
