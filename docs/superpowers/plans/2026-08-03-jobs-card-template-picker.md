# Jobs-Card Template Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user pick which resume template (Jake / Joseph / Mar) the My Jobs → Generate → Resume flow produces, using preview cards, and remember the template they last generated with.

**Architecture:** Two pieces. A pure, unit-tested resolver in `lib/resume/templatePreference.ts` decides which template is pre-selected from a stored id plus the current allowlist. `app/jk-components/jkTemplateSelector.tsx` gains a preview-card row and calls that resolver on open, writing the choice back to `localStorage` when the user actually generates. No backend change: `/api/template/generate` already accepts and honors `templateId`.

**Tech Stack:** Next.js (App Router, React client component), TypeScript, Tailwind, framer-motion, `next/image`, lucide-react icons, vitest.

Spec: `docs/superpowers/specs/2026-08-03-jobs-card-template-picker-design.md`
Branch: `feat/jobs-card-template-picker` (already created, spec committed as `c14d83f`)

## Global Constraints

- **Baseline that must stay green:** `npx vitest run` → 9 files / 40 tests passing. `npx tsc --noEmit -p tsconfig.json` → exit 0, zero output. Both were verified clean before this plan was written; any new failure is yours.
- **No backend edits.** Do not touch `convex/`, `app/api/template/generate/`, or `lib/templates.ts`. The template id already flows end-to-end.
- **Do not touch `app/free-resume-generator/page.tsx`.** Its card markup is the reference to copy from, not a file to refactor.
- **Do not delete `app/jk-components/jkTemplateSelectionModal.tsx`.** It is dead code (233 lines, zero consumers) but removing it is explicitly out of scope for this branch.
- **No new dependencies.** Everything needed is already imported somewhere in the repo.
- **Storage keys are exactly** `jk:lastTemplateId:resume` and `jk:lastTemplateId:cover-letter`.
- **Never read `localStorage` during render** (no `useState(() => localStorage…)`). Reads happen inside the existing `useEffect` keyed on `isOpen`, or Next will throw a hydration mismatch.
- Existing file uses **4-space indentation and no semicolons**. Match it. `lib/` files use 2-space indentation with semicolons. Match that too.

## File Structure

| File | Responsibility |
|---|---|
| `lib/resume/templatePreference.ts` | **new.** Pure functions only: build the storage key, resolve which template id to pre-select. No React, no `window`, no `localStorage` access. |
| `lib/resume/templatePreference.test.ts` | **new.** Unit tests for the resolver. |
| `app/jk-components/jkTemplateSelector.tsx` | **modify.** Preview-card row, selected ring, "Last used" chip, `localStorage` read on open / write on generate. Owns all browser-storage access. |

The `window`/`localStorage` boundary sits entirely in the component; the `lib/` module stays pure so it is testable without jsdom (the repo has no jsdom or testing-library setup — every existing test is pure logic).

---

### Task 1: Template preference resolver

**Files:**
- Create: `lib/resume/templatePreference.ts`
- Test: `lib/resume/templatePreference.test.ts`

**Interfaces:**
- Consumes: `TemplateType` (type-only import) from `lib/templates.ts` — it is `'resume' | 'cover-letter'`.
- Produces, relied on by Task 2:
  - `templatePreferenceKey(type: TemplateType): string`
  - `resolveInitialTemplateId(storedId: string | null | undefined, availableIds: string[], fallbackId: string): { templateId: string; wasRemembered: boolean }`

- [ ] **Step 1: Write the failing test**

