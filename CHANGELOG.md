# Changelog

Notable changes to JobKompass. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

The web app is deployed continuously and has no version numbers, so its entries are grouped by date. The CLI is versioned on npm as `jobkompass-cli`, and its releases are called out by number.

## [Unreleased]

Work on the `redesign/v4` branch. It has not been merged to `main`.

### Added

- Resume quality overhaul. One writing standard for every path that writes a resume (`lib/resume/writingStandard.ts`) and one tailoring engine behind chat, onboarding and the agent API (`lib/resume/tailorResume.ts`, `lib/resume/tailorServer.ts`).
- Per-bullet questions. When a bullet has no number or result, the app asks the person about it instead of guessing. Answers are saved on the base resume and reused by every later resume.
- Resume scorecard: how many bullets state a number and how many still read like a duty.
- CLI: `jk resumes questions`, `jk resumes answer` and `jk resumes tailor`, plus `--job` and `--ai-questions` on `jk resumes add`. The CLI version in the source is 0.2.0. It has not been published to npm.
- Two-click confirmation for destructive actions. The control asks "Sure? Click again" in place, with no dialog.
- Sortable columns in the My Jobs table.
- v4 redesign of the whole app:
  - new design tokens, type and day and night themes
  - landing page, sign in, sign up, password reset and Google sign-in
  - onboarding flow that ends with a tailored resume
  - app shell with a desktop rail and a phone header, menu and tab bar
  - My Jobs, Documents and the resume editor, Chat, Interview Prep, Performance, Links & Resources, Settings, Help and Search
- A default resume template per account, used by chat, onboarding and new resumes.
- Job status history.
- An upgrade modal per feature. Its headline names the feature.
- Design-token ratchet test (`tests/design-tokens.test.ts`). Components may not contain hex literals or Tailwind palette classes.
- Repository documentation: architecture, contributing guide, security policy, code of conduct, this changelog, and issue and pull request templates.

### Changed

- Chat shows what changed in a tailored resume and which must-haves from the posting it covers. The open thread is kept in the URL.
- Resources can be notes without a URL.
- Loose markdown files at the repo root moved into `docs/guides/` and `docs/notes/`. The old and new paths are listed in [docs/README.md](docs/README.md).

### Removed

- The email job-leads feature is gone from the UI: the Leads screen, the Gmail connect routes and the scheduled inbox polling. The backend tables and functions for it are still in the codebase.

### Fixed

- A stray brace in a model reply no longer fails every tailored resume.
- Resume export honours `LATEX_SERVICE_URL` in development.

## 2026-11-06

### Added

- Interview Prep: flashcards, stories, requirement mapping and a deck generator.
- CLI: `jk preps list`, `get`, `add`, `update` and `delete`, and `@file` JSON flags.

## 2026-10-29

### Added

- Public share links for resumes at `/r/<shareId>`, with copy and stop actions in the Documents menu.

### Changed

- Backend deploys are pinned to the live Convex deployment through `npm run deploy:backend`.

## 2026-10-03 to 2026-10-04

### Added

- Regression tests for invented resume experience (`tests/no-invented-experience/`).
- A deterministic fact guard on resume AI output, tightened over several rounds of adversarial tests.
- AI rate limiting with the Convex rate-limiter component. It fails open until the component is deployed. See [docs/rate-limiting.md](docs/rate-limiting.md).
- PostHog product analytics that stays off without a key, and client and server exception reporting. See [docs/analytics.md](docs/analytics.md).
- CI for lint, typecheck and vitest.

### Changed

- Resume and auth details are no longer written to logs.

## 2026-08-13

### Added

- Multi-select and bulk delete in the Leads toolbar.

## 2026-08-09

### Added

- Per-inbox pause for job-lead email scanning.

## 2026-08-04 to 2026-08-05

### Added

- Plan tiering. `convex/plans.ts` is the single source of plan rules.
- Resume templates are tiered by plan, and the export route is the one place that enforces it.
- An in-place template switcher on the generated resume card.
- CLI 0.1.5: `jk resumes update` edits a resume's content in place.

### Changed

- The agent API requires the Pro plan on every route except ping and schema.
- The Chrome extension endpoint requires the Plus plan.
- The resume export route requires a signed-in caller.
- Chat falls back to the Jake template when the requested template is above the caller's plan.
- Resumes download to disk instead of opening a storage URL.

### Fixed

- Mobile Safari no longer zooms the page when an input is focused.
- The Mar template no longer renders one skill per row.

## 2026-08-03

### Added

- Document folders and favorites in My Documents.
- A template picker in the My Jobs generate modal.
- The privacy policy documents how the browser extension handles data.

### Fixed

- Job description and skills extraction from the extension is more reliable.
- A generated resume no longer takes over the base-resume status.

## 2026-07-31 to 2026-08-02

### Added

- A second resume template, added on 2026-07-31 as Mar and renamed Joseph on 2026-08-01.
- A third resume template, the current Mar (Times serif, centered header), added on 2026-08-02.
- The resume editor exposes phone, core competencies and early career.
- The CLI became installable from npm. Versions 0.1.1 to 0.1.4 added `--template`, `--core-competencies`, `--early-career` and `--internships` to `jk resumes add`.

## 2026-07-09 to 2026-07-30

### Added

- Email job leads: connect a Gmail account, classify incoming mail, draft replies, tailor a resume, and approve before sending. This feature was later retired. See Unreleased.
- Manual "Add lead from email".
- The base resume is shown first in Documents and can be changed there.

## 2026-07-04 to 2026-07-05

### Added

- The agent API: hashed API keys and `/agent` routes for jobs, resumes, cover letters, email templates, resources and threads.
- The `jk` CLI.
- Resume and cover letter generation through the CLI.
- Professional Summary and Certifications sections in the Jake template.

## 2026-01 to 2026-04

### Added

- First public version, live on 2026-01-29: job tracking, documents, chat, and PDF export through the LaTeX service.
- Stripe billing.
- Free resume generator (2026-01-30).
- Performance stats (2026-02-01).
- Chrome extension beta (2026-02-06).
- Duplicate action for resumes and cover letters (2026-02-08).
- Reordering of resume items in the editor.
- PDF upload for resumes.

## 2025

### Added

- Project started from Create Next App on 2025-03-22.
- Sign-up with Convex Auth.
