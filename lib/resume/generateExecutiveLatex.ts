import fs from 'fs';
import path from 'path';
import { ResumeContent, escapeLatex, getFullName, buildContactLinkParts } from './types';

export function generateExecutiveLatex(content: ResumeContent): string {
  const templatePath = path.join(process.cwd(), 'templates/resume/executiveLatex.tex');
  if (!fs.existsSync(templatePath)) throw new Error(`Template not found: ${templatePath}`);

  let tex = fs.readFileSync(templatePath, 'utf-8');
  const { fullName } = getFullName(content);
  const e = escapeLatex;
  const linkParts = buildContactLinkParts(content);

  const header = `{\\Large\\bfseries\\scshape ${e(fullName)}}\\\\[6pt]\n\\small ${linkParts.join(' \\quad $|$ \\quad ')}`;

  const expContent =
    Array.isArray(content.experience) && content.experience.length > 0
      ? content.experience
          .map((exp) => {
            const bullets = (exp.details || []).filter((d) => typeof d === 'string' && d.trim());
            const b = bullets.length ? `\n\\begin{itemize}[leftmargin=*, nosep]\n${bullets.map((x) => `\\item ${e(x)}`).join('\n')}\n\\end{itemize}` : '';
            return `\\textbf{${e(exp.title)}}, ${e(exp.company)} \\hfill ${e(exp.date)}\\\\${exp.location ? e(exp.location) + '\\\\' : ''}${b}`;
          })
          .join('\\\\[14pt]\n')
      : '';

  const eduContent =
    Array.isArray(content.education) && content.education.length > 0
      ? content.education
          .map((edu) => {
            const deg = `${e(edu.degree)}${edu.field ? ` in ${e(edu.field)}` : ''}`;
            const dates = edu.startDate ? `${e(edu.startDate)} -- ${e(edu.endDate)}` : e(edu.endDate);
            return `\\textbf{${e(edu.name)}}\\\\${deg}\\\\${dates}`;
          })
          .join('\\\\[10pt]\n')
      : '';

  const projContent =
    Array.isArray(content.projects) && content.projects.length > 0
      ? content.projects
          .filter((p) => (p.description || '').trim() || (p.details || []).some((d) => typeof d === 'string' && d.trim()))
          .map((proj) => {
            const bullets = [(proj.description || '').trim(), ...(proj.details || []).filter((d) => typeof d === 'string' && d.trim())].filter(Boolean);
            const b = bullets.length ? `\n\\begin{itemize}[leftmargin=*, nosep]\n${bullets.map((x) => `\\item ${e(x)}`).join('\n')}\n\\end{itemize}` : '';
            return `\\textbf{${e(proj.name)}} \\hfill ${e(proj.date || '')}\\\\${b}`;
          })
          .join('\\\\[14pt]\n')
      : '';

  const skillsParts: string[] = [];
  if (content.skills?.technical?.length) {
    skillsParts.push(`\\textbf{Technical:} ${e(content.skills.technical.join(', '))}`);
  }
  if (content.skills?.additional?.length) {
    skillsParts.push(`\\textbf{Additional:} ${e(content.skills.additional.join(', '))}`);
  }
  const skillsContent = skillsParts.length > 0 ? skillsParts.join(' \\\\[6pt]\n') : '';

  tex = tex.replace('XXXEXECHEADERXXX', header);
  tex = tex.replace('XXXEXECEXPERIENCEXXX', expContent);
  tex = tex.replace('XXXEXECEDUCATIONXXX', eduContent);
  tex = tex.replace('XXXEXECPROJECTSXXX', projContent);
  tex = tex.replace('XXXEXECSKILLSXXX', skillsContent);

  return tex;
}
