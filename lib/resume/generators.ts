/**
 * Resume generator router - dispatches to template-specific generators.
 */

import { generateJakeLatex } from './generateJakeLatex';
import { generateMarLatex } from './generateMarLatex';
import type { ResumeContent } from './types';

export const RESUME_TEMPLATE_IDS = ['jake', 'mar'] as const;

export function generateResumeLatex(content: ResumeContent, templateId: string): string {
  switch (templateId) {
    case 'jake':
      return generateJakeLatex(content as any);
    case 'mar':
      return generateMarLatex(content);
    default:
      return generateJakeLatex(content as any);
  }
}

export function isValidResumeTemplateId(id: string): id is (typeof RESUME_TEMPLATE_IDS)[number] {
  return RESUME_TEMPLATE_IDS.includes(id as any);
}
