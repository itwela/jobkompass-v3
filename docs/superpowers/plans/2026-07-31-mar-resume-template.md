> **Note (Aug 1 2026): this template was renamed from `mar` / "Mar" to `joseph` / "Joseph".** File names, LaTeX macros (`\mar*` → `\joseph*`), and the template id all changed; the old `mar` id still resolves for previously-saved resumes. The text below is the original historical record and uses the old name.

# Mar Resume Template Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a second, fully-built resume template ("Mar") that reproduces the reference PDF look and generates correctly across every JobKompass resume surface (website free generator, app Documents form, chat AI, email agent, `jk` CLI).

**Architecture:** Mirror the existing template pattern — a `.tex` file with LaTeX macros + a single body placeholder, plus a TypeScript generator that builds the document body and injects it, dispatched through `lib/resume/generators.ts`. New fields (`phone`, `coreCompetencies`, `earlyCareer`) go into the shared `ResumeContent` type; Convex stores content as `v.any()`, so there is no DB migration. Then remove hardcoded `"jake"` from the five generation surfaces.

**Tech Stack:** Next.js (App Router) + TypeScript, Convex, pdfLaTeX via a remote LaTeX compile service (`texlive/texlive:latest`, so the `carlito`/Calibri package is available), a Node CLI (`cli/`).

## Global Constraints

- Template id: `mar`; display name: `Mar`.
- Mar renders ONLY: header (name, location, email, phone, linkedin, github, portfolio, citizenship), Profile Summary, Core Competencies (pipe list) + Technical Skills (bullets), Professional Experience (bullets), Early Career Experience (no bullets), Education and Professional Development (education + certifications merged). It NEVER renders projects, languages, interests/hobbies, or references.
- No Convex schema migration — `content` is `v.any()`. Changes are TypeScript + UI + generator only.
- Do not smoke-test with real-user agent keys. Use a throwaway userId and revoke it after.
- Deploy targets: Convex live dev slot `dev:proficient-mammoth-632`; frontend via manual `npx vercel --prod` (auto-deploy-on-push is unreliable for this repo).
- Escape all user text with the existing `escapeLatex` from `lib/resume/types.ts`.
- Verification is compile-and-eyeball against the reference PDF plus `npx tsc --noEmit` (this codebase has no unit-test harness for `lib/resume`).

---

### Task 1: Add new fields to the shared resume schema

**Files:**
- Modify: `lib/resume/types.ts` (`ResumeContent` interface)
- Modify: `types/resumeTypes.ts` (mirror the same optional fields)
- Modify: `lib/resume/generateJakeLatex.ts` (`ResumeContentForJake` interface — add the same optional fields so types stay compatible; Jake does not render them)

**Interfaces:**
- Produces: `ResumeContent.personalInfo.phone?: string | null`, `ResumeContent.coreCompetencies?: string[] | null`, `ResumeContent.earlyCareer?: Array<{ title: string; company: string; location?: string | null; date: string }> | null`.

- [ ] **Step 1: Add fields to `lib/resume/types.ts`**

In the `personalInfo` object add `phone?: string | null;` (next to `email`). After the `certifications` field (top level of `ResumeContent`), add:

```ts
  coreCompetencies?: string[] | null;
  earlyCareer?: Array<{
    title: string;
    company: string;
    location?: string | null;
    date: string;
  }> | null;
```

- [ ] **Step 2: Mirror the same three additions in `types/resumeTypes.ts`** (find its resume-content shape and add `phone` to personalInfo + `coreCompetencies` + `earlyCareer`).

- [ ] **Step 3: Mirror in `ResumeContentForJake` in `lib/resume/generateJakeLatex.ts`** — add `phone?: string | null;` to its `personalInfo` and the two top-level optional fields, so a single `ResumeContent` object type-checks for both generators.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (no errors introduced by the new optional fields).

- [ ] **Step 5: Commit**

```bash
git add lib/resume/types.ts types/resumeTypes.ts lib/resume/generateJakeLatex.ts
git commit -m "feat(resume): add phone, coreCompetencies, earlyCareer to ResumeContent"
```

---

### Task 2: Create the Mar LaTeX template

**Files:**
- Create: `templates/resume/marLatex.tex`

**Interfaces:**
- Produces: a `.tex` file with macros `\marheader`, `\marrule`, `\marsection`, `\marentry`, `\marbullets` and a single body token `XXXMARBODYXXX`. The generator (Task 3) builds the whole body and replaces that token.

