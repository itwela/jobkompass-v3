# Document Folders & Favorites — Design

Date: 2026-08-03

## Problem

The My Documents view (`app/jk-components/jk-chatwindow-components/jkChatWindow-DocumentsForm.tsx`)
renders every resume and cover letter as one flat grid. The user has accumulated enough
resumes that the flat list is no longer navigable. Two things are missing:

1. **No grouping.** There is no way to file resumes under a heading like "Design roles"
   or "Eng". Search (`searchTerm`) and the type filter (`typeFilter`: all / resume /
   cover-letter) are the only reduction tools, and both are transient — they do not
   persist an organizational decision.
2. **No prioritization below the base resume.** `setBaseResume` (added 2026-07-16)
   surfaces exactly one resume with an amber border and floats it first, but every
   other document is undifferentiated. The user's most-reached-for resumes are mixed
   in with one-off tailored generations.

## Goals

1. Blue manila-folder cards in the documents list, visually a sibling of the sticky
   notes in `jkChatWindow-ResourcesMode.tsx`.
2. Resumes **and** cover letters can be filed into exactly one folder.
3. Three ways to file a document: drag onto a folder, `⋮` menu, multi-select batch.
4. Documents can be favorited, get a distinct blue border + filled star, and sort
   **after the base resume and before regular documents**.
5. Deleting a folder never deletes documents.

Non-goals (YAGNI): no nested folders; no per-folder colors (blue only); no folder
sharing; no reordering documents by hand within a folder; no folders for job leads or
resources.

## Architecture

### Part A — Schema (`convex/schema.ts`)

New table:

```ts
documentFolders: defineTable({
  userId: v.string(),
  name: v.string(),
  createdAt: v.number(),
  updatedAt: v.number(),
}).index("by_user", ["userId"]),
```

Two optional fields added to **both** `resumes` and `coverLetters`:

```ts
folderId:   v.optional(v.id("documentFolders")),
isFavorite: v.optional(v.boolean()),
```

Both are optional and additive, so existing rows require no migration and no backfill.

