/**
 * Resume generator router - dispatches to template-specific generators.
 */

import { generateJakeLatex } from './generateJakeLatex';
import { generateVertexLatex } from './generateVertexLatex';
import { generateMinimalLatex } from './generateMinimalLatex';
import { generateExecutiveLatex } from './generateExecutiveLatex';
import { generateMomentumLatex } from './generateMomentumLatex';
import type { ResumeContent } from './types';

export const RESUME_TEMPLATE_IDS = ['jake', 'vertex', 'minimal', 'executive', 'momentum'] as const;

export function generateResumeLatex(content: ResumeContent, templateId: string): string {
  // Legacy: apex was replaced by vertex
  const resolved = templateId === 'apex' ? 'vertex' : templateId;
  switch (resolved) {
    case 'jake':
      return generateJakeLatex(content as any);
    case 'vertex':
      return generateVertexLatex(content);
    case 'minimal':
      return generateMinimalLatex(content);
    case 'executive':
      return generateExecutiveLatex(content);
    case 'momentum':
      return generateMomentumLatex(content);
    default:
      return generateJakeLatex(content as any);
  }
}

export function isValidResumeTemplateId(id: string): id is (typeof RESUME_TEMPLATE_IDS)[number] {
  return RESUME_TEMPLATE_IDS.includes(id as any);
}
