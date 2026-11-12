# JobKompass v4 (Night Voyage) Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the live JobKompass app look like the v4 designs in `JobKompass — Redesign.figcraft`, in dark and light, without changing what the app does.

**Architecture:** The app already has a design system: shadcn semantic tokens in `app/globals.css`, cva primitives in `components/ui/`, `jk`-prefixed feature components in `app/jk-components/`, and state in `providers/jk*Provider.tsx`. The redesign goes in through that system in layers: tokens first, then primitives, then a small set of new shared `jk` components, then screens. Screens only compose what the lower layers export.

**Tech Stack:** Next.js 16, React 19, Tailwind 4 (`@theme inline`), cva, Radix, Framer Motion, vitest.

**Spec:** `~/Desktop/Code/figcraft-work/jobkompass/JobKompass — Redesign.figcraft` (pages `Landing – Desktop (v4)`, `Foundation (v4)`, `App – Desktop (v4)`, `App – Mobile (v4)`, and the three `(Light)` pages). Token source: `figcraft-work/jobkompass/v4/lib.py` and `v4/tokens.css`. Per-screen SVGs: `v4/D*.svg`, `v4/M*.svg`, `v4/light/`. Art: `figcraft-work/jobkompass/art/`.

## What the codebase looks like today (measured Nov 12 2026)

| Pattern | Count in `app/` + `components/` `.tsx` |
|---|---|
| Semantic token utilities (`bg-background`, `text-muted-foreground`, ...) | 1,671 |
| Hardcoded Tailwind palette classes (`bg-gray-100`, `text-blue-600`, ...) | 532 |
| `dark:` variants | 113 |
| Inline hex values | 32 |
| Reads of `styles.` / `utilStyles.` from `jkThemeProvider` | 31, in 9 files |

About three quarters of colour usage already goes through tokens, so changing the token values restyles most of the app in one commit. The 532 palette classes and the second colour table inside `jkThemeProvider.tsx` are the parts that bypass the system, and they get folded back into it in Tasks 1 and 4.

## Global Constraints

- **Frontend only.** No edits under `convex/`, `app/api/`, `cli/`, `lib/resume/`, `lib/emailAgent/`. `npm run deploy:backend` is never run: the dev Convex slot is production.
- **No behaviour changes.** Providers keep their state and exports. Handlers, queries, mutations, routes and the `?mode=` deep links stay as they are. A task's diff is `className` changes plus extracted presentational components.
- **No colour literals in screens.** No hex, `rgb()`, or Tailwind palette class in any file under `app/`. Colour comes from a token utility. Task 1 adds a test that enforces this with a ratchet.
- **One component per repeated pattern.** If a pattern appears on two screens it is a shared `jk` component, built once in Task 3.
- **Naming follows the repo:** `app/jk-components/jkThing.tsx`, default export `JkThing`, state in `providers/`.
- **Big files are restyled, not restructured.** `jkChatWindow-DocumentsForm.tsx` (2,253 lines), `ResumeContentEditor` (1,528), `InterviewPrepMode` (1,523) keep their structure.
- **Exact logo colours:** `#7338AC`, `#635AD9`, `#219BE4`, `#88F4FF`. No tints.
- **Gold (`#F2B45A` dark, `#E8A33D` light) means the paid plan and nothing else.**
- **Paintings fade into the surface on all four sides.** No hard-edged image rectangles. Ship paintings are shown whole, never cropped into a band.
- **Mockup documents show real text**, never grey bars.
- **Real copy and prices only**, from `jkPricing.tsx` and the live landing. No invented counters.
- **No Job IDs shown to users.** No icons beside sidebar items. No serif fonts.
- **Light mode has no cream, sand or tan neutrals.**
- **Gate for every task:** `npx tsc --noEmit && npm test && npm run build`. `npm run lint` is broken repo-wide and is not a gate.
- **Work happens on branch `redesign/v4`.** One commit per task. Nothing is pushed or deployed until Itwela has looked at it running locally.

## Review Focus

1. `--primary` changes from blue to cream. It is used 136 times as `text-primary`, 86 as `bg-primary/NN`, 63 as `border-primary`. Places that used it to mean "blue accent or link" will turn cream. Task 1 adds `--brand` and Task 4 moves those usages.
2. `components/ui/button.tsx` default variant hardcodes `text-white` on `bg-primary`. Cream button with white text is unreadable. Fixed in Task 2; the 29 other `text-white` uses are checked in Task 4.
3. Theme flash on load: `jkThemeProvider` starts as `light` and switches in an effect. With a navy dark theme the white flash is more visible than before.
4. Long real data in the new layouts: long company names and titles in the My Jobs table, a user with zero jobs, zero documents, or no subscription row.
5. Phone width for the signed-in app. No "before" capture exists at 390px, so every screen task checks 390px by hand.

