import fs from 'fs';
import path from 'path';
import { ResumeContent, escapeLatex, getFullName, buildContactLinkParts } from './types';

export function generateVertexLatex(content: ResumeContent): string {
  const templatePath = path.join(process.cwd(), 'templates/resume/vertexLatex.tex');
  if (!fs.existsSync(templatePath)) throw new Error(`Template not found: ${templatePath}`);

  let tex = fs.readFileSync(templatePath, 'utf-8');
  const { fullName } = getFullName(content);
  const e = escapeLatex;
  const linkParts = buildContactLinkParts(content);

  const header = `\\textbf{\\Huge \\scshape ${e(fullName)}}\\\\[4pt]\n\\small ${linkParts.join(' $|$ ')}`;

  const expContent =
    Array.isArray(content.experience) && content.experience.length > 0
      ? content.experience
          .map((exp) => {
            const bullets = (exp.details || []).filter((d) => typeof d === 'string' && d.trim());
            const b =
              bullets.length
                ? `\n    \\vertexItemListStart\n${bullets.map((x) => `      \\vertexItem{${e(x)}}`).join('\n')}\n    \\vertexItemListEnd`
                : '';
            return `    \\vertexSubheading\n      {${e(exp.title)}}{${e(exp.date)}}\n      {${e(exp.company)}}{${e(exp.location || '')}}${b}`;
          })
          .join('\n')
      : '    % No experience';

  const eduContent =
    Array.isArray(content.education) && content.education.length > 0
      ? content.education
          .map((edu) => {
            const deg = `${e(edu.degree)}${edu.field ? ` in ${e(edu.field)}` : ''}`;
            const dates = edu.startDate ? `${e(edu.startDate)} -- ${e(edu.endDate)}` : e(edu.endDate);
            return `    \\vertexSubheading\n      {${e(edu.name)}}{${e(edu.location || '')}}\n      {${deg}}{${dates}}`;
          })
          .join('\n')
      : '    % No education';

  const projContent =
    Array.isArray(content.projects) && content.projects.length > 0
      ? content.projects
          .filter((p) => (p.description || '').trim() || (p.details || []).some((d) => typeof d === 'string' && d.trim()))
          .map((proj) => {
            const bullets = [
              (proj.description || '').trim(),
              ...(proj.details || []).filter((d) => typeof d === 'string' && d.trim()),
            ].filter(Boolean);
            const b =
              bullets.length
                ? `\n    \\vertexItemListStart\n${bullets.map((x) => `      \\vertexItem{${e(x)}}`).join('\n')}\n    \\vertexItemListEnd`
                : '';
            const tech = proj.technologies?.length ? ` $|$ \\emph{${e(proj.technologies.join(', '))}}` : '';
            return `    \\vertexProjectHeading\n      {\\textbf{${e(proj.name)}}${tech}}{${e(proj.date || '')}}${b}`;
          })
          .join('\n')
      : '    % No projects';

  const skillsContent =
    content.skills?.technical?.length || content.skills?.additional?.length
      ? [
          content.skills.technical?.length
            ? `\\textbf{Tech:} ${e(content.skills.technical.join(', '))}`
            : '',
          content.skills.additional?.length
            ? `\\textbf{Other:} ${e(content.skills.additional.join(', '))}`
            : '',
        ]
          .filter(Boolean)
          .join(' \\quad $|$ \\quad ')
      : '';

  tex = tex.replace('XXXVERTEXHEADERXXX', header);
  tex = tex.replace('XXXVERTEXEXPERIENCEXXX', expContent);
  tex = tex.replace('XXXVERTEXEDUCATIONXXX', eduContent);
  tex = tex.replace('XXXVERTEXPROJECTSXXX', projContent);
  tex = tex.replace('XXXVERTEXSKILLSXXX', skillsContent);

  return tex;
}
