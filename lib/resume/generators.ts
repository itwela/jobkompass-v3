/**
 * Resume generator router - dispatches to template-specific generators.
 */

import { generateJakeLatex } from './generateJakeLatex';
import { generateJosephLatex } from './generateJosephLatex';
import { generateMarLatex } from './generateMarLatex';
import type { ResumeContent } from './types';
import { resolveResumeTemplateId } from '../templates';

/**
 * The template registry owns the id list, the legacy-rename map, and validation.
 * Re-exported here so existing importers of this module keep working.
 */
export {
  RESUME_TEMPLATE_IDS,
  isValidResumeTemplateId,
  resolveResumeTemplateId,
} from '../templates';

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
