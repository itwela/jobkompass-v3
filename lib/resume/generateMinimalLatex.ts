import fs from 'fs';
import path from 'path';
import { ResumeContent, escapeLatex, getFullName, buildContactLinkParts } from './types';

export function generateMinimalLatex(content: ResumeContent): string {
  const templatePath = path.join(process.cwd(), 'templates/resume/minimalLatex.tex');
  if (!fs.existsSync(templatePath)) throw new Error(`Template not found: ${templatePath}`);

  let tex = fs.readFileSync(templatePath, 'utf-8');
  const { fullName } = getFullName(content);
  const e = escapeLatex;
  const linkParts = buildContactLinkParts(content);

  const header = `\\begin{center}\n{\\LARGE\\bfseries ${e(fullName)}}\\\\[4pt]\n\\small ${linkParts.join(' \\quad $|$ \\quad ')}\n\\end{center}`;

  const expContent =
    Array.isArray(content.experience) && content.experience.length > 0
      ? content.experience
          .map((exp) => {
            const bullets = (exp.details || []).filter((d) => typeof d === 'string' && d.trim());
            const b = bullets.length ? `\n\\begin{itemize}[leftmargin=*, nosep]\n${bullets.map((x) => `\\item ${e(x)}`).join('\n')}\n\\end{itemize}` : '';
            return `\\textbf{${e(exp.title)}} at ${e(exp.company)} \\hfill ${e(exp.date)}\\\\${exp.location ? e(exp.location) + '\\\\' : ''}${b}`;
          })
          .join('\\\\[10pt]\n')
      : '';

  const eduContent =
    Array.isArray(content.education) && content.education.length > 0
      ? content.education
          .map((edu) => {
            const deg = `${e(edu.degree)}${edu.field ? ` in ${e(edu.field)}` : ''}`;
            const dates = edu.startDate ? `${e(edu.startDate)} -- ${e(edu.endDate)}` : e(edu.endDate);
            return `\\textbf{${e(edu.name)}}\\\\${deg}\\\\${dates}`;
          })
          .join('\\\\[8pt]\n')
      : '';

  const projContent =
    Array.isArray(content.projects) && content.projects.length > 0
      ? content.projects
          .filter((p) => (p.description || '').trim() || (p.details || []).some((d) => typeof d === 'string' && d.trim()))
          .map((proj) => {
            const bullets = [(proj.description || '').trim(), ...(proj.details || []).filter((d) => typeof d === 'string' && d.trim())].filter(Boolean);
            const b = bullets.length ? `\n\\begin{itemize}[leftmargin=*, nosep]\n${bullets.map((x) => `\\item ${e(x)}`).join('\n')}\n\\end{itemize}` : '';
            const tech = proj.technologies?.length ? ` \\emph{${e(proj.technologies.join(', '))}}` : '';
            return `\\textbf{${e(proj.name)}}${tech} \\hfill ${e(proj.date || '')}\\\\${b}`;
          })
          .join('\\\\[10pt]\n')
      : '';

  const skillsContent =
    content.skills?.technical?.length || content.skills?.additional?.length
      ? [
          content.skills.technical?.length ? e(content.skills.technical.join(', ')) : '',
          content.skills.additional?.length ? e(content.skills.additional.join(', ')) : '',
        ]
          .filter(Boolean)
          .join(' \\quad $|$ \\quad ')
      : '';

  tex = tex.replace('XXXMINIMALHEADERXXX', header);
  tex = tex.replace('XXXMINIMALEXPERIENCEXXX', expContent);
  tex = tex.replace('XXXMINIMALEDUCATIONXXX', eduContent);
  tex = tex.replace('XXXMINIMALPROJECTSXXX', projContent);
  tex = tex.replace('XXXMINIMALSKILLSXXX', skillsContent);

  return tex;
}
