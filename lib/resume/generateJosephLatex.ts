import fs from 'fs';
import path from 'path';
import { ResumeContent, escapeLatex, getFullName } from './types';

/** Build the right-aligned header contact block (each line separated by \\). */
function josephContactLines(content: ResumeContent): string {
  const e = escapeLatex;
  const p = content.personalInfo;
  // Location and citizenship share the top line, separated by a wide gap.
  const line1: string[] = [];
  if (p.location) line1.push(e(p.location));
  if (p.citizenship) line1.push(e(p.citizenship));

  const line2: string[] = [];
  if (p.email) line2.push(`\\href{mailto:${e(p.email)}}{${e(p.email)}}`);
  if (p.phone) line2.push(e(p.phone));

  const extra: string[] = [];
  if (p.linkedin) {
    const h = p.linkedin
      .replace(/^https?:\/\//i, '')
      .replace(/^(www\.)?linkedin\.com\/in\//i, '')
      .replace(/\/$/, '');
    extra.push(`\\href{https://linkedin.com/in/${e(h)}}{linkedin.com/in/${e(h)}}`);
  }
  if (p.github) {
    const h = p.github
      .replace(/^https?:\/\/(www\.)?github\.com\//i, '')
      .replace(/^github\.com\//i, '')
      .replace(/\/$/, '');
    extra.push(`\\href{https://github.com/${e(h)}}{github.com/${e(h)}}`);
  }
  if (p.portfolio) {
    let url = p.portfolio.trim();
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    const display = url.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '');
    extra.push(`\\href{${e(url)}}{${e(display)}}`);
  }

  const lines = [line1.join('\\hspace{8pt}'), line2.join(' $|$ '), ...extra].filter((l) => l.trim());
  return lines.join(' \\\\ ');
}

/** Right-aligned "Location (dates)" meta for an entry line. */
function josephRightMeta(location?: string | null, date?: string | null): string {
  const e = escapeLatex;
  const loc = location ? e(location) : '';
  const dt = date ? e(date) : '';
  if (loc && dt) return `${loc} (${dt})`;
  return loc || dt;
}

export function generateJosephLatex(content: ResumeContent): string {
  const templatePath = path.join(process.cwd(), 'templates/resume/josephLatex.tex');
  if (!fs.existsSync(templatePath)) throw new Error(`Template not found: ${templatePath}`);
  let tex = fs.readFileSync(templatePath, 'utf-8');

  const e = escapeLatex;
  const { fullName } = getFullName(content);
  const sections: string[] = [];

  // Header
  sections.push(`\\josephheader{${e(fullName)}}{${josephContactLines(content)}}`);

  // Profile Summary
  if (content.personalInfo.summary && content.personalInfo.summary.trim()) {
    sections.push(`\\josephsection{Profile Summary}\n${e(content.personalInfo.summary)}`);
  }

  // Core Competencies (pipe list) + Technical Skills (bullets)
  const comps = (content.coreCompetencies || []).filter((c) => c && c.trim());
  const tech = (content.skills?.technical || []).filter((s) => s && s.trim());
  const extraSkills = (content.skills?.additional || []).filter((s) => s && s.trim());
  if (comps.length || tech.length || extraSkills.length) {
    let block = `\\josephsection{Core Competencies}`;
    if (comps.length) block += `\n${comps.map((c) => e(c)).join(' $|$ ')}`;
    if (tech.length) {
      const items = tech.map((s) => `  \\item ${e(s)}`).join('\n');
      block += `\n\n\\vspace{4pt}\\noindent\\textbf{Technical Skills:}\n\\josephbullets{\n${items}\n}`;
    }
    if (extraSkills.length) {
      block += `\n\n\\vspace{4pt}\\noindent\\textbf{Additional Skills:}\n${extraSkills.map((s) => e(s)).join(' $|$ ')}`;
    }
    sections.push(block);
  }

  // Professional Experience (with bullets)
  const exp = (content.experience || []).filter((x) => x && (x.title || x.company));
  if (exp.length) {
    const entries = exp
      .map((x) => {
        const meta = josephRightMeta(x.location, x.date);
        let entry = `\\josephentry{${e(x.title)}}{${e(x.company)}}{${meta}}`;
        const bullets = (x.details || []).filter((d) => typeof d === 'string' && d.trim());
        if (bullets.length) {
          const items = bullets.map((b) => `  \\item ${e(b)}`).join('\n');
          entry += `\n\\josephbullets{\n${items}\n}`;
        }
        return entry;
      })
      .join('\n');
    sections.push(`\\josephsection{Professional Experience}\n${entries}`);
  }

  // Key Projects
  const projects = (content.projects || []).filter((p) => p && p.name);
  if (projects.length) {
    const entries = projects
      .map((p) => {
        let entry = `\\josephsimpleentry{${e(p.name)}}{${p.date ? e(p.date) : ''}}`;
        if (p.description && p.description.trim()) {
          entry += `\n\\josephdesc{${e(p.description)}}`;
        }
        const bullets = (p.details || []).filter((d) => typeof d === 'string' && d.trim());
        const tech = (p.technologies || []).filter((t) => t && t.trim());
        const items = bullets.map((b) => `  \\item ${e(b)}`);
        if (tech.length) {
          items.push(`  \\item \\textbf{Technologies:} ${tech.map((t) => e(t)).join(', ')}`);
        }
        if (items.length) entry += `\n\\josephbullets{\n${items.join('\n')}\n}`;
        return entry;
      })
      .join('\n');
    sections.push(`\\josephsection{Key Projects}\n${entries}`);
  }

  // Early Career Experience (no bullets)
  const early = (content.earlyCareer || []).filter((x) => x && (x.title || x.company));
  if (early.length) {
    const entries = early
      .map((x) => `\\josephentry{${e(x.title)}}{${e(x.company)}}{${josephRightMeta(x.location, x.date)}}`)
      .join('\n');
    sections.push(`\\josephsection{Early Career Experience}\n${entries}`);
  }

  // Education and Professional Development (education + certifications merged)
  const edu = (content.education || []).filter((x) => x && (x.degree || x.name));
  const certs = (content.certifications || []).filter((c) => c && c.name);
  if (edu.length || certs.length) {
    const parts: string[] = [];
    for (const ed of edu) {
      // Only append the field when the degree string doesn't already name it,
      // otherwise "B.S. Software Engineering" + field renders the major twice.
      const fieldIsRedundant =
        !ed.field ||
        !ed.field.trim() ||
        ed.degree.toLowerCase().includes(ed.field.trim().toLowerCase());
      const deg = fieldIsRedundant ? e(ed.degree) : `${e(ed.degree)} in ${e(ed.field!)}`;
      const dates = ed.startDate ? `${e(ed.startDate)} -- ${e(ed.endDate)}` : e(ed.endDate || '');
      parts.push(`\\josephentry{${deg}}{${e(ed.name)}}{${josephRightMeta(ed.location, dates)}}`);
      const bullets = (ed.details || []).filter((d) => typeof d === 'string' && d.trim());
      if (bullets.length) {
        parts.push(`\\josephbullets{\n${bullets.map((b) => `  \\item ${e(b)}`).join('\n')}\n}`);
      }
    }
    for (const c of certs) {
      // Render as a self-contained entry block. Joining name/issuer/date with \\
      // ran consecutive certificates together on one line and spilled a stray page.
      const date = c.date ? e(c.date) : '';
      parts.push(
        c.issuer && c.issuer.trim()
          ? `\\josephentry{${e(c.name)}}{${e(c.issuer)}}{${date}}`
          : `\\josephsimpleentry{${e(c.name)}}{${date}}`
      );
    }
    sections.push(`\\josephsection{Education and Professional Development}\n${parts.join('\n')}`);
  }

  tex = tex.replace('XXXJOSEPHBODYXXX', sections.join('\n\n'));
  return tex;
}
