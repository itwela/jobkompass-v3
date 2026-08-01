> **Note (Aug 1 2026): this template was renamed from `mar` / "Mar" to `joseph` / "Joseph".** File names, LaTeX macros (`\mar*` → `\joseph*`), and the template id all changed; the old `mar` id still resolves for previously-saved resumes. The text below is the original historical record and uses the old name.

# Mar Resume Template — Design

**Date:** 2026-07-31
**Status:** Approved (field set locked)

## Goal

Add a second, fully-built resume template called **Mar** to JobKompass. It must:

1. Reproduce the visual look of the reference PDF (`Joseph Wilson.pdf`) — a clean, Calibri-style
   document with bold uppercase section headings that trail a horizontal rule to the right margin.
2. Render **exactly** the fields present in the reference (plus the extra header contact fields
   github/portfolio/citizenship). No projects, languages, hobbies/interests, or references.
3. Be selectable and generate correctly across **every** place JobKompass produces a resume:
   the website free generator, the app Documents form, the in-app chat AI, the email agent's
   auto-tailoring, and the `jk` CLI / agent API.

Built in LaTeX, same pipeline as the existing **Jake** template (pdfLaTeX → LaTeX compile service).

## Reference layout

- **Header** (two columns): large bold name on the left; a right-aligned contact block:
  `Location` / `email | phone` / `linkedin` (and, for Mar, also github / portfolio / citizenship
  when present).
- **Section heading**: bold UPPERCASE label followed by `\hrulefill` — a rule running from the end
  of the label to the right margin. This is the template's signature.
- Sections, in order: Profile Summary → Core Competencies → Professional Experience →
  Early Career Experience → Education and Professional Development.

## Field set (locked)

Mar renders ONLY these:

| Section | Source field |
|---|---|
| Header: name, location, email, **phone**, linkedin, github, portfolio, citizenship | `personalInfo` (+ new `phone`) |
| Profile Summary | `personalInfo.summary` |
| Core Competencies (pipe-separated inline list) | new `coreCompetencies: string[]` |
| Technical Skills (bulleted list, under the Core Competencies heading) | existing `skills.technical` |
| Professional Experience (title \| company, location + dates right, bullets) | `experience[]` |
| Early Career Experience (title \| company, location + dates, **no** bullets) | new `earlyCareer[]` |
| Education and Professional Development (merged) | `education[]` + `certifications[]` |

**Explicitly NOT rendered by Mar:** projects, additionalInfo (languages/interests/hobbies/references).
If a resume contains that data, Mar silently omits it.

## Schema changes (TypeScript only — Convex `content` is `v.any()`, no DB migration)

Add to the shared `ResumeContent` (`lib/resume/types.ts`), and mirror in `types/resumeTypes.ts`
and the legacy `ResumeContentForJake` interface:

```ts
personalInfo: { ...; phone?: string | null }
coreCompetencies?: string[] | null
earlyCareer?: Array<{ title: string; company: string; location?: string | null; date: string }> | null
```