- [ ] **Step 1: Write the template file**

```latex
%-------------------------
% MAR - Calibri-style, trailing-rule section headings (JobKompass)
% Reproduces the "Joseph Wilson" reference layout.
%------------------------

\documentclass[letterpaper,11pt]{article}

\usepackage[utf8]{inputenc}
\usepackage[T1]{fontenc}
\usepackage[sfdefault]{carlito}   % Calibri-metric font
\usepackage{geometry}
\usepackage{titlesec}
\usepackage{enumitem}
\usepackage[hidelinks]{hyperref}
\usepackage{xcolor}
\usepackage{tabularx}
\usepackage{array}

\geometry{margin=0.6in}
\pagestyle{empty}
\setlength{\parindent}{0pt}
\setlength{\parskip}{0pt}
\raggedright

% Thick rule that fills the rest of the line after a heading.
\newcommand{\marrule}{\leavevmode\leaders\hrule height 1.1pt\hfill\kern0pt}

% Section heading: bold uppercase text + trailing rule to the right margin.
\newcommand{\marsection}[1]{%
  \vspace{12pt}\par\noindent
  {\large\bfseries\MakeUppercase{#1}}\hspace{8pt}\raisebox{0.28ex}{\marrule}%
  \par\vspace{6pt}%
}

% Two-column header: #1 = name (big/bold), #2 = right-aligned contact lines (use \\ between lines).
\newcommand{\marheader}[2]{%
  \noindent
  \begin{tabular*}{\linewidth}{@{}l@{\extracolsep{\fill}}r@{}}
    {\Huge\bfseries #1} &
    \begin{tabular}[b]{@{}r@{}} #2 \end{tabular} \\
  \end{tabular*}%
  \par\vspace{2pt}%
}

% Experience / education entry line: #1 title, #2 company, #3 right-aligned "Location (dates)".
\newcommand{\marentry}[3]{%
  \vspace{4pt}\noindent
  \begin{tabular*}{\linewidth}{@{}l@{\extracolsep{\fill}}r@{}}
    \textbf{#1 $|$ #2} & #3 \\
  \end{tabular*}%
  \par%
}

% Bulleted list for entry details.
\newcommand{\marbullets}[1]{%
  \begin{itemize}[leftmargin=1.6em, topsep=2pt, itemsep=1pt, parsep=0pt]
  #1
  \end{itemize}%
}

\begin{document}

XXXMARBODYXXX

\end{document}
```

- [ ] **Step 2: Sanity-compile the raw template** (optional but recommended) by temporarily replacing `XXXMARBODYXXX` with `Hello` and compiling once against the LaTeX service, to confirm `carlito` and the macros load with no error. Revert the token afterward.

- [ ] **Step 3: Commit**

```bash
git add templates/resume/marLatex.tex
git commit -m "feat(resume): add Mar LaTeX template"
```

---

### Task 3: Create the Mar generator

**Files:**
- Create: `lib/resume/generateMarLatex.ts`

**Interfaces:**
- Consumes: `ResumeContent` (Task 1), `escapeLatex`, `getFullName` from `lib/resume/types.ts`.
- Produces: `export function generateMarLatex(content: ResumeContent): string`.

- [ ] **Step 1: Write the generator**

```ts
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
      .replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//i, '')
      .replace(/^linkedin\.com\/in\//i, '')
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

  const lines = [
    line1.join(''),
    line2.join(' $|$ '),
    ...extra,
  ].filter((l) => l.trim());
  return lines.join(' \\\\ ');
}

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
      const date = c.date ? ` (${e(c.date)})` : '';
      parts.push(`\\vspace{4pt}\\noindent\\textbf{${e(c.name)}}${issuer ? ` \\\\ ${issuer}` : ''}${date ? ` \\\\ ${date.trim()}` : ''}`);
    }
    sections.push(`\\marsection{Education and Professional Development}\n${parts.join('\n')}`);
  }

  tex = tex.replace('XXXMARBODYXXX', sections.join('\n\n'));
  return tex;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add lib/resume/generateMarLatex.ts
git commit -m "feat(resume): add Mar generator"
```

---

### Task 4: Register Mar in the dispatcher and template registry