**`isFavorite` is a new field and deliberately does not reuse `isActive`.** `isActive`
is the base-resume flag consumed by the job-lead tailoring path
(`convex/documents.ts:398 setBaseResume`, `convex/documents.ts:374 setSoleActiveResume`,
and the email agent's `resumes.find(r => r.isActive)`). Overloading it would mean
favoriting a resume silently reassigns which resume job leads tailor from.

### Part B — Convex (`convex/documentFolders.ts`, new file)

All functions authenticate via `getAuthUserId(ctx)` and re-check
`doc.userId === userId` before any read-back or write. JobKompass is multi-user and
every one of these takes a document or folder ID from the client.

| Function | Type | Args | Behavior |
|---|---|---|---|
| `listFolders` | query | — | Folders for the user, each with `resumeCount` and `coverLetterCount`. Counts are computed by scanning the user's `resumes` + `coverLetters` via `by_user`, the same access pattern `listResumes` already uses. |
| `createFolder` | mutation | `{ name }` | Trims name; rejects empty. Returns the new folder id. |
| `renameFolder` | mutation | `{ folderId, name }` | Trims name; rejects empty. |
| `deleteFolder` | mutation | `{ folderId }` | Sets `folderId: undefined` on every resume and cover letter pointing at it, then deletes the folder row. **Documents are never deleted.** |
| `moveDocuments` | mutation | `{ items: Array<{ id: string, type: "resume" \| "cover-letter" }>, folderId: Id<"documentFolders"> \| null }` | Sets or clears `folderId` on each item. `null` means "remove from folder". One mutation backs all three move paths. Verifies the target folder belongs to the user before writing. |

Added to `convex/documents.ts`, beside `setBaseResume`:

| Function | Type | Args | Behavior |
|---|---|---|---|
| `toggleFavorite` | mutation | `{ documentId: string, documentType: "resume" \| "cover-letter" }` | Flips `isFavorite`. Unlike `setBaseResume` there is no "only one" invariant — any number of documents can be favorited. |

### Part C — Sorting (`lib/documents/sortDocuments.ts`, new file)

The ordering rule extracted as a pure function so it can be unit tested without
mounting the 1897-line form component.

```ts
export type SortableDoc = {
  _id?: unknown; id?: unknown;
  documentType?: string;
  isActive?: boolean;
  isFavorite?: boolean;
  updatedAt?: number;
};

// rank: 0 = base resume, 1 = favorite, 2 = regular
export function documentRank(doc: SortableDoc, baseResumeId: string | null): number;

export function sortDocuments<T extends SortableDoc>(
  docs: T[],
  baseResumeId: string | null,
): T[];
```

`sortDocuments` returns a new array (does not mutate the input — the current code
sorts `filteredDocuments` in place). Sort is by ascending rank, then by `updatedAt`
descending, then by id ascending so the order is fully deterministic when timestamps
tie.

`baseResumeId` continues to be derived exactly as it is today in `DocumentsForm`:
among resumes with `isActive`, the one with the highest `updatedAt` wins.

### Part D — Components (`app/jk-components/jk-documents/`, new directory)

`jkChatWindow-DocumentsForm.tsx` is already 1897 lines. New UI goes in its own files
and the form wires them in.

**`jkDocumentFolderCard.tsx`** — the blue folder card.

Mirrors the `stickyNoteColor` pattern in `jkChatWindow-ResourcesMode.tsx:28` so the
two read as one family:

```ts
const folderColor = {
  bg: '#93C5FD',                    // blue-300
  border: '#3B82F6',                // blue-500
  shadow: 'rgba(59, 130, 246, 0.3)',
};
```

- Shape is pure CSS: a tab element (rounded top corners, ~40% width, ~14px tall) sitting
  directly above a body element, both sharing `backgroundColor` and `border`, with a
  narrow lighter sliver between them so the folder reads as having contents.
- Hover uses the same Framer Motion spring as the sticky notes:
  `whileHover={{ scale: 1.05 }}`, `transition={{ type: "spring", stiffness: 300, damping: 25 }}`.
- **No index-based rotation**, unlike the sticky notes. Sticky notes tilt because they
  are scraps of paper; a row of filing folders reads better flat and keeps labels legible.
- Content: folder name, and a count line reflecting the active type filter.
- `⋮` dropdown: Rename, Delete folder. Delete routes through the existing
  `JkConfirmDelete` component, with copy stating documents will be moved out, not deleted.
- Acts as a drop target: `onDragOver` (with `preventDefault`) applies a ring highlight,
  `onDrop` parses the dragged payload and calls `moveDocuments`.

**`jkFolderBreadcrumb.tsx`** — the `← All documents / <Folder name>` row shown when a
folder is open. Also a drop target: dropping a card on it calls `moveDocuments` with
`folderId: null`, which is how a document gets dragged back out.

**`jkMoveToFolderMenu.tsx`** — folder picker shared by the `⋮` menu and the
multi-select toolbar. Lists folders, plus "Remove from folder" when the document is
currently filed, plus "New folder…" which creates and moves in one step.

### Part E — Wiring in `jkChatWindow-DocumentsForm.tsx`

New local state: `openFolderId: Id<"documentFolders"> | null`, plus dialog state for
folder create/rename.

**View resolution**, applied in this order:

1. If `searchTerm` is non-empty → **search overrides folders entirely**. Search every
   document regardless of `folderId`, hide the folder row, and show a note that results
   span all folders. Scoping search to the open folder would defeat the purpose of the
   feature, which exists because the flat list is too large to scan.
2. Else if `openFolderId` is set → show only documents whose `folderId` matches, with
   the breadcrumb above. No folder row (no nesting).
3. Else → show the folder row, then only documents with no `folderId` (loose documents).

The existing `typeFilter` applies within whichever view is active. Folder counts respect
the active `typeFilter`, so a folder showing "3 resumes" under the Resumes filter always
opens to three cards. Folders are never hidden by the filter — a folder with zero
matching documents still renders and opens to the existing empty state.

**Card changes:**

- Existing base-resume amber treatment is unchanged and still wins over other styling.
- Favorite: `border-blue-500 border-2` plus a filled blue `Star` in the card's preview
  corner. The star is always rendered (outline when not favorited, filled when
  favorited) and is the toggle control — `onClick` calls `toggleFavorite` and
  `stopPropagation` so it does not open the document.
- Cards get `draggable` and an `onDragStart` that writes
  `JSON.stringify({ id, type })` to `dataTransfer`. Dragging is disabled while
  `selectionMode` is active, so drag and bulk-select never compete.
- `⋮` menu gains a "Move to folder" item rendering `jkMoveToFolderMenu`.

**Multi-select toolbar** gains a "Move to folder" button beside "Delete Selected".

### Known scope limit: multi-select and cover letters

Multi-select today tracks resumes only — `selectedResumeIds` in `jkResumeProvider`,
with the checkbox rendered `documentType === "resume" ? ... : null`
(`jkChatWindow-DocumentsForm.tsx:1301`). Cover letters cannot be multi-selected at all.
This is pre-existing behavior, not introduced here.

Therefore **batch move operates on resumes only**. Cover letters are still fully
folderable via drag and via the `⋮` menu, so no document type is unreachable.
Extending multi-select to cover letters is a separate change and is out of scope.

## Data Flow

Filing a document, all three paths converging on one mutation:

```
drag card → drop on folder card ─┐
⋮ menu → jkMoveToFolderMenu ─────┼→ moveDocuments({ items, folderId }) → Convex
multi-select → Move to folder ───┘        ↓
                                    listFolders + listResumes/listCoverLetters
                                    reactively update → grid re-renders
```

Opening a folder is client-side only — no query refetch. The provider already holds
every document (`jkDocumentsProvider.tsx:48` merges `resumeList` + `coverLetterList`),
so folder views are derived from data already in memory.

## Error Handling

- `createFolder` / `renameFolder` reject empty or whitespace-only names; the dialog
  disables its submit button in that state.
- `moveDocuments` verifies both the target folder and every moved document belong to
  the calling user; a mismatch throws and the client surfaces a `toast.error`.
- `deleteFolder` clears members before deleting the folder row. If the clear fails the
  mutation throws before the folder is deleted, so there are no dangling `folderId`
  pointers.
- A `folderId` pointing at a folder that no longer exists is treated as loose: the root
  view's "no `folderId`" test is `!doc.folderId || !knownFolderIds.has(doc.folderId)`,
  so an orphaned document is always reachable rather than invisible.
- Drag-and-drop payloads that fail to parse are ignored silently — a drop from outside
  the app should be a no-op, not an error toast.

## Testing

- **Unit (vitest)** on `lib/documents/sortDocuments.ts`: base resume first; favorites
  after base and before regulars; `updatedAt` descending within a rank; deterministic
  order on tied timestamps; `baseResumeId === null` handled; input array not mutated.
- **Typecheck**: `npx tsc --noEmit`.
- **Manual against the live deployment**: create a folder; drag a resume in; open it;
  drag it back out via the breadcrumb; move a cover letter via `⋮`; batch-move via
  multi-select; favorite two documents and confirm ordering is base → favorites →
  regulars; search from inside a folder and confirm it spans all folders; delete a
  folder and confirm its documents reappear loose rather than disappearing.

**Do not gate on `npm run lint`.** Linting is broken repo-wide in this project —
`next lint` was removed in Next 16 and the eslint config crashes. The gate is
`tsc --noEmit` plus vitest.

## Deployment Note

JobKompass runs on the Convex **dev** slot `proficient-mammoth-632`, and that slot is
what the live site reads. `convex dev` pushes the schema change to live data
immediately; there is no staging deployment. Both new fields are optional and the new
table is additive, so the change is safe to apply to live data, but it is not reversible
by "just not deploying."