Create `lib/resume/templatePreference.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { resolveInitialTemplateId, templatePreferenceKey } from "./templatePreference";

const AVAILABLE = ["jake", "joseph", "mar"];

describe("templatePreferenceKey", () => {
  it("namespaces the key per document type", () => {
    expect(templatePreferenceKey("resume")).toBe("jk:lastTemplateId:resume");
    expect(templatePreferenceKey("cover-letter")).toBe("jk:lastTemplateId:cover-letter");
  });
});

describe("resolveInitialTemplateId", () => {
  it("restores a stored id that is still available", () => {
    expect(resolveInitialTemplateId("joseph", AVAILABLE, "jake")).toEqual({
      templateId: "joseph",
      wasRemembered: true,
    });
  });

  it("falls back when nothing is stored", () => {
    expect(resolveInitialTemplateId(null, AVAILABLE, "jake")).toEqual({
      templateId: "jake",
      wasRemembered: false,
    });
  });

  it("falls back when storage is unavailable and undefined is passed", () => {
    expect(resolveInitialTemplateId(undefined, AVAILABLE, "jake")).toEqual({
      templateId: "jake",
      wasRemembered: false,
    });
  });

  it("falls back for an id that was retired from the allowlist", () => {
    // `vertex` was one of the skeleton templates removed from RESUME_TEMPLATES.
    // A browser that stored it before removal must not resolve to it.
    expect(resolveInitialTemplateId("vertex", AVAILABLE, "jake")).toEqual({
      templateId: "jake",
      wasRemembered: false,
    });
  });

  it("falls back for a garbage value", () => {
    expect(resolveInitialTemplateId("{}", AVAILABLE, "jake")).toEqual({
      templateId: "jake",
      wasRemembered: false,
    });
  });

  it("falls back for an empty string", () => {
    expect(resolveInitialTemplateId("", AVAILABLE, "jake")).toEqual({
      templateId: "jake",
      wasRemembered: false,
    });
  });

  it("handles a single-template list", () => {
    expect(resolveInitialTemplateId(null, ["jake"], "jake")).toEqual({
      templateId: "jake",
      wasRemembered: false,
    });
  });

  it("does not remember an id when the allowlist is empty", () => {
    expect(resolveInitialTemplateId("jake", [], "jake")).toEqual({
      templateId: "jake",
      wasRemembered: false,
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/resume/templatePreference.test.ts`
Expected: FAIL — cannot resolve `./templatePreference` (module does not exist yet).

- [ ] **Step 3: Write the minimal implementation**

Create `lib/resume/templatePreference.ts`:

```ts
/**
 * Which resume/cover-letter template the user last generated with.
 *
 * Pure on purpose: the component owns all localStorage access and passes the raw
 * stored value in, so this logic is testable without a DOM.
 */
// Relative, not `@/lib/templates`: no root vitest config maps the `@/` alias, and every
// tested file under lib/ imports relatively. Type-only, so nothing is emitted at runtime.
import type { TemplateType } from '../templates';

export interface ResolvedTemplateSelection {
  /** Template id to pre-select when the modal opens. */
  templateId: string;
  /** True only when the id came from a stored preference, not the fallback. Drives the "Last used" chip. */
  wasRemembered: boolean;
}

export function templatePreferenceKey(type: TemplateType): string {
  return `jk:lastTemplateId:${type}`;
}

/**
 * A stored id is only honored if it is still in the current allowlist. This is required,
 * not defensive padding: `mar` previously identified the template now called `joseph`, and
 * skeleton templates (vertex/minimal/executive/momentum) were removed outright — so browsers
 * hold ids that must no longer resolve.
 */
export function resolveInitialTemplateId(
  storedId: string | null | undefined,
  availableIds: string[],
  fallbackId: string,
): ResolvedTemplateSelection {
  if (storedId && availableIds.includes(storedId)) {
    return { templateId: storedId, wasRemembered: true };
  }
  return { templateId: fallbackId, wasRemembered: false };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/resume/templatePreference.test.ts`
Expected: PASS — 1 file, 9 tests.

- [ ] **Step 5: Confirm the whole suite and typecheck are still clean**