**Files:**
- Modify: `lib/resume/generators.ts`
- Modify: `lib/templates.ts`
- Modify: `app/api/resume/export/[templateId]/route.ts` (valid-templates error string)

**Interfaces:**
- Consumes: `generateMarLatex` (Task 3).
- Produces: `mar` recognized by `isValidResumeTemplateId`, `generateResumeLatex`, `RESUME_TEMPLATES`, and `getFreeResumeTemplates()`.

- [ ] **Step 1: Wire the dispatcher (`lib/resume/generators.ts`)**

Add `import { generateMarLatex } from './generateMarLatex';`. Add `'mar'` to `RESUME_TEMPLATE_IDS`. Add to the `switch`:

```ts
    case 'mar':
      return generateMarLatex(content);
```

- [ ] **Step 2: Register in `lib/templates.ts`**

Add to `RESUME_TEMPLATES`:

```ts
  {
    id: 'mar',
    name: 'Mar',
    description:
      'Clean Calibri-style resume with bold section headings and a competencies-forward layout. Great for experienced, multi-domain professionals.',
    previewImage: '/images/jobkompass_preview_resume_mar.png',
    tags: ['ATS-Friendly', 'Professional', 'Competencies'],
    features: ['Calibri-style typography', 'Core competencies section', 'Early career summary', 'Merged education & development'],
    freeResumeEligible: true,
  },
```

Update `getFreeResumeTemplates()` to return jake and mar:

```ts
export function getFreeResumeTemplates(): Template[] {
  return RESUME_TEMPLATES.filter((t) => t.id === 'jake' || t.id === 'mar');
}
```

- [ ] **Step 3: Update the error string** in `app/api/resume/export/[templateId]/route.ts` — change `Valid: jake, vertex, minimal, executive, momentum` to include `mar`.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Full compile against the LaTeX service with the reference data**

Start the local LaTeX service (or point at `LATEX_SERVICE_URL`), then POST the Joseph Wilson data to `/api/resume/export/mar` and open the resulting PDF. Compare side-by-side with `~/Downloads/Joseph Wilson.pdf`: header two-column layout, uppercase headings with trailing rule, section order, Calibri look. Iterate on `marLatex.tex` spacing/macros until it matches. (Save the Joseph Wilson payload as a fixture JSON in `temp/` for reuse.)

Expected: a two-page PDF visually matching the reference.

- [ ] **Step 6: Commit**

```bash
git add lib/resume/generators.ts lib/templates.ts "app/api/resume/export/[templateId]/route.ts"
git commit -m "feat(resume): register Mar template and enable in free generator"
```

---

### Task 5: Generate the preview image

**Files:**
- Create: `public/images/jobkompass_preview_resume_mar.png`

- [ ] **Step 1: Render page 1 to PNG.** From the PDF produced in Task 4 Step 5, convert its first page to PNG (e.g. `pdftoppm -png -r 150 -f 1 -l 1 mar.pdf mar_preview` or macOS `sips`/`qlmanage`), crop to the page, and save as `public/images/jobkompass_preview_resume_mar.png`.

- [ ] **Step 2: Verify** the registry entry from Task 4 references this exact path.

- [ ] **Step 3: Commit**

```bash
git add public/images/jobkompass_preview_resume_mar.png
git commit -m "feat(resume): add Mar preview image"
```

---

### Task 6: Unlock the app Documents form

**Files:**
- Modify: `app/jk-components/jk-chatwindow-components/jkChatWindow-DocumentsForm.tsx` (approx lines 343, 407, 451)

**Interfaces:**
- Consumes: the existing template-selection state / `jkTemplateSelector` in this component; `getDefaultResumeTemplateId()` from `lib/templates.ts`.

- [ ] **Step 1: Read the file** and find the currently-selected template value the form already tracks (the DocumentsForm renders a template selector). If no selection state exists, add one defaulting to `getDefaultResumeTemplateId()` and wire it to the existing `jkTemplateSelector`/`jkTemplateSelectionModal`.

- [ ] **Step 2: Replace the hardcoded export URL** at line ~407: change `fetch("/api/resume/export/jake", …)` to `fetch(\`/api/resume/export/${selectedTemplateId}\`, …)`.

