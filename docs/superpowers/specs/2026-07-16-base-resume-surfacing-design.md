# Base Resume Surfacing & Control — Design

Date: 2026-07-16

## Problem

The "active resume" that feeds job-lead resume generation already exists in the data
(`resumes.isActive === true`) and is read by the email agent
(`convex/emailAgent/draft.ts:21` — `resumes.find(r => r.isActive) || resumes[0]`),
but it is **invisible in the Documents UI** and potentially **ambiguous**:

- The Documents view (`jkChatWindow-DocumentsForm.tsx`) has a local `isActive`
  variable that means "is this card currently selected" — unrelated to the DB flag.
  Nothing in the UI shows which resume is the base for job leads.
- Generated/tailored resumes are stored `isActive: false` on purpose, but an older
  "every resume is active" state may leave multiple resumes flagged. When that
  happens, the base is just "whichever the query returns first" — not intentional.
- The user's base resume has no Professional Summary
  (`content.personalInfo.summary`), so tailored job-lead resumes ship without one.

## Goals

1. Make the base resume obvious in the Documents UI.
2. Make it always sort first.
3. Give it a distinct amber/gold border + "⭐ Base resume" badge.
4. Let the user change which resume is the base from the UI.
5. Guarantee exactly one base resume (self-heal the multiple-active state).
6. Write a real Professional Summary into the user's current base resume (one-off,
   on live data) so job-lead resumes include it.

Non-goals (YAGNI): no change to the email agent's selection logic (it already reads
`isActive`); no new schema fields; no "base cover letter" concept.

## Architecture

### Part A — Convex (`convex/documents.ts`)

Add a **public** mutation `setBaseResume`:

- Args: `{ resumeId: v.id("resumes") }`.
- Auth via `getAuthUserId`; 404/deny if the resume isn't the caller's.
- Reuses the existing `setSoleActiveResume` logic: set the chosen resume to the sole
  `isActive: true`, deactivate all of the user's other resumes.
- Because it deactivates every other resume on each switch, it **self-heals** the
  "multiple active" state as a side effect.

No schema change. `setSoleActiveResume` (internal) stays as-is for agent/CLI use;
`setBaseResume` is the auth'd public wrapper for the UI.

### Part B — Documents UI (`jkChatWindow-DocumentsForm.tsx`)

Data already available: `providers/jkDocumentsProvider.tsx:48` spreads the full
resume doc, so `isActive` is already present on each `doc`.

1. **Determine the base** among resume-type documents: the resume with
   `isActive === true`; if more than one is flagged, pick the most recently updated
   (`updatedAt` desc) so the displayed base is deterministic even before the next
   `setBaseResume` heals the data.
2. **Sort first:** in `filteredDocuments`, force the base resume to index 0. Keep the
   existing order for everything else. Search filtering still applies — if the base
   is filtered out by the search term, it simply isn't shown (no special-casing).
3. **Highlight:** on the base card, add an amber/gold ring
   (e.g. `border-amber-400 border-2 ring-1 ring-amber-300`) and a small badge
   `⭐ Base resume` (amber). This must sit above the existing blue-selected
   (`border-blue-500 ring-2 ring-blue-200`) and primary-new (`border-primary
   border-2`) styles in the `cn()` precedence so the base treatment is not masked
   when the card is also new/selected.
4. **"Make this my base resume" button:** shown on every resume card that is *not*
   the base (hidden on cover letters and on the base itself). On click → call
   `setBaseResume({ resumeId })`. Optimistic/loading state + toast on success.

### Part C — Professional Summary (one-off, live data)

Not a code change. Executed interactively after the feature ships (or alongside):

1. Read the current base resume's `content` from live Convex.
2. Draft a Professional Summary for `content.personalInfo.summary` based on the
   user's real experience; show it for approval.
3. Patch it onto the base resume record.
4. It then flows into job-lead tailored resumes automatically — the email agent
   rewrites `personalInfo.summary` per role
   (`lib/emailAgent/draftMessage.ts:108`) and `lib/resume/generateJakeLatex.ts:130`
   renders it (omitting the section only when empty).

## Data flow

```
User clicks "Make this my base resume"
  → setBaseResume(resumeId)            [convex/documents.ts, public, auth'd]
    → chosen resume isActive=true, all others isActive=false
  → reactive query updates provider
    → DocumentsForm recomputes base → re-sorts first + amber highlight

Job lead arrives
  → emailAgent/draft.ts: resumes.find(isActive)  → the chosen base
    → tailors content.personalInfo.summary per role → jake LaTeX → PDF
```

## Error handling

- `setBaseResume` on a missing/foreign resume → throw (existing pattern), surfaced
  as a toast in the UI.
- No resumes / no active flag → UI shows no base highlight; email agent keeps its
  existing `|| resumes[0]` fallback. No crash.

## Testing / verification

- Manual: with 2+ resumes, click "Make this my base resume" on a non-base card →
  it jumps to first, gets the amber ⭐ treatment, the button disappears from it and
  appears on the previously-base card.
- Verify only one resume ends up `isActive` after a switch (self-heal).
- Verify the base card keeps the amber treatment even when it is also "new".
- Part C: after writing the summary, generate a job-lead resume and confirm the
  Professional Summary section renders.
