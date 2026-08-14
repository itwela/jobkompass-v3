# Leads Multi-Select + Bulk Delete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user select multiple rows in the Job Leads table and delete them in one action, with the "Multi-select" and "Delete Selected" controls on the same toolbar row as the existing Scan Now button.

**Architecture:** Selection state (`selectionMode`, `selectedLeadIds`) lives as plain `useState` in `jkChatWindow-LeadsMode.tsx` — the one parent that composes `ScanNowButton` and `LeadsList` — and is passed down to `LeadsList` as props. Bulk delete calls the existing single-item `deleteLead` Convex mutation once per selected lead via `Promise.all`, reusing its per-lead Life Dashboard mirror cleanup. No new Convex mutation, no new context provider.

**Tech Stack:** Next.js (App Router), React, TypeScript, Convex (`convex/react`), Tailwind, shadcn `Button`/`Dialog` components.

## Global Constraints

- No new Convex mutation — bulk delete must call the existing public `deleteLead` mutation (`convex/jobLeads.ts:197-209`) once per lead, not the internal `deleteLeadsByIds` (`convex/jobLeads.ts:213-228`), because only `deleteLead` schedules the Life Dashboard mirror cleanup per lead.
- No new context provider — selection state is lifted into `jkChatWindow-LeadsMode.tsx` only (see spec: `docs/superpowers/specs/2026-08-13-leads-multiselect-bulk-delete-design.md`).
- Toolbar UI and behavior mirror the existing My Jobs multi-select flow (`jkChatWindow-MyJobsMode.tsx:214-271`) exactly: Multi-select toggle → (count, Select All, destructive Delete Selected, Cancel) → `JkConfirmDelete` confirm dialog.
- Row selection control is a real `<input type="checkbox">` (table context), not the icon toggle Jobs uses for its card grid.
- This repo's `npm run lint` is known broken (dead `next lint` config) — do not use it to gate this work. Use `npx tsc --noEmit` for type-checking, per existing project convention.
- No test suite exists for this UI area (Jobs' equivalent has none either) — verification is `tsc --noEmit` per task plus one manual end-to-end pass in the dev server at the end.

---

### Task 1: Add selection props and checkboxes to `LeadsList`

**Files:**
- Modify: `app/jk-components/jkEmailLeads/LeadsList.tsx`

**Interfaces:**
- Produces: `LeadsList` now accepts props `{ selectionMode?: boolean; selectedLeadIds?: Id<"jobLeads">[]; onToggleLeadSelection?: (id: Id<"jobLeads">) => void }`, all optional so existing callers (if any) keep compiling. Task 2 will pass all three explicitly.

This task is self-contained: it makes `LeadsList` selection-aware without needing the parent wired up yet. With no props passed, current behavior (used today) is unchanged.

- [ ] **Step 1: Add the `Id` type import**

In `app/jk-components/jkEmailLeads/LeadsList.tsx`, change line 7 from:

```tsx
import type { Doc } from "@/convex/_generated/dataModel";
```

to:

```tsx
import type { Doc, Id } from "@/convex/_generated/dataModel";
```

- [ ] **Step 2: Add the props interface and accept props in `LeadsList`**

Replace line 57:

```tsx
export function LeadsList() {
```

with:

```tsx
interface LeadsListProps {
  selectionMode?: boolean;
  selectedLeadIds?: Id<"jobLeads">[];
  onToggleLeadSelection?: (id: Id<"jobLeads">) => void;
}

export function LeadsList({
  selectionMode = false,
  selectedLeadIds = [],
  onToggleLeadSelection,
}: LeadsListProps) {
```

- [ ] **Step 3: Add the checkbox column header**

In the `<thead>` block, change (lines 94-102):

```tsx
          <tr className="text-left border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-3 py-2.5 font-medium">Company</th>
```

to:

```tsx
          <tr className="text-left border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            {selectionMode && <th className="px-3 py-2.5 w-8" />}
            <th className="px-3 py-2.5 font-medium">Company</th>
```

(leave the rest of that `<tr>` — Role/From/Inbox/Status/Date/trailing empty `<th>` — unchanged)

- [ ] **Step 4: Add the checkbox cell to each row**

In the `<tbody>` row (starts at line 110), change:

```tsx
              <tr
                key={lead._id}
                className="border-b last:border-b-0 hover:bg-muted/30 transition-colors"
                onClick={() => { if (!lead.seenAt) markSeen({ leadId: lead._id }); }}
              >
                <td className="px-3 py-2.5 font-medium whitespace-nowrap" title={lead.company}>
```

to:

```tsx
              <tr
                key={lead._id}
                className="border-b last:border-b-0 hover:bg-muted/30 transition-colors"
                onClick={() => { if (!lead.seenAt) markSeen({ leadId: lead._id }); }}
              >
                {selectionMode && (
                  <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedLeadIds.includes(lead._id)}
                      onChange={() => onToggleLeadSelection?.(lead._id)}
                      aria-label={`Select ${lead.company}`}
                    />
                  </td>
                )}
                <td className="px-3 py-2.5 font-medium whitespace-nowrap" title={lead.company}>
```

The `stopPropagation` keeps clicking the checkbox from also firing the row's `markSeen` click handler.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors referencing `LeadsList.tsx`.

- [ ] **Step 6: Commit**

```bash
git add app/jk-components/jkEmailLeads/LeadsList.tsx
git commit -m "Add selection props and row checkboxes to LeadsList"
```

---

### Task 2: Add selection state, toolbar controls, and bulk delete to the Leads toolbar

**Files:**
- Modify: `app/jk-components/jk-chatwindow-components/jkChatWindow-LeadsMode.tsx`

**Interfaces:**
- Consumes: `LeadsList` props from Task 1 — `selectionMode: boolean`, `selectedLeadIds: Id<"jobLeads">[]`, `onToggleLeadSelection: (id: Id<"jobLeads">) => void`.
- Consumes: `api.jobLeads.deleteLead` mutation, args `{ leadId: Id<"jobLeads"> }` (`convex/jobLeads.ts:197-209`).
- Consumes: `JkConfirmDelete` component, props `{ message, onConfirm, onCancel, isLoading }` (`app/jk-components/jkConfirmDelete.tsx`).
- Consumes: shadcn `Button` component from `@/components/ui/button` (used exactly this way in `jkChatWindow-MyJobsMode.tsx`).

- [ ] **Step 1: Add imports**

At the top of `app/jk-components/jk-chatwindow-components/jkChatWindow-LeadsMode.tsx`, change:

```tsx
'use client'

import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { ApprovalQueue } from "@/app/jk-components/jkEmailLeads/ApprovalQueue"
import { LeadsList } from "@/app/jk-components/jkEmailLeads/LeadsList"
import { ScanNowButton } from "@/app/jk-components/jkEmailLeads/ScanNowButton"
import { AddLeadFromEmail } from "@/app/jk-components/jkEmailLeads/AddLeadFromEmail"
```

to:

```tsx
'use client'

import { useState } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { Button } from "@/components/ui/button"
import { ApprovalQueue } from "@/app/jk-components/jkEmailLeads/ApprovalQueue"
import { LeadsList } from "@/app/jk-components/jkEmailLeads/LeadsList"
import { ScanNowButton } from "@/app/jk-components/jkEmailLeads/ScanNowButton"
import { AddLeadFromEmail } from "@/app/jk-components/jkEmailLeads/AddLeadFromEmail"
import JkConfirmDelete from "../jkConfirmDelete"
```

- [ ] **Step 2: Add selection state and handlers inside the component**

Change:

```tsx
export default function JkCW_LeadsMode() {
  // Same subscription the child components use — Convex dedupes it, and having the
  // full list here lets the section headers show live totals so it's obvious whether
  // leads/drafts generated at all.
  const leads = useQuery(api.jobLeads.list, {})
  const totalCount = leads?.length
  const pendingCount = leads?.filter(
    (l) => l.status === "pending_approval" || l.status === "sending"
  ).length

  return (
```

to:

```tsx
export default function JkCW_LeadsMode() {
  // Same subscription the child components use — Convex dedupes it, and having the
  // full list here lets the section headers show live totals so it's obvious whether
  // leads/drafts generated at all.
  const leads = useQuery(api.jobLeads.list, {})
  const totalCount = leads?.length
  const pendingCount = leads?.filter(
    (l) => l.status === "pending_approval" || l.status === "sending"
  ).length
  const leadIds = (leads ?? []).map((l) => l._id)

  const deleteLead = useMutation(api.jobLeads.deleteLead)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedLeadIds, setSelectedLeadIds] = useState<Id<"jobLeads">[]>([])
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false)
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)
  const [bulkDeleteError, setBulkDeleteError] = useState<string | null>(null)

  const handleEnterSelectionMode = () => {
    setSelectionMode(true)
    setBulkDeleteError(null)
  }

  const handleExitSelectionMode = () => {
    setSelectionMode(false)
    setSelectedLeadIds([])
    setShowBulkDeleteConfirm(false)
    setBulkDeleteError(null)
  }

  const toggleLeadSelection = (id: Id<"jobLeads">) => {
    setSelectedLeadIds((prev) =>
      prev.includes(id) ? prev.filter((leadId) => leadId !== id) : [...prev, id]
    )
  }

  const handleSelectAllVisible = () => {
    setSelectedLeadIds(leadIds)
  }

  const handleConfirmBulkDelete = async () => {
    setIsBulkDeleting(true)
    setBulkDeleteError(null)
    try {
      await Promise.all(selectedLeadIds.map((leadId) => deleteLead({ leadId })))
      setSelectedLeadIds([])
      setSelectionMode(false)
      setShowBulkDeleteConfirm(false)
    } catch (err) {
      // Some deletes may have succeeded and some failed — leave selectedLeadIds and
      // selectionMode as-is so the user can see what's left and retry, rather than
      // losing track of which leads did or didn't delete.
      setBulkDeleteError(
        err instanceof Error ? err.message : "Failed to delete selected leads. Please try again."
      )
      setShowBulkDeleteConfirm(false)
    } finally {
      setIsBulkDeleting(false)
    }
  }

  return (
```

- [ ] **Step 3: Replace the "All Leads" toolbar section**

Change:

```tsx
        <section>
          <div className="flex items-center justify-between mb-4 gap-3">
            <h2 className="text-lg font-semibold">
              All Leads{totalCount !== undefined && ` (${totalCount})`}
            </h2>
            <ScanNowButton />
          </div>
          <LeadsList />
        </section>
```

to:

```tsx
        <section>
          <div className="flex items-center justify-between mb-4 gap-3">
            <h2 className="text-lg font-semibold">
              All Leads{totalCount !== undefined && ` (${totalCount})`}
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              {!selectionMode ? (
                <>
                  <Button variant="outline" onClick={handleEnterSelectionMode}>
                    Multi-select
                  </Button>
                  <ScanNowButton />
                </>
              ) : (
                <>
                  <span className="text-sm text-muted-foreground">
                    {selectedLeadIds.length} selected
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAllVisible}
                    disabled={leadIds.length === 0 || selectedLeadIds.length === leadIds.length}
                  >
                    Select All
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      if (selectedLeadIds.length === 0) return
                      setShowBulkDeleteConfirm(true)
                    }}
                    disabled={selectedLeadIds.length === 0}
                  >
                    Delete Selected
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleExitSelectionMode}>
                    Cancel
                  </Button>
                </>
              )}
            </div>
          </div>
          {selectionMode && showBulkDeleteConfirm && (
            <div className="mb-4 max-w-xl">
              <JkConfirmDelete
                message={`Delete ${selectedLeadIds.length} selected lead${selectedLeadIds.length === 1 ? '' : 's'}?`}
                onConfirm={handleConfirmBulkDelete}
                onCancel={() => setShowBulkDeleteConfirm(false)}
                isLoading={isBulkDeleting}
              />
            </div>
          )}
          {selectionMode && bulkDeleteError && (
            <p className="mb-4 text-sm text-red-600">{bulkDeleteError}</p>
          )}
          <LeadsList
            selectionMode={selectionMode}
            selectedLeadIds={selectedLeadIds}
            onToggleLeadSelection={toggleLeadSelection}
          />
        </section>
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors referencing `jkChatWindow-LeadsMode.tsx` or `LeadsList.tsx`.

- [ ] **Step 5: Commit**

```bash
git add app/jk-components/jk-chatwindow-components/jkChatWindow-LeadsMode.tsx
git commit -m "Add multi-select and bulk delete to the Leads toolbar"
```

---

### Task 3: Manual end-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`

- [ ] **Step 2: Open the Leads tab and verify default state**

Navigate to the Job Leads view. Confirm the toolbar next to "All Leads" shows "Multi-select" and "Scan Now" side by side, and the table renders exactly as before (no checkbox column, single-row Delete buttons still work).

- [ ] **Step 3: Verify entering selection mode**

Click "Multi-select". Confirm: a checkbox column appears on every row, the toolbar now shows "0 selected", "Select All", a disabled "Delete Selected", and "Cancel" — and "Scan Now" is hidden.

- [ ] **Step 4: Verify row selection**

Check 2-3 row checkboxes. Confirm the "selected" count updates and "Delete Selected" becomes enabled. Confirm clicking a checkbox does not also trigger the row's "mark as seen" click handler in a way that breaks anything (no console errors).

- [ ] **Step 5: Verify Select All**

Click "Select All". Confirm every row's checkbox is checked and the count matches the total lead count. Confirm the "Select All" button becomes disabled once everything is selected.

- [ ] **Step 6: Verify bulk delete**

Uncheck a couple of rows so only 2-3 leads are selected, then click "Delete Selected". Confirm the `JkConfirmDelete` panel appears with the correct count and message. Click confirm. Confirm: the deleted rows disappear from the table, "All Leads" count decrements, selection mode exits automatically, and the toolbar returns to "Multi-select" + "Scan Now".

- [ ] **Step 7: Verify Cancel**

Re-enter selection mode, check a row, click "Cancel". Confirm selection mode exits, no delete happens, and the table is unchanged.

- [ ] **Step 8: Verify the Life Dashboard mirror cleanup**

For one of the leads deleted in Step 6, check the Life Dashboard (or wherever the mirrored lead row surfaces) and confirm it was removed there too — this is the behavior that motivated calling `deleteLead` per-lead instead of the internal bulk mutation.