Run: `npx vitest run`
Expected: 10 files / 49 tests passing (baseline 9/40 plus this file's 9).

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: exit 0, no output.

- [ ] **Step 6: Commit**

```bash
git add lib/resume/templatePreference.ts lib/resume/templatePreference.test.ts
git commit -m "Add template preference resolver

Pure helper deciding which resume template is pre-selected from a stored
id plus the current allowlist. Validates against the allowlist because
retired ids (vertex, and mar-as-joseph) still live in browsers."
```

---

### Task 2: Preview-card picker in the generate modal

**Files:**
- Modify: `app/jk-components/jkTemplateSelector.tsx` (imports ~lines 3-19, state ~line 63, effect lines 73-85, `handleUseTemplate` lines 121-134, body insert at line 180)
- Reference only, do not edit: `app/free-resume-generator/page.tsx:636-670`

**Interfaces:**
- Consumes from Task 1: `templatePreferenceKey`, `resolveInitialTemplateId`.
- Produces: no new exports. `onSelectTemplate(templateId, resumeInput)` keeps its existing signature, so `jkChatWindow-MyJobsMode.tsx` needs no change.

- [ ] **Step 1: Add the imports**

In the lucide-react import (line 5), add `Check`:

```tsx
import { X, FileText, FileCheck, Sparkles, Upload, Check } from 'lucide-react'
```

Add `next/image` immediately after the framer-motion import (line 4):

```tsx
import Image from 'next/image'
```

Add the Task 1 helpers after the `@/lib/aiModels` import (line 18):

```tsx
import { resolveInitialTemplateId, templatePreferenceKey } from '@/lib/resume/templatePreference'
```

- [ ] **Step 2: Add the storage accessors**

Insert immediately above `export default function JkTemplateSelector(` (line 47). These are the only places the component touches storage; both swallow failures so private-mode browsers degrade to the fallback instead of crashing.

```tsx
function readStoredTemplateId(type: TemplateType): string | null {
    try {
        return window.localStorage.getItem(templatePreferenceKey(type))
    } catch {
        return null
    }
}

function writeStoredTemplateId(type: TemplateType, templateId: string) {
    try {
        window.localStorage.setItem(templatePreferenceKey(type), templateId)
    } catch {
        // Blocked or unavailable storage: the preference just won't persist.
    }
}
```

- [ ] **Step 3: Add state for the chip**

After the `selectedTemplateId` state declaration (line 63), add:

```tsx
    const [restoredFromPreference, setRestoredFromPreference] = useState(false)
```

- [ ] **Step 4: Resolve the pre-selection on open**

Replace the entire existing effect (lines 73-85) — including its now-wrong `// Auto-select the only available template` comment — with:

```tsx
    // Pre-select the last template the user generated with (validated against the current
    // allowlist), falling back to the first template. Storage is read here rather than in a
    // useState initialiser so it never runs during render and can't desync hydration.
    useEffect(() => {
        if (isOpen) {
            if (templates.length > 0) {
                const { templateId, wasRemembered } = resolveInitialTemplateId(
                    readStoredTemplateId(type),
                    templates.map((t) => t.id),
                    templates[0].id,
                )
                setSelectedTemplateId(templateId)
                setRestoredFromPreference(wasRemembered)
            }
        } else {
            setSelectedTemplateId(null)
            setRestoredFromPreference(false)
            setResumeInputMode('reference')
            setResumePdf(null)
            setResumePdfName(null)
            setResumeText('')
            setPromptText('')
            setDescriptionExpanded(false)
        }
    }, [isOpen])
```

Keep the dependency array as `[isOpen]` — matching the existing code, which already derives `templates` outside the array. Do not "fix" it in this task.

- [ ] **Step 5: Persist the choice on generate**

In `handleUseTemplate` (lines 121-134), add the write immediately before the `onSelectTemplate` call, so the last line of the function becomes:

```tsx
        writeStoredTemplateId(type, selectedTemplateId)
        onSelectTemplate(selectedTemplateId, resumeInput)
```

Write here, not in the card's `onClick`: merely browsing the cards must not change the remembered default — only actually generating does.

- [ ] **Step 6: Render the preview row**

Insert this as the **first child** of the body container — that is, directly after the line

```tsx
                        <div className="p-6 w-full h-full overflow-y-auto !no-scrollbar flex flex-col gap-5">
```

and directly before `{type === 'resume' && (`:

```tsx
                            {templates.length > 1 && (
                                <div className="space-y-3">
                                    <label className="text-sm font-medium block">Choose a template</label>
                                    <div className="flex flex-row gap-3 overflow-x-auto no-scrollbar pb-1">
                                        {templates.map((template, index) => {
                                            const isSelected = selectedTemplateId === template.id
                                            return (
                                                <motion.button
                                                    key={template.id}
                                                    type="button"
                                                    aria-pressed={isSelected}
                                                    onClick={() => setSelectedTemplateId(template.id)}
                                                    className={`relative flex flex-col flex-shrink-0 w-[180px] rounded-xl border-2 overflow-hidden transition-colors duration-200 text-left group ${
                                                        isSelected
                                                            ? 'border-primary ring-2 ring-primary/40'
                                                            : 'border-border hover:border-primary/60'
                                                    }`}
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    transition={{ duration: 0.4, delay: 0.1 + index * 0.1, ease: [0.16, 1, 0.3, 1] }}
                                                >
                                                    <div className="relative w-full aspect-[3/4] bg-muted/30">
                                                        <Image
                                                            src={template.previewImage}
                                                            alt={template.name}
                                                            fill
                                                            className="object-cover object-top"
                                                            sizes="180px"
                                                        />
                                                        <div className="absolute inset-0 bg-transparent group-hover:bg-black/5 transition-opacity" />
                                                    </div>
                                                    <div className="p-2.5 bg-background/95 backdrop-blur-sm flex-shrink-0">
                                                        <div className="flex items-center gap-1.5">
                                                            <p className="font-medium text-xs truncate flex-1">{template.name}</p>
                                                            {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                                                        </div>
                                                        {isSelected && restoredFromPreference && (
                                                            <span className="mt-1 inline-block px-1.5 py-0.5 text-[10px] font-medium rounded bg-primary/10 text-primary">
                                                                Last used
                                                            </span>
                                                        )}
                                                        <div className="flex flex-wrap gap-1 mt-1.5">
                                                            {template.tags?.slice(0, 2).map((tag) => (
                                                                <span
                                                                    key={tag}
                                                                    className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-muted text-muted-foreground"
                                                                >
                                                                    {tag}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </motion.button>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}
```

Notes on the choices here, so they are not "improved" by accident:
- `templates.length > 1` keeps the cover-letter flow (one template, `jake`) looking exactly as it does today.
- `aria-pressed` matters: selection must not be signalled by colour alone.
- `w-[180px]` × 3 cards + gaps fits inside the modal's `max-w-4xl` without scrolling; `overflow-x-auto` covers narrow viewports, and the body already scrolls vertically.
- `tags?.slice(0, 2)` — the cards are narrower than the free generator's, and three chips wrap badly at this width.

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: exit 0, no output. A `Cannot find name 'Check'` or `'Image'` error means Step 1 was skipped.

- [ ] **Step 8: Confirm tests still pass**

Run: `npx vitest run`
Expected: 10 files / 49 tests passing. (No component tests exist; this only proves nothing regressed.)

- [ ] **Step 9: Lint**

Run: `npx next lint`
Expected: no new warnings for `jkTemplateSelector.tsx`. Pre-existing warnings elsewhere in the repo are not yours to fix. If `next lint` reports the `react-hooks/exhaustive-deps` warning on the `[isOpen]` array, leave it — it predates this change.

- [ ] **Step 10: Commit**

```bash
git add app/jk-components/jkTemplateSelector.tsx
git commit -m "Add template picker to the My Jobs generate modal

The modal was titled 'Select Resume Template' but had no template UI; it
auto-selected templates[0], so joseph and mar were unreachable from My
Jobs even though both are in APP_SELECTABLE_TEMPLATE_IDS.

Adds a preview-card row (markup mirroring the free resume generator, plus
a selected ring), pre-selects the last-generated template, and persists
the choice on generate. Row is hidden when only one template exists, so
the cover-letter flow is unchanged."
```

---

## Manual QA

No component-test infrastructure exists in this repo, so the UI is verified by hand. Run `npm run dev` and, in the app:

- [ ] My Jobs → open a job card → Generate → Resume. Three cards render with preview images.
- [ ] With no stored preference (clear `jk:lastTemplateId:resume` in devtools → Application → Local Storage first), **Jake** is pre-selected, ringed, with **no** "Last used" chip.
- [ ] Clicking Joseph moves the ring and check to Joseph.
- [ ] Generate with Joseph selected, then open the produced PDF: **it must be the Joseph layout, not Jake.** This is the step that proves the fix — the Jake hardcode was the bug, so a Jake PDF here means the change did not take.
- [ ] Reopen the modal: Joseph is pre-selected and shows the "Last used" chip.
- [ ] Reload the page, reopen: Joseph is still pre-selected (persistence survives reload).
- [ ] Cover Letter flow: no template row at all, and generating still works.
- [ ] Devtools → Application → Local Storage shows `jk:lastTemplateId:resume` = `joseph`.

## Deployment (do not run unprompted)

Frontend-only, so this needs a Vercel deploy and **no** Convex push. Vercel auto-deploy-on-push has repeatedly skipped this repo, so a push alone is not sufficient — `npx vercel --prod` is the reliable path. Merging to `main` and deploying is the user's call, not part of plan execution.

## Follow-ups deliberately excluded

- Delete the dead `app/jk-components/jkTemplateSelectionModal.tsx` (233 lines, zero consumers).
- `getCoverLetterExportRoute` in `lib/templates.ts` returns the same path from both branches.
- Extract a card component shared with the free resume generator (needs `selected` + `locked` variants).
- The unused `descriptionExpanded` state in `jkTemplateSelector.tsx`.