---

## Task 0: Branch, baseline, assets

**Files:**
- Create: `public/images/v4/` (paintings), `public/fonts/CreatoDisplay-{Regular,Medium,Bold}.woff2`

- [ ] Create branch `redesign/v4` from `main`.
- [ ] Run the gate and record the result as the baseline. Any failure that exists before the redesign is written down here and not chased.
- [ ] Convert the paintings actually used by the screens to WebP, longest side 2000px for hero and section art, 800px for ships and spots, night and day versions. Source is 130 MB of PNG; the committed set must be under 6 MB total. Names: `<key>-night.webp`, `<key>-day.webp` with keys `hero`, `harbour`, `waves`, `signal`, `chart`, `cabin`, `papers`, `ship1`..`ship4`.
- [ ] Convert Creato Display Regular, Medium and Bold from `~/Library/Fonts/*.otf` to WoFF2. **Blocked on Itwela confirming the licence allows web embedding** (see Open Decisions). If not confirmed, use Geist from `next/font/google` and continue.
- [ ] Commit.

## Task 1: Tokens, fonts, guard test

**Files:**
- Modify: `app/globals.css` (`:root`, `.dark`, `@theme inline`)
- Modify: `app/layout.tsx` (fonts)
- Modify: `providers/jkThemeProvider.tsx` (colour table reads CSS variables)
- Create: `tests/design-tokens.test.ts`

**Produces:** every token below as a Tailwind utility (`bg-surface-raised`, `text-brand`, `bg-bar-1`, `border-plan`, `bg-status-applied`, `font-sans`, `font-mono`, `rounded-card`, `rounded-modal`).

Existing shadcn variables are re-valued, not renamed, so the 1,671 existing usages keep working.

| Variable | Dark | Light |
|---|---|---|
| `--background` | `#080E20` | `#F7F8FA` |
| `--card`, `--sidebar` | `#0C1530` | `#FFFFFF` |
| `--popover`, `--muted`, `--secondary` | `#0F1934` | `#EEF2F9` |
| `--accent`, `--sidebar-accent` (selected) | `#172244` | `#DCE7F7` |
| `--border`, `--sidebar-border` | `#1A274C` | `#E3E5EA` |
| `--input` | `#24335E` | `#CDD2DC` |
| `--border-strong` (new) | `#33426E` | `#A9B0BF` |
| `--foreground` and all `*-foreground` on surfaces | `#F3EEE0` | `#0A1228` |
| `--muted-foreground` | `#AEB7D0` | `#47506B` |
| `--subtle-foreground` (new) | `#6F7CA3` | `#7B8399` |
| `--primary` (the main button) | `#F6F0DF` | `#0A1228` |
| `--primary-foreground` | `#0A1228` | `#F6F0DF` |
| `--brand` (new: links, focus, accents), `--ring` | `#219BE4` | `#219BE4` |
| `--plan` (new: gold) | `#F2B45A` | `#E8A33D` |
| `--plan-text` (new) | `#F2B45A` | `#A46A08` |
| `--bar-1..4` (new) | `#7338AC` `#635AD9` `#219BE4` `#88F4FF` | same |
| `--ok` / `--warn` / `--destructive` | `#3DDC97` / `#F5C542` / `#EF4444` | text use: `#0F8A55` / `#9A6E06` / `#EF4444` |
| `--status-interested/applied/callback/interviewing/offered/rejected/ghosted` (new) | bar-3 / warn / bar-4 / bar-2 / ok / destructive / subtle-foreground | same mapping |
| `--radius` | `1.25rem` card, `--radius-modal: 1.75rem`, pill `999px` | same |

- [ ] **Write `tests/design-tokens.test.ts`:**
  - `tokens: globals.css defines every variable in the table for both :root and .dark` (parse the file, assert each name appears in both blocks).
  - `ratchet: palette classes in app/ do not exceed the recorded ceiling` and `ratchet: hex literals in app/**/*.tsx do not exceed the recorded ceiling`. Ceilings start at today's numbers (532 and 32) and are lowered in the same commit that removes usages. Final values after Task 4: 0 and 0, except an explicit allowlist for `app/jk-components/jkLandingPage.tsx` SVG art if it needs one.
- [ ] Run it; the token test fails.
- [ ] Re-value `:root` and `.dark`, add the new variables, register them in `@theme inline`.
- [ ] Fonts in `layout.tsx`: Creato Display via `next/font/local` as `--font-sans` (weights 400, 500, 700), JetBrains Mono via `next/font/google` as `--font-mono`. Remove Ubuntu.
- [ ] `jkThemeProvider.tsx`: keep the `ThemeStyles` type and the hook's shape; replace each hex with the matching `var(--…)` string so the provider and the CSS can never disagree. `status.*` maps to `--status-*`.
- [ ] Remove the white flash: set the `dark` class before paint with an inline script in `layout.tsx` that reads `localStorage.theme` and `prefers-color-scheme`.
- [ ] Gate, then open `/`, `/app`, `/pricing`, `/auth` in both themes and screenshot. The app should already read as navy and cream with rough edges.
- [ ] Commit.