- [ ] **Step 3: Replace the hardcoded `template: "jake"`** at lines ~343 and ~451 with `template: selectedTemplateId`.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/jk-components/jk-chatwindow-components/jkChatWindow-DocumentsForm.tsx
git commit -m "feat(resume): Documents form respects selected template"
```

---

### Task 7: Unlock the chat AI resume tool

**Files:**
- Modify: `app/ai/tools/file.ts` (line ~100 `templateId: z.enum(['jake'])`, ~150, ~502)
- Modify: `app/ai/constants/file.ts` (guidance strings, ~74, ~164)
- Verify: `app/api/chat/route.ts` (~100-102 default logic already honors `RESUME_TEMPLATE_PREFERENCE`)

- [ ] **Step 1:** Change `templateId: z.enum(['jake']).default('jake')` to `z.enum(['jake', 'mar']).default('jake')` and update its `.describe(...)` to say both templates are available.

- [ ] **Step 2:** Ensure the tool passes `templateId` through to the export call (line ~150 area) instead of forcing `'jake'`, and that the saved document's `template` field (line ~502) uses the chosen `templateId`.

- [ ] **Step 3:** Update the guidance in `app/ai/constants/file.ts` to stop saying "jake is the only template" — say Mar is also available and to use `RESUME_TEMPLATE_PREFERENCE`.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/ai/tools/file.ts app/ai/constants/file.ts
git commit -m "feat(resume): chat AI can generate Mar template"
```

---

### Task 8: Unlock the email agent auto-tailoring

**Files:**
- Modify: `convex/emailAgent/draft.ts` (export URLs at ~54, ~128; `template` fields at ~76, ~147)

**Interfaces:**
- Consumes: `baseResume.template` (already read for the stored `template` field).

- [ ] **Step 1:** At each `/api/resume/export/jake` call site (~54, ~128), change the URL to use the base resume's template: `\`${appBaseUrl}/api/resume/export/${baseResume.template || "jake"}\``.

- [ ] **Step 2:** Confirm the `template:` fields at ~76 and ~147 already use `baseResume.template || "jake"` (leave as-is if so).

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add convex/emailAgent/draft.ts
git commit -m "feat(resume): email agent tailors using the base resume's template"
```

---

### Task 9: Unlock the agent API + CLI

**Files:**
- Modify: `convex/agent/fns.ts` (`resumesGenerate` — args, built `content`, export URL ~273, stored `template` ~307)
- Modify: `convex/agent/routes.ts` (if the route validator lists resume args explicitly — add the new ones)
- Modify: `cli/src/commands.ts` (`resumes add` opts ~80-91)

**Interfaces:**
- Produces: `resumesGenerate` accepts `template?: string`, `coreCompetencies?: string[]`, `earlyCareer?: [...]`, and `phone` inside `personalInfo`; CLI `jk resumes add` exposes `--template`, `--core-competencies`, `--early-career`.

- [ ] **Step 1:** In `convex/agent/fns.ts` `resumesGenerate`, add optional args `template` (string), `coreCompetencies`, `earlyCareer`, and `phone` in the `personalInfo` validator. Include `coreCompetencies` and `earlyCareer` in the built `content` object. Change the export URL (~273) to `\`${appBaseUrl}/api/resume/export/${args.template || "jake"}\`` and the stored `template` (~307) to `args.template || "jake"`. If `personalInfo` is a strict validator, add `phone: v.optional(v.union(v.string(), v.null()))`.

- [ ] **Step 2:** If `convex/agent/routes.ts` declares the request body shape for `/agent/resumes/generate`, add the new optional fields there too so the HTTP layer forwards them.

- [ ] **Step 3:** In `cli/src/commands.ts`, update the `resumes add` entry: change desc from "(Jake template)" to note template choice, add `phone` to the `--personal-info` desc, and add opts:

```ts
      { flag: "--template <id>", api: "template", type: "str", desc: "Template id: jake (default) or mar" },
      { flag: "--core-competencies <json>", api: "coreCompetencies", type: "json", desc: '["Technical Support","Problem-Solving",...] (Mar template)' },
      { flag: "--early-career <json>", api: "earlyCareer", type: "json", desc: '[{title,company,location?,date}] (Mar template)' },
```

