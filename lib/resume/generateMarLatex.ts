import fs from 'fs';
import path from 'path';
import { ResumeContent, escapeLatex, getFullName } from './types';

/** Build the right-aligned header contact block (each line separated by \\). */
function marContactLines(content: ResumeContent): string {
  const e = escapeLatex;
  const p = content.personalInfo;
  const line1: string[] = [];
  if (p.location) line1.push(e(p.location));

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
  if (p.citizenship) extra.push(e(p.citizenship));

  const lines = [line1.join(''), line2.join(' $|$ '), ...extra].filter((l) => l.trim());
  return lines.join(' \\\\ ');
}

/** Right-aligned "Location (dates)" meta for an entry line. */
function marRightMeta(location?: string | null, date?: string | null): string {
  const e = escapeLatex;
  const loc = location ? e(location) : '';
  const dt = date ? e(date) : '';
  if (loc && dt) return `${loc} (${dt})`;
  return loc || dt;
}

export function generateMarLatex(content: ResumeContent): string {
  const templatePath = path.join(process.cwd(), 'templates/resume/marLatex.tex');
  if (!fs.existsSync(templatePath)) throw new Error(`Template not found: ${templatePath}`);
  let tex = fs.readFileSync(templatePath, 'utf-8');

  const e = escapeLatex;
  const { fullName } = getFullName(content);
  const sections: string[] = [];

  // Header
  sections.push(`\\marheader{${e(fullName)}}{${marContactLines(content)}}`);

  // Profile Summary
  if (content.personalInfo.summary && content.personalInfo.summary.trim()) {
    sections.push(`\\marsection{Profile Summary}\n${e(content.personalInfo.summary)}`);
  }

  // Core Competencies (pipe list) + Technical Skills (bullets)
  const comps = (content.coreCompetencies || []).filter((c) => c && c.trim());
  const tech = (content.skills?.technical || []).filter((s) => s && s.trim());
  if (comps.length || tech.length) {
    let block = `\\marsection{Core Competencies}`;
    if (comps.length) block += `\n${comps.map((c) => e(c)).join(' $|$ ')}`;
    if (tech.length) {
      const items = tech.map((s) => `  \\item ${e(s)}`).join('\n');
      block += `\n\n\\vspace{4pt}\\noindent\\textbf{Technical Skills:}\n\\marbullets{\n${items}\n}`;
    }
    sections.push(block);
  }

  // Professional Experience (with bullets)
  const exp = (content.experience || []).filter((x) => x && (x.title || x.company));
  if (exp.length) {
    const entries = exp
      .map((x) => {
        const meta = marRightMeta(x.location, x.date);
        let entry = `\\marentry{${e(x.title)}}{${e(x.company)}}{${meta}}`;
        const bullets = (x.details || []).filter((d) => typeof d === 'string' && d.trim());
        if (bullets.length) {
          const items = bullets.map((b) => `  \\item ${e(b)}`).join('\n');
          entry += `\n\\marbullets{\n${items}\n}`;
        }
        return entry;
      })
      .join('\n');
    sections.push(`\\marsection{Professional Experience}\n${entries}`);
  }

  // Early Career Experience (no bullets)
  const early = (content.earlyCareer || []).filter((x) => x && (x.title || x.company));
  if (early.length) {
    const entries = early
      .map((x) => `\\marentry{${e(x.title)}}{${e(x.company)}}{${marRightMeta(x.location, x.date)}}`)
      .join('\n');
    sections.push(`\\marsection{Early Career Experience}\n${entries}`);
  }

  // Education and Professional Development (education + certifications merged)
  const edu = (content.education || []).filter((x) => x && (x.degree || x.name));
  const certs = (content.certifications || []).filter((c) => c && c.name);
  if (edu.length || certs.length) {
    const parts: string[] = [];
    for (const ed of edu) {
      const deg = `${e(ed.degree)}${ed.field ? ` in ${e(ed.field)}` : ''}`;
      const dates = ed.startDate ? `${e(ed.startDate)} -- ${e(ed.endDate)}` : e(ed.endDate || '');
      parts.push(`\\marentry{${deg}}{${e(ed.name)}}{${marRightMeta(ed.location, dates)}}`);
      const bullets = (ed.details || []).filter((d) => typeof d === 'string' && d.trim());
      if (bullets.length) {
        parts.push(`\\marbullets{\n${bullets.map((b) => `  \\item ${e(b)}`).join('\n')}\n}`);
      }
    }
    for (const c of certs) {
      const issuer = c.issuer ? e(c.issuer) : '';
      const date = c.date ? `(${e(c.date)})` : '';
      let cert = `\\vspace{4pt}\\noindent\\textbf{${e(c.name)}}`;
      if (issuer) cert += ` \\\\ ${issuer}`;
      if (date) cert += ` \\\\ ${date}`;
      parts.push(cert);
    }
    sections.push(`\\marsection{Education and Professional Development}\n${parts.join('\n')}`);
  }

  tex = tex.replace('XXXMARBODYXXX', sections.join('\n\n'));
  return tex;
}