## Task 2: Primitives

**Files:** Modify `components/ui/{button,input,textarea,select,dialog,sheet,popover,dropdown-menu,tooltip,toaster}.tsx`

**Produces:** `Button` variants `default` (cream pill, `text-primary-foreground`), `plan` (gold pill), `secondary` (raised navy pill with border), `ghost`, `destructive` (outlined), `link` (`text-brand`). Sizes unchanged so no call site breaks. Dialog and Sheet use `rounded-modal`, `bg-popover`, and the `#04070F` at 72% scrim. Inputs use `bg-muted border-input`, focus ring `--brand`.

- [ ] Change the variants. No call site edits in this task.
- [ ] Gate plus a visual pass on one screen with each primitive (Add Job dialog, Settings form, a dropdown, a toast).
- [ ] Commit.

## Task 3: Shared `jk` components

**Files (all new, under `app/jk-components/`):**

| File | Export and props | Used by |
|---|---|---|
| `jkArt.tsx` | `JkArt({ name, variant: 'band' \| 'spot' \| 'section', className })`. Picks `-night` or `-day` from the theme, renders with a four-side mask fade into the parent surface. | landing, My Jobs, Links, Documents, Settings, pricing, paywall, auth |
| `jkBars.tsx` | `JkBars({ size })`, the four logo-colour bars. `JkEyebrow({ children })`, tick plus mono caps label. | everywhere |
| `jkStatusBar.tsx` | `JkStatusBar({ counts, active, onSelect })`. Segmented bar that is also the filter; hover shows name and count. | My Jobs desktop and mobile |
| `jkStatusChip.tsx` | `JkStatusChip({ status })` using `--status-*`. | jobs table, job detail, search |
| `jkCompanyLogo.tsx` | `JkCompanyLogo({ company, domain?, size })`. Favicon by domain, neutral monogram fallback. No random colours. | jobs, search, prep |
| `jkPlanCards.tsx` | `JkPlanCards({ current?, layout: 'columns' \| 'single' })`. The one paywall block. Reads plans and prices from the existing pricing data in `jkPricing.tsx`. | landing, `/pricing`, upgrade modal, Settings |
| `jkDocPreview.tsx` | `JkDocPreview({ kind: 'resume' \| 'letter', size })`. Miniature page with real text. | landing, documents, onboarding |
| `jkPageHeader.tsx` | `JkPageHeader({ title, sub, actions, art? })`. | every app mode |

`jkStatusBar` gets a unit test for its pure part: `segmentWidths(counts)` returns percentages that sum to 100, gives a zero-count status zero width, and returns all zeros for an empty list.

- [ ] Test first for `segmentWidths`, then build each component against the Foundation page.
- [ ] Add a dev-only route `app/dev/kit/page.tsx` that renders every primitive and shared component in both themes. This is the visual check for Tasks 2 and 3 and stays as the reference for later work. It returns `notFound()` in production.
- [ ] Gate. Commit.

## Task 4: Bring the bypasses back into the system

**Files:** the 22 files holding the 532 palette classes, worst first: `jkSlideModalGlass.tsx` (103), `InterviewPrepMode` (75), `ResourcesMode` (69), `DocumentsForm` (66), `jkJobsGrid.tsx` (34), then the rest.

Mapping: `gray/slate/zinc/neutral` text → `text-foreground` / `text-muted-foreground` / `text-subtle-foreground` by weight; grey backgrounds → `bg-muted` / `bg-accent`; `blue` → `brand`; `purple/indigo` → `bar-1` / `bar-2`; `green/emerald` → `ok`; `yellow/amber` → `warn` unless it marks a paid plan, then `plan`; `red` → `destructive`; `bg-white` → `bg-card`; `text-white` on a filled button → the matching `*-foreground`. Each `dark:` pair collapses to one token class. `text-primary` / `border-primary` / `bg-primary/NN` that meant "blue accent" become `brand`.

- [ ] One commit per file or small group; lower the ratchet ceilings in each commit.
- [ ] After the last file the ratchet is at 0 and `dark:` count is near 0.
- [ ] Gate and screenshot every mode in both themes.

**At the end of Task 4 the whole app is on the new palette, type and controls, and is safe to ship as it stands.** Everything after this is layout.

## Task 5: App shell

**Files:** `jkSIdebar.tsx`, `jkConsole-Header.tsx`, `jkConsole.tsx`, `jkConsole-Content-Header.tsx`, `jkChatWindow-TabBarComponent.tsx`, `providers/jkChatWindowProvider.tsx` (nav list only)