- [ ] **Step 4:** Build the CLI: `cd cli && npm run build` (or the repo's build script). Typecheck the app: `npx tsc --noEmit`.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add convex/agent/fns.ts convex/agent/routes.ts cli/src/commands.ts
git commit -m "feat(resume): agent API + jk CLI support template choice and Mar fields"
```

---

### Task 10: Editor UI for the new fields

**Files:**
- Modify: `app/jk-components/jk-chatwindow-components/jkChatWindow-ResumeContentEditor.tsx` (and/or `jkChatWindow-ResumeContentEditor` companions, and the free-generator form under `app/free-resume-generator`)

- [ ] **Step 1: Read the content editor** and locate how existing fields (e.g. `personalInfo.linkedin`, `skills.technical`, `experience[]`) are rendered and bound.

- [ ] **Step 2: Add a `phone` input** to the personal-info section, following the exact markup/binding pattern of the adjacent `email`/`linkedin` inputs.

- [ ] **Step 3: Add a Core Competencies editor** — a list-of-strings input following the same pattern used for `skills.technical` (add/remove chips or comma-split), bound to `coreCompetencies`.

- [ ] **Step 4: Add an Early Career editor** — a repeatable group of `{title, company, location, date}` following the pattern used for `experience[]` but without the details/bullets sub-editor, bound to `earlyCareer`.

- [ ] **Step 5:** Mirror the same three inputs in the `app/free-resume-generator` form so the fields are fillable there too.

- [ ] **Step 6: Typecheck + manual check**

Run: `npx tsc --noEmit` then run the app locally, open the resume editor, fill the new fields, generate a Mar PDF, and confirm they render.
Expected: PASS + fields appear in output.

- [ ] **Step 7: Commit**

```bash
git add app/jk-components/jk-chatwindow-components/ app/free-resume-generator/
git commit -m "feat(resume): editor + free generator expose phone, core competencies, early career"
```

---

### Task 11: Docs — skill + CLI README

**Files:**
- Modify: `~/.claude/skills/jobkompass-add-resume/SKILL.md` (and the vault synced copy if applicable)
- Modify: `cli/README.md`

- [ ] **Step 1:** Update `jobkompass-add-resume` to document `--template mar`, the `phone` field, and the Mar-only `--core-competencies` / `--early-career` fields, with an example `jk resumes add --template mar …` command.

- [ ] **Step 2:** Update `cli/README.md` (`resumes add` example) to show template selection and the new flags.

- [ ] **Step 3: Commit**

```bash
git add cli/README.md
git commit -m "docs(resume): document Mar template and new fields in CLI"
```

---

### Task 12: Deploy and end-to-end verification

- [ ] **Step 1: Deploy Convex** to the live dev slot:

```bash
cd "/Users/itwelaibomu/Desktop/Code/jobkompass-v3"
CONVEX_DEPLOYMENT=dev:proficient-mammoth-632 npx convex dev --once
```

Before running, check `git status` on `convex/` — this deploys the whole working-tree `convex/` dir, not just edited files.

- [ ] **Step 2: Deploy the frontend:**

```bash
npx vercel --prod
```

Confirm the deployment reaches READY (auto-deploy-on-push is unreliable for this repo).

- [ ] **Step 3: Verify each surface with `mar`:**
  - Website free generator: select Mar, generate, confirm PDF.
  - App Documents form: select Mar, generate.
  - Chat: ask the AI to make a Mar resume.
  - CLI: `jk resumes add --template mar --personal-info '{…phone…}' --core-competencies '[…]' --early-career '[…]' …` then `jk resumes get` / download and open the PDF. Use a throwaway userId; revoke its key after.
  - Email agent: set a base resume with `template: "mar"` and confirm a tailored lead resume uses Mar.

- [ ] **Step 4: Confirm Jake is unaffected** — generate a Jake resume; new fields are ignored, phone renders when present.

- [ ] **Step 5: Final commit / push** (only when Itwela asks to push).

---

## Self-Review

- **Spec coverage:** schema (T1), template (T2), generator (T3), registry+dispatcher+free-generator (T4), preview image (T5), all five surfaces — website form (T6), chat (T7), email agent (T8), CLI/agent API (T9), free generator (T4/T10) — editor UI (T10), docs (T11), verification+rollout (T12). All spec sections mapped.
- **Placeholder scan:** none — real code for the template and generator; precise file/line edits for wiring; UI task points at concrete patterns to mirror.
- **Type consistency:** `coreCompetencies: string[]`, `earlyCareer: {title,company,location?,date}[]`, `personalInfo.phone` used identically in Tasks 1, 3, 9, 10. `generateMarLatex(content: ResumeContent)` signature matches the dispatcher call in Task 4.
