# Leads Multi-Select + Bulk Delete — Design

**Date:** 2026-08-13
**Status:** Approved

## Goal

Let the user select multiple rows in the Job Leads table and delete them in one action, with the entry points (Multi-select toggle, Delete Selected) sitting on the same toolbar row as the existing Scan Now button.

## Problem

`LeadsList.tsx` only supports single-row delete via a per-row button + confirm dialog. There is no selection state at all. The "My Jobs" tab already solved this same problem (`jkJobsProvider.tsx` + `jkChatWindow-MyJobsMode.tsx` + `jkJobsGrid.tsx`), so this is a matter of bringing that pattern to Leads rather than inventing a new one — with one deliberate simplification (see Components #1) and one deliberate substitution (see Components #2).

## Files

| File | Change |
|---|---|
| `app/jk-components/jk-chatwindow-components/jkChatWindow-LeadsMode.tsx` | own selection state (`useState`), render toolbar controls next to `ScanNowButton`, own bulk-delete handler |
| `app/jk-components/jkEmailLeads/LeadsList.tsx` | accept selection props, render a checkbox `<td>` per row when in selection mode |
| `convex/jobLeads.ts` | untouched — reuses existing public `deleteLead` mutation |

## Components

### 1. Selection state — `jkChatWindow-LeadsMode.tsx`

Plain `useState`, not a new context provider. Jobs uses `jkJobsProvider.tsx` because job state is consumed by multiple views app-wide; Leads has exactly one composing parent (`jkChatWindow-LeadsMode.tsx`), so lifting state into that parent and passing it down as props is sufficient. If a second consumer of leads-selection ever appears, promote this to a provider then — not before.

State: `selectionMode: boolean`, `selectedLeadIds: Set<Id<"jobLeads">>`.
Handlers: `toggleSelectionMode()`, `toggleLeadSelection(id)`, `selectAllLeads(ids)`, `clearSelection()`.

### 2. Toolbar — `jkChatWindow-LeadsMode.tsx`

Same row as the existing `h2` + `ScanNowButton` (currently `jkChatWindow-LeadsMode.tsx:39-47`). Mirrors `jkChatWindow-MyJobsMode.tsx:214-271`:

- "Multi-select" toggle button, always visible
- When `selectionMode` is true: selected count, "Select All" button, destructive "Delete Selected" button (disabled while `selectedLeadIds.size === 0`), "Cancel" button (exits selection mode, clears selection)
- "Delete Selected" opens the existing `JkConfirmDelete` dialog before firing the bulk delete

### 3. Row checkboxes — `LeadsList.tsx`

`LeadsList` receives `selectionMode`, `selectedLeadIds`, `onToggleLeadSelection` as props. When `selectionMode` is true, each `<tr>` gets a leading `<td>` containing a real `<input type="checkbox">`, checked against `selectedLeadIds.has(lead._id)`, calling `onToggleLeadSelection(lead._id)` on change.

This departs from Jobs' per-card circle/checkmark icon toggle (`jkJobsGrid.tsx:192-206`) deliberately — Leads renders as an HTML `<table>`, and a real checkbox is the native, accessible control for a table row, whereas Jobs renders as a card grid where an icon toggle fits the visual language better. Same underlying selection semantics, different control because the container is different.

### 4. Bulk delete — `jkChatWindow-LeadsMode.tsx`

No new Convex mutation. Mirrors `handleBulkDeleteJobs` in `jkJobsProvider.tsx:288-306`:

```ts
await Promise.all(
  Array.from(selectedLeadIds).map((leadId) => deleteLead({ leadId }))
)
```

against the existing public `deleteLead` mutation in `convex/jobLeads.ts:197-209`. This is deliberate, not an oversight: `deleteLead` schedules `internal.emailAgent.mirror.removeLead` per lead to clean up the Life Dashboard mirror row, and the existing internal `deleteLeadsByIds` bulk mutation (`convex/jobLeads.ts:213-228`, CLI-only today) does not do this cleanup. Calling the single-item mutation N times in parallel preserves the mirror cleanup for every deleted lead; wrapping the internal bulk mutation would silently orphan mirror rows on the dashboard.

On success: clear `selectedLeadIds`, exit selection mode, close the confirm dialog.

### 5. Error handling

If any individual `deleteLead` call in the `Promise.all` rejects, catch it, keep selection mode active with the surviving selection state intact (so the user isn't forced to re-select), and surface an inline error rather than silently losing track of which leads did or didn't delete.

### 6. Testing

No existing test suite covers this UI area (the Jobs equivalent has none either). Verify manually: start the dev server, open the Leads tab, toggle multi-select, select a subset of rows via checkbox, click Delete Selected, confirm via the dialog, and check that (a) the table updates, (b) the corresponding Convex `jobLeads` rows are gone, and (c) the mirrored rows disappear from the Life Dashboard.