- [ ] Sidebar per D01: logo, text-only nav with counts, conversation list, plan badge. No icons beside items.
- [ ] Settings swaps the app nav for the settings nav with "Back to My Jobs".
- [ ] Mobile: bottom tab bar with four tabs (Jobs, Docs, Chat, More) per M01 and M10.
- [ ] Job Leads: removed from the nav list and the mode switcher. Code and the `/leads` mode stay in place (see Open Decisions).
- [ ] Gate, 1440 and 390 screenshots, commit.

## Tasks 6 to 18: Screens

Each is one task with the same four steps: restyle to the named frames using only Tasks 1 to 3 exports; check empty, loading and long-data states; screenshot 1440 and 390 in both themes next to the FigCraft export; gate and commit. Order is by how many people see the screen.

| # | Screen | Frames | Files |
|---|---|---|---|
| 6 | Landing | L01 v4.5, M00 | `jkLandingPage.tsx`, `jkPublicHeader.tsx`, `jkFooter.tsx` |
| 7 | Sign in / sign up | D17, D20, M12, M21 | `app/auth/page.tsx` |
| 8 | Pricing and paywall | D18, D15, M19, M17 | `jkPricing.tsx`, `jkPricingModal.tsx`, `jkUpgradeModal.tsx`, `jkUpgradePrompt.tsx` |
| 9 | Chat | D01, D02, M03 to M05 | `ChatMode`, `jkInputSection.tsx`, `jkContextPanel.tsx`, intro screen |
| 10 | My Jobs | D03, D04, M01 | `MyJobsMode`, `jkJobsGrid.tsx` |
| 11 | Job details and Add job | D05, D06, M02, M13 | `jkJobExpanded.tsx`, `jkJobInputModal.tsx`, `jkSlideModalGlass.tsx` |
| 12 | My Documents | D07, M06 | `DocumentsMode`, `DocumentsForm`, `jk-documents/*` |
| 13 | Resume and cover letter editors | D08, M15 | `ResumeContentEditor`, `CoverLetterContentEditor`, `DynamicJSONEditor` |
| 14 | Interview Prep | D10, M08 | `InterviewPrepMode` |
| 15 | Performance | D11, M09 | `PerformanceMode` (charts as SVG components in `jkCharts.tsx`) |
| 16 | Links and Resources | D12, M14 | `ResourcesMode` |
| 17 | Settings, Help, Search | D13, D14, D16, M11, M16, M18 | `SettingsMode`, `HelpMode`, `jkSearchModal.tsx` |
| 18 | Free resume generator | D19, M20 | `app/free-resume-generator/page.tsx` |

Task 6 breaks the "big files are not restructured" rule on purpose: the landing is a new composition, so `jkLandingPage.tsx` becomes a thin file composing one component per section under `app/jk-components/jk-landing/`.

## Not in this plan

- **Onboarding (D21 to D23, M22 to M24).** It is a new feature with its own state and routing, not a restyle. Separate spec and plan.
- **Motion** (the WebGL painting loops and the button effects in `figcraft-work/jobkompass/motion/`). Separate plan after the static redesign is approved. Static paintings ship first.
- **Deleting Job Leads / Gmail code and Convex tables.** Backend work on a production deployment.

## The five-hour window

Tasks are ordered so that stopping after any commit leaves a working app.

| Stop point | State of the app |
|---|---|
| After Task 1 | New colours and type across most of the app. Rough where palette classes remain. |
| After Task 4 | Whole app consistently on v4 colours, type, buttons, dialogs, both themes. Old layouts. **Shippable.** |
| After Task 5 | New sidebar, header, mobile tabs. |
| After Task 8 | Everything a logged-out visitor sees matches the design. |
| After Task 11 | The two daily-use screens (Chat, My Jobs) match. |
| After Task 18 | Full match. |

Tasks 0 to 5 are mostly mechanical and should fit comfortably. Tasks 6 to 18 are where the time goes, and the landing alone is the largest single item. Reaching Task 11 in one window is a reasonable target; all of Tasks 12 to 18 in the same window is not something this plan promises. Whatever is left carries over with nothing half-done, because each task is its own commit.

Ways the window is protected: no pixel-chasing before Task 4 is done; a screen task that runs past its share is committed at "matches at 1440 dark" and its remaining theme or width checks are logged in this file under the task; no refactors that a task does not name.

## Open decisions

1. **Creato Display licence for web use.** Not verified. Needed before Task 0 ships the font files.
2. **Job Leads:** hide from navigation only (this plan) or delete the code too.
3. **Default theme** for a first-time visitor: follow the OS (today's behaviour, this plan) or always start dark.
