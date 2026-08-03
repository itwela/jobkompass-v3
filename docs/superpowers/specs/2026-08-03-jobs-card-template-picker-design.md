# Jobs-Card Template Picker — Design

**Date:** 2026-08-03
**Status:** Approved

## Goal

Let the user choose which resume template gets generated from the My Jobs card → Generate → Resume flow, showing the same preview cards the free resume generator uses, and remember the last template they generated with.

## Problem

`app/jk-components/jkTemplateSelector.tsx` renders a modal titled "Select Resume Template" whose body contains only the resume-source controls (reference resume / upload PDF / paste text). There is no template UI in it at all. The effect that runs on open does this:

```js
// Auto-select the only available template and reset input state when modal opens/closes
if (templates.length > 0) setSelectedTemplateId(templates[0].id)
```

That comment was accurate when Jake was the only resume template. There are now three — `jake`, `joseph`, `mar` — and all three are already in `APP_SELECTABLE_TEMPLATE_IDS` in `lib/templates.ts`. The modal silently hardcodes Jake, so Joseph and Mar are unreachable from My Jobs.

The backend is not implicated. `handleTemplateSelect` in `jkChatWindow-MyJobsMode.tsx:110` already posts `templateId` to `/api/template/generate`, which dispatches by template id. This is a frontend-only gap.

## Files

| File | Change |
|---|---|
| `lib/resume/templatePreference.ts` | new — pure resolver + storage key helper |
| `lib/resume/templatePreference.test.ts` | new — unit tests for the resolver |
| `app/jk-components/jkTemplateSelector.tsx` | preview row, selection ring, "Last used" chip, persist on generate |

`/api/template/generate`, the Convex layer, and `lib/templates.ts` are untouched.

## Components

### 1. Preview row — `jkTemplateSelector.tsx`

Inserted at the top of the modal body, above the "How would you like to provide your resume?" block. Card markup is lifted from `app/free-resume-generator/page.tsx:636-670`: `aspect-[3/4]` `next/image` with `fill` + `object-cover object-top`, template name, tag chips, framer-motion stagger at `0.1 + index * 0.1`.

Horizontally scrolling row (`overflow-x-auto no-scrollbar`), consistent with the free generator. The modal body already scrolls vertically (`max-h-[80vh]` + `overflow-y-auto`), which covers short viewports.

Two deliberate departures from the free-generator cards:

- **Selected state**, which the free version has no concept of: `border-primary ring-2 ring-primary/40` on the chosen card, plus `aria-pressed` so selection is not communicated by colour alone.
- **No locked / "Subscribe to use" overlay.** All three templates are in `APP_SELECTABLE_TEMPLATE_IDS`, so everything is selectable in-app. Generation limits stay where they are, enforced by `canGenerateDocument` / `JkUpgradeModal`.

The row renders only when `templates.length > 1`, leaving the cover-letter flow (one template, `jake`) visually unchanged.

**Not** extracting a card component shared with the free generator in this pass. The two cards want different things — selected ring here, locked overlay there — and the free generator is a public page that shouldn't be touched for a My Jobs feature. Revisit as a follow-up.

### 2. Template preference — `lib/resume/templatePreference.ts`

Pure, no React, no direct `localStorage` access, so it is testable the way the rest of the repo tests logic:

```ts
export function templatePreferenceKey(type: 'resume' | 'cover-letter'): string
// → `jk:lastTemplateId:${type}`

export function resolveInitialTemplateId(
  storedId: string | null,
  availableIds: string[],
  fallbackId: string,
): { templateId: string; wasRemembered: boolean }
```

Rules:

- A stored id present in `availableIds` resolves with `wasRemembered: true`.
- Anything else — `null`, unknown id, id no longer in the allowlist — resolves to `fallbackId` with `wasRemembered: false`.
- Validation is mandatory, not defensive padding: `mar` previously identified the template now called `joseph`, so a value stored during that era must not resolve silently. The same protection applies if a template is ever removed from the allowlist.

### 3. Wiring in the modal

- **Key is per document type** (`jk:lastTemplateId:resume`, `jk:lastTemplateId:cover-letter`), so a resume choice never leaks into cover letters.
- **Read inside the existing `useEffect(…, [isOpen])`**, never in a `useState` initialiser — reading `localStorage` during render causes a Next hydration mismatch.
- **Written on Generate**, in `handleUseTemplate`, not on card click. Browsing cards must not change the stored default; only generating does.
- All storage access wrapped in `try/catch`. Blocked or unavailable storage degrades to pre-selecting `templates[0].id`; it never throws.
- `wasRemembered` gates a small **"Last used"** chip on the pre-selected card, so it appears only on a genuine restore and not on the first-run fallback.
- The existing reset-on-close behaviour stays: `selectedTemplateId` returns to `null` on close, and re-opening re-reads storage.

## Verification

**Unit tests** (`npm test`, existing vitest setup) on `resolveInitialTemplateId`:

- empty storage → fallback, `wasRemembered: false`
- stale `mar`-era id absent from the allowlist → fallback
- unknown/garbage id → fallback
- valid stored id → restored, `wasRemembered: true`
- single-template list → that template

**Manual**, the only route for the UI itself since the repo has no component-test infra (no jsdom, no testing-library; every existing test is pure logic in `lib/` and `convex/`):

1. My Jobs → open a job card → Generate → Resume.
2. Confirm three cards with preview images render. With no stored preference yet, Jake is pre-selected and shows no "Last used" chip.
3. Select Joseph, generate, and confirm **the produced PDF is Joseph, not Jake** — this is the step that proves the fix, since the Jake hardcode is the bug.
4. Reopen the modal; confirm Joseph is pre-selected and carries the "Last used" chip.
5. Open the Cover Letter flow; confirm it looks exactly as it does today (no row).

## Out of scope

- Deleting the dead `app/jk-components/jkTemplateSelectionModal.tsx` (233 lines, zero consumers) — real cleanup, separate commit.
- The `getCoverLetterExportRoute` oddity in `lib/templates.ts`, where both branches return the same path.
- Adding cover-letter templates.
- Any change to the free resume generator, including adopting a shared card component.
