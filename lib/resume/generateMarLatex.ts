import fs from 'fs';
import path from 'path';
import { ResumeContent, escapeLatex, getFullName } from './types';

/** Contact line for page 1: location | phone | email | Linkedin | GitHub | portfolio. */
function marFirstPageContact(content: ResumeContent): string {
  const e = escapeLatex;
  const p = content.personalInfo;
  const parts: string[] = [];

  if (p.location) parts.push(e(p.location));
  if (p.citizenship) parts.push(e(p.citizenship));
  if (p.phone) parts.push(e(p.phone));
  if (p.email) parts.push(`\\href{mailto:${e(p.email)}}{${e(p.email)}}`);

  // The reference links these as the plain words "Linkedin"/"GitHub" rather
  // than spelling out the full URL.
  if (p.linkedin) {
    const h = p.linkedin
      .replace(/^https?:\/\//i, '')
      .replace(/^(www\.)?linkedin\.com\/in\//i, '')
      .replace(/\/$/, '');
    parts.push(`\\href{https://linkedin.com/in/${e(h)}}{Linkedin}`);
  }
  if (p.github) {
    const h = p.github
      .replace(/^https?:\/\/(www\.)?github\.com\//i, '')
      .replace(/^github\.com\//i, '')
      .replace(/\/$/, '');
    parts.push(`\\href{https://github.com/${e(h)}}{GitHub}`);
  }
  if (p.portfolio) {
    let url = p.portfolio.trim();
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    parts.push(`\\href{${e(url)}}{Portfolio}`);
  }

  return parts.join(' \\textbar{} ');
}

/** Reduced contact line repeated on continuation pages: phone | email. */
function marContinuationContact(content: ResumeContent): string {
  const e = escapeLatex;
  const p = content.personalInfo;
  const parts: string[] = [];
  if (p.phone) parts.push(e(p.phone));
  if (p.email) parts.push(`\\href{mailto:${e(p.email)}}{${e(p.email)}}`);
  return parts.join(' \\textbar{} ');
}

/** Join the non-empty pieces of an entry's left column with pipes. */
function marEntryLeft(parts: Array<string | null | undefined>): string {
  return parts.filter((p) => p && String(p).trim()).join(' \\textbar{} ');
}

/** Right column: "Location  Date", or whichever of the two exists. */
function marRightMeta(date?: string | null): string {
  return date ? escapeLatex(date) : '';
}

function marBulletBlock(details?: string[] | null): string {
  const bullets = (details || []).filter((d) => typeof d === 'string' && d.trim());
  if (!bullets.length) return '';
  const items = bullets.map((b) => `  \\item ${escapeLatex(b)}`).join('\n');
  return `\n\\marbullets{\n${items}\n}`;
}

/**
 * Render one experience-shaped entry: bold title, then company and location,
 * with the date right-aligned and bullets underneath.
 */
function marExperienceEntry(x: {
  title: string;
  company: string;
  location?: string | null;
  date: string;
  details?: string[] | null;
}): string {
  const e = escapeLatex;
  const left = marEntryLeft([`\\textbf{${e(x.title)}}`, e(x.company), x.location ? e(x.location) : null]);
  return `\\marentry{${left}}{${marRightMeta(x.date)}}${marBulletBlock(x.details)}`;
}

export function generateMarLatex(content: ResumeContent): string {
  const templatePath = path.join(process.cwd(), 'templates/resume/marLatex.tex');
  if (!fs.existsSync(templatePath)) throw new Error(`Template not found: ${templatePath}`);
  let tex = fs.readFileSync(templatePath, 'utf-8');

  const e = escapeLatex;
  const { fullName } = getFullName(content);
  const sections: string[] = [];

  // Header (installs both the first-page and continuation page styles).
  sections.push(
    `\\marsetheaders{${e(fullName)}}{${marFirstPageContact(content)}}{${marContinuationContact(content)}}`
  );

  // Professional Summary
  if (content.personalInfo.summary && content.personalInfo.summary.trim()) {
    sections.push(`\\marsection{Professional Summary}\n\\marpara{${e(content.personalInfo.summary)}}`);
  }

  // Technical Skills — one "Label: values" line per category.
  //
  // `technical` is a FLAT array: the category prefix rides on the first skill of
  // each group and the rest follow bare ("Languages: Python", "TypeScript",
  // "JavaScript", "Frontend: React", ...) — that's the shape Joseph renders as
  // one bullet per item. So a colon-bearing item OPENS a category and every bare
  // item after it belongs to that category, comma-joined onto the same line.
  // Emitting a line per item instead is what made page 1 run one skill per row.
  // An entry already written whole ("Label: a, b, c") still works: it opens a
  // category whose values are already comma-separated.
  // coreCompetencies rides along as its own label line so switching a resume
  // from Joseph to Mar doesn't silently drop it.
  const tech = (content.skills?.technical || []).filter((s) => s && s.trim());
  const extraSkills = (content.skills?.additional || []).filter((s) => s && s.trim());
  const comps = (content.coreCompetencies || []).filter((c) => c && c.trim());
  if (tech.length || extraSkills.length || comps.length) {
    const lines: string[] = [];

    // Groups are emitted in encounter order. `label: null` holds any bare items
    // that appear before the first category so they aren't dropped.
    const groups: Array<{ label: string | null; values: string[] }> = [];
    for (const raw of tech) {
      const s = raw.trim();
      // Only a real label colon opens a category — not the one in "https://".
      const idx = s.indexOf(':');
      const isLabel = idx > 0 && s[idx + 1] !== '/';
      if (isLabel) {
        const rest = s.slice(idx + 1).trim();
        groups.push({ label: s.slice(0, idx + 1), values: rest ? [rest] : [] });
      } else if (groups.length) {
        groups[groups.length - 1].values.push(s);
      } else {
        groups.push({ label: null, values: [s] });
      }
    }

    for (const g of groups) {
      const values = g.values.filter((v) => v).join(', ');
      if (g.label === null) {
        if (values) lines.push(`\\marpara{${e(values)}}`);
      } else {
        lines.push(`\\marskillline{${e(g.label)}}{${e(values)}}`);
      }
    }
    if (comps.length) {
      lines.push(`\\marskillline{Core Competencies:}{${comps.map((c) => e(c)).join(', ')}}`);
    }
    if (extraSkills.length) {
      lines.push(`\\marskillline{Additional Skills:}{${extraSkills.map((s) => e(s)).join(', ')}}`);
    }
    sections.push(`\\marsection{Technical Skills}\n${lines.join('\n')}`);
  }

  // Education & Certifications (merged, as in the reference)
  const edu = (content.education || []).filter((x) => x && (x.degree || x.name));
  const certs = (content.certifications || []).filter((c) => c && c.name);
  if (edu.length || certs.length) {
    const parts: string[] = [];
    for (const ed of edu) {
      // Don't repeat the major when the degree string already names it
      // ("B.S. Computer Science" + field would render it twice).
      const fieldIsRedundant =
        !ed.field ||
        !ed.field.trim() ||
        ed.degree.toLowerCase().includes(ed.field.trim().toLowerCase());
      const deg = fieldIsRedundant ? e(ed.degree) : `${e(ed.degree)} in ${e(ed.field!)}`;
      const dates = ed.startDate ? `${e(ed.startDate)} -- ${e(ed.endDate)}` : e(ed.endDate || '');
      const left = marEntryLeft([`\\textbf{${e(ed.name)}}`, deg, ed.location ? e(ed.location) : null]);
      parts.push(`\\marentry{${left}}{${dates}}${marBulletBlock(ed.details)}`);
    }
    for (const c of certs) {
      const left = marEntryLeft([`\\textbf{${e(c.name)}}`, c.issuer ? e(c.issuer) : null]);
      parts.push(`\\marentry{${left}}{${marRightMeta(c.date)}}`);
    }
    sections.push(`\\marsection{Education \\& Certifications}\n${parts.join('\n')}`);
  }

  // Professional Experience
  const exp = (content.experience || []).filter((x) => x && (x.title || x.company));
  if (exp.length) {
    sections.push(`\\marsection{Professional Experience}\n${exp.map(marExperienceEntry).join('\n')}`);
  }

  // Internships
  const internships = (content.internships || []).filter((x) => x && (x.title || x.company));
  if (internships.length) {
    sections.push(`\\marsection{Internships}\n${internships.map(marExperienceEntry).join('\n')}`);
  }

  // Early Career — Joseph-only field, rendered here without bullets so the
  // data survives a template switch rather than disappearing.
  const early = (content.earlyCareer || []).filter((x) => x && (x.title || x.company));
  if (early.length) {
    const entries = early
      .map((x) => {
        const left = marEntryLeft([`\\textbf{${e(x.title)}}`, e(x.company), x.location ? e(x.location) : null]);
        return `\\marentry{${left}}{${marRightMeta(x.date)}}`;
      })
      .join('\n');
    sections.push(`\\marsection{Early Career}\n${entries}`);
  }

  // Technical Projects
  const projects = (content.projects || []).filter((p) => p && p.name);
  if (projects.length) {
    const entries = projects
      .map((p) => {
        const left = marEntryLeft([`\\textbf{${e(p.name)}}`, p.description ? e(p.description) : null]);
        let entry = `\\marentry{${left}}{${marRightMeta(p.date)}}`;
        const details = (p.details || []).filter((d) => typeof d === 'string' && d.trim());
        const techs = (p.technologies || []).filter((t) => t && t.trim());
        const items = details.map((b) => `  \\item ${e(b)}`);
        if (techs.length) {
          items.push(`  \\item \\textbf{Technologies:} ${techs.map((t) => e(t)).join(', ')}`);
        }
        if (items.length) entry += `\n\\marbullets{\n${items.join('\n')}\n}`;
        return entry;
      })
      .join('\n');
    sections.push(`\\marsection{Technical Projects}\n${entries}`);
  }

  tex = tex.replace('XXXMARBODYXXX', sections.join('\n\n'));
  return tex;
}