Jake ignores `coreCompetencies` and `earlyCareer`. Phone is added to Jake's contact line too
(it lives in `personalInfo`, so it's shared), rendered when present.

## Components

### 1. LaTeX template — `templates/resume/marLatex.tex`
- `\documentclass[letterpaper,11pt]{article}`, pdfLaTeX.
- `\usepackage[sfdefault]{carlito}` + `\usepackage[T1]{fontenc}` → Calibri-metric look. `carlito`
  ships with the full `texlive/texlive:latest` image the compile service uses.
- Macro `\marsection{TITLE}`: `\vspace` + `{\bfseries\large TITLE}` + `\hrulefill`.
- Two-column header via `tabular*`/minipage: name left (`\Huge\bfseries`), right-aligned contact block.
- Experience entry macro: `\textbf{Title | Company}` left, `Location (dates)` right (via `tabular*`
  with `@{\extracolsep{\fill}}`), optional `itemize` bullets.
- Placeholder tokens (e.g. `%HEADER%`, `%SUMMARY%`, `%COMPETENCIES%`, `%EXPERIENCE%`,
  `%EARLYCAREER%`, `%EDUCATION%`) that the generator replaces — mirrors the Jake/Vertex pattern.
- Auto-bundled on Vercel: `next.config.ts` already traces `./templates/resume/**/*` for
  `/api/resume/export/*`.

### 2. Generator — `lib/resume/generateMarLatex.ts`
- Reads `templates/resume/marLatex.tex`, injects each section using `escapeLatex`, `getFullName`
  and a Mar-specific contact-block builder (reuses `buildContactLinkParts` logic but adds phone and
  keeps citizenship). Same structure as `generateVertexLatex.ts`.
- Omits any section whose source data is empty (e.g. no Early Career → that heading is skipped).

### 3. Dispatcher + registry
- `lib/resume/generators.ts`: import `generateMarLatex`, add `'mar'` to `RESUME_TEMPLATE_IDS` and the
  `switch`.
- `lib/templates.ts`: add a `mar` entry to `RESUME_TEMPLATES`; update `getFreeResumeTemplates()` to
  return jake **and** mar.
- `app/api/resume/export/[templateId]/route.ts`: update the valid-templates string in the 400 error.

### 4. Unlock the 5 generation surfaces (remove hardcoded "jake")
- **Website free generator**: template picker already exists; Mar appears once eligible.
- **App Documents form** (`jkChatWindow-DocumentsForm.tsx`): replace the hardcoded
  `/api/resume/export/jake` and `template: "jake"` with the user-selected template.
- **Chat AI tool** (`app/ai/tools/file.ts`): `templateId: z.enum(['jake'])` → `z.enum(['jake','mar'])`;
  update guidance in `app/ai/constants/file.ts`; `app/api/chat/route.ts` default already respects the
  `RESUME_TEMPLATE_PREFERENCE`.
- **Email agent** (`convex/emailAgent/draft.ts`): use `baseResume.template` in the export URL instead
  of the hardcoded `/export/jake` (3 call sites).
- **Agent API / CLI** (`convex/agent/fns.ts` `resumesGenerate`): add a `template` arg (default `jake`),
  include `phone`/`coreCompetencies`/`earlyCareer` in the built `content`, and POST to
  `/api/resume/export/${template}`. `cli/src/commands.ts` `resumes add` gains `--template`,
  `--core-competencies`, `--early-career`, and `phone` in `--personal-info`.

### 5. Editor UI (make the fields fillable)
Add inputs for phone, Core Competencies, and Early Career to the resume content editor
(`jkChatWindow-ResumeContentEditor.tsx` / `jkChatWindow-ResumeContentEditor` companions) and the
free-generator form, following existing field patterns.

### 6. Preview image
Compile Mar with the Joseph Wilson sample data, convert page 1 to PNG →
`public/images/jobkompass_preview_resume_mar.png`, referenced by the registry entry.

### 7. Docs
Update the `jobkompass-add-resume` skill and `cli/README.md` to document `--template mar` and the new
fields.

## Verification

- Compile Mar via the LaTeX service with the Joseph Wilson data; visually diff the output against the
  reference PDF (header layout, trailing-rule headings, section order, font).
- Confirm each of the 5 surfaces passes `mar` through end to end (free generator, Documents form,
  chat, email agent, CLI `jk resumes add --template mar`).
- Confirm Jake is unaffected (new fields ignored, phone renders when present).

## Rollout

- Deploy Convex to the live dev slot: `CONVEX_DEPLOYMENT=dev:proficient-mammoth-632 npx convex dev --once`.
- Deploy the frontend manually: `npx vercel --prod` (auto-deploy-on-push is unreliable for this repo).
- Do not smoke-test with real-user agent keys; use a throwaway userId and revoke after.
