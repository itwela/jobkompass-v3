# Document Folders & Favorites Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user file resumes and cover letters into blue folder cards in My Documents, and favorite documents so they sort right after the base resume.

**Architecture:** A new `documentFolders` Convex table plus two optional fields (`folderId`, `isFavorite`) on the existing `resumes` and `coverLetters` tables. Ordering is extracted from the 1897-line documents form into a pure, unit-tested module. New UI lives in its own `app/jk-components/jk-documents/` directory; the form wires it in and holds only the `openFolderId` view state.

**Tech Stack:** Next.js 16, React, TypeScript, Convex 1.24, Convex Auth (`getAuthUserId`), Framer Motion 12, Tailwind, shadcn/ui (`DropdownMenu`, `Dialog`, `Button`, `Input`), lucide-react icons, vitest 4.

**Spec:** `docs/superpowers/specs/2026-08-03-document-folders-and-favorites-design.md`

**Branch:** `feat/document-folders-favorites` (already created; the spec commit is on it)

## Global Constraints

- **Do not run `npm run lint`.** Linting is broken repo-wide in this project — `next lint` was removed in Next 16 and the eslint config crashes. The gate is `npx tsc --noEmit` plus `npm test`.
- **There is no `convex-test` harness in this repo.** Convex functions are verified by `npx tsc --noEmit` and manual testing against the deployment. Do not add a Convex test harness — that is out of scope.
- **Deployment slot is `dev:proficient-mammoth-632` and it is what the live site reads.** `npx convex dev` pushes schema changes to live user data immediately. There is no staging.
- **`isFavorite` must never be conflated with `isActive`.** `isActive` is the base-resume flag consumed by `setBaseResume`, `setSoleActiveResume`, and the job-lead email agent. Never read or write `isActive` in favorite code paths.
- **Never mutate `updatedAt` when moving or favoriting a document.** `updatedAt` is the tie-breaker in the sort; bumping it on a move would silently reorder the grid.
- **Deleting a folder never deletes documents.** Members get `folderId: undefined` and become loose.
- **No nested folders. Folders are blue only** (`#93C5FD` bg / `#3B82F6` border). No per-folder color picker.
- **A document belongs to at most one folder.** Single `folderId` field, no join table.
- Existing base-resume amber styling and behavior must not change.
- Test files are colocated beside their source as `<name>.test.ts`, matching `lib/resume/templatePreference.test.ts`.

---

### Task 1: Document ordering module

Pure functions, no React, no Convex. Everything else depends on these names.

**Files:**
- Create: `lib/documents/sortDocuments.ts`
- Test: `lib/documents/sortDocuments.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `type SortableDoc = { _id?: unknown; id?: unknown; documentType?: string; isActive?: boolean; isFavorite?: boolean; updatedAt?: number }`
  - `function docId(doc: SortableDoc): string`
  - `function resolveBaseResumeId(docs: SortableDoc[]): string | null`
  - `function documentRank(doc: SortableDoc, baseResumeId: string | null): number`
  - `function sortDocuments<T extends SortableDoc>(docs: T[], baseResumeId: string | null): T[]`

- [ ] **Step 1: Write the failing test**

Create `lib/documents/sortDocuments.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  docId,
  documentRank,
  resolveBaseResumeId,
  sortDocuments,
  type SortableDoc,
} from "./sortDocuments";

const doc = (over: Partial<SortableDoc> & { _id: string }): SortableDoc => ({
  documentType: "resume",
  updatedAt: 0,
  ...over,
});

describe("docId", () => {
  it("prefers _id", () => {
    expect(docId({ _id: "a", id: "b" })).toBe("a");
  });

  it("falls back to id", () => {
    expect(docId({ id: "b" })).toBe("b");
  });

  it("returns an empty string when neither is present", () => {
    expect(docId({})).toBe("");
  });
});

describe("resolveBaseResumeId", () => {
  it("returns null when no resume is active", () => {
    expect(resolveBaseResumeId([doc({ _id: "a" }), doc({ _id: "b" })])).toBeNull();
  });

  it("returns the single active resume", () => {
    expect(
      resolveBaseResumeId([doc({ _id: "a" }), doc({ _id: "b", isActive: true })])
    ).toBe("b");
  });

  it("breaks a multi-active legacy state by newest updatedAt", () => {
    expect(
      resolveBaseResumeId([
        doc({ _id: "a", isActive: true, updatedAt: 100 }),
        doc({ _id: "b", isActive: true, updatedAt: 300 }),
        doc({ _id: "c", isActive: true, updatedAt: 200 }),
      ])
    ).toBe("b");
  });

  it("ignores an active cover letter", () => {
    expect(
      resolveBaseResumeId([
        doc({ _id: "a", documentType: "cover-letter", isActive: true }),
      ])
    ).toBeNull();
  });

  it("treats a missing documentType as a resume", () => {
    expect(
      resolveBaseResumeId([{ _id: "a", isActive: true, updatedAt: 1 }])
    ).toBe("a");
  });
});

describe("documentRank", () => {
  it("ranks the base resume first", () => {
    expect(documentRank(doc({ _id: "a" }), "a")).toBe(0);
  });

  it("ranks a favorite after the base resume", () => {
    expect(documentRank(doc({ _id: "b", isFavorite: true }), "a")).toBe(1);
  });

  it("ranks a regular document last", () => {
    expect(documentRank(doc({ _id: "b" }), "a")).toBe(2);
  });

  it("lets base win when the base resume is also favorited", () => {
    expect(documentRank(doc({ _id: "a", isFavorite: true }), "a")).toBe(0);
  });

  it("has no base when baseResumeId is null", () => {
    expect(documentRank(doc({ _id: "a" }), null)).toBe(2);
  });
});

describe("sortDocuments", () => {
  it("orders base resume, then favorites, then regulars", () => {
    const docs = [
      doc({ _id: "regular" }),
      doc({ _id: "fav", isFavorite: true }),
      doc({ _id: "base", isActive: true }),
    ];
    expect(sortDocuments(docs, "base").map(docId)).toEqual([
      "base",
      "fav",
      "regular",
    ]);
  });

  it("orders newest first within the same rank", () => {
    const docs = [
      doc({ _id: "old", updatedAt: 100 }),
      doc({ _id: "new", updatedAt: 300 }),
      doc({ _id: "mid", updatedAt: 200 }),
    ];
    expect(sortDocuments(docs, null).map(docId)).toEqual(["new", "mid", "old"]);
  });

  it("breaks tied timestamps by id so order is deterministic", () => {
    const docs = [
      doc({ _id: "b", updatedAt: 100 }),
      doc({ _id: "a", updatedAt: 100 }),
    ];
    expect(sortDocuments(docs, null).map(docId)).toEqual(["a", "b"]);
  });

  it("treats a missing updatedAt as oldest", () => {
    const docs = [{ _id: "none" }, doc({ _id: "has", updatedAt: 1 })];
    expect(sortDocuments(docs, null).map(docId)).toEqual(["has", "none"]);
  });

  it("does not mutate the input array", () => {
    const docs = [doc({ _id: "b" }), doc({ _id: "a", isActive: true })];
    const before = docs.map(docId);
    sortDocuments(docs, "a");
    expect(docs.map(docId)).toEqual(before);
  });

  it("returns an empty array unchanged", () => {
    expect(sortDocuments([], null)).toEqual([]);
  });

  it("sorts a mixed resume and cover letter list together", () => {
    const docs = [
      doc({ _id: "cl", documentType: "cover-letter", updatedAt: 500 }),
      doc({ _id: "favCl", documentType: "cover-letter", isFavorite: true, updatedAt: 1 }),
      doc({ _id: "base", isActive: true, updatedAt: 1 }),
    ];
    expect(sortDocuments(docs, "base").map(docId)).toEqual([
      "base",
      "favCl",
      "cl",
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/documents/sortDocuments.test.ts`
Expected: FAIL — `Failed to resolve import "./sortDocuments"`

- [ ] **Step 3: Write the implementation**

Create `lib/documents/sortDocuments.ts`:

```ts
/**
 * Ordering rules for the My Documents grid.
 *
 * Extracted from jkChatWindow-DocumentsForm.tsx so the ordering can be tested
 * without mounting the form. Pure — no React, no Convex.
 */

export type SortableDoc = {
  _id?: unknown;
  id?: unknown;
  documentType?: string;
  isActive?: boolean;
  isFavorite?: boolean;
  updatedAt?: number;
};

/** Stable string id for a document, matching how DocumentsForm keys its cards. */
export function docId(doc: SortableDoc): string {
  return String(doc?._id ?? doc?.id ?? "");
}

/**
 * The base resume is the resume with `isActive === true` that job leads tailor
 * from. If several are flagged (a legacy "everything is active" state), the most
 * recently updated wins so the displayed base is deterministic even before
 * `setBaseResume` heals it.
 */
export function resolveBaseResumeId(docs: SortableDoc[]): string | null {
  const active = docs.filter(
    (doc) => (doc.documentType ?? "resume") === "resume" && doc.isActive === true
  );
  if (active.length === 0) return null;
  const winner = active.reduce((best, cur) =>
    (cur.updatedAt ?? 0) > (best.updatedAt ?? 0) ? cur : best
  );
  return docId(winner);
}

/** 0 = base resume, 1 = favorite, 2 = regular. Lower sorts first. */
export function documentRank(doc: SortableDoc, baseResumeId: string | null): number {
  if (baseResumeId !== null && docId(doc) === baseResumeId) return 0;
  if (doc.isFavorite === true) return 1;
  return 2;
}

/**
 * Base resume, then favorites, then regulars; newest first within a rank; id
 * ascending when timestamps tie. Returns a new array and never mutates its input.
 */
export function sortDocuments<T extends SortableDoc>(
  docs: T[],
  baseResumeId: string | null
): T[] {
  return [...docs].sort((a, b) => {
    const rankDiff =
      documentRank(a, baseResumeId) - documentRank(b, baseResumeId);
    if (rankDiff !== 0) return rankDiff;

    const updatedDiff = (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
    if (updatedDiff !== 0) return updatedDiff;

    return docId(a).localeCompare(docId(b));
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/documents/sortDocuments.test.ts`
Expected: PASS, 20 tests

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add lib/documents/sortDocuments.ts lib/documents/sortDocuments.test.ts
git commit -m "feat(documents): add pure document ordering module

Base resume, then favorites, then regulars. Extracted so the ordering
can be tested without mounting the 1897-line documents form."
```

---

### Task 2: Schema and Convex backend

**Files:**
- Modify: `convex/schema.ts` (the `documentsTables` object — `resumes` at :6, `coverLetters` at :40)
- Create: `convex/documentFolders.ts`
- Modify: `convex/documents.ts` (add `toggleFavorite` after `setBaseResume`, which ends at :420)

**Interfaces:**
- Consumes: nothing from Task 1
- Produces:
  - `api.documentFolders.listFolders` → `Array<{ _id, userId, name, createdAt, updatedAt, resumeCount: number, coverLetterCount: number }>`, sorted by name
  - `api.documentFolders.createFolder({ name: string })` → `Id<"documentFolders">`
  - `api.documentFolders.renameFolder({ folderId: Id<"documentFolders">, name: string })` → `void`
  - `api.documentFolders.deleteFolder({ folderId: Id<"documentFolders"> })` → `void`
  - `api.documentFolders.moveDocuments({ items: Array<{ id: string, type: "resume" | "cover-letter" }>, folderId: Id<"documentFolders"> | null })` → `{ moved: number }`
  - `api.documents.toggleFavorite({ documentId: string, documentType: "resume" | "cover-letter" })` → `{ isFavorite: boolean }`

- [ ] **Step 1: Add the schema changes**

In `convex/schema.ts`, add these two fields to the `resumes` table definition, directly after the existing `tags` line:

```ts
    // Organization: at most one folder per document (see documentFolders).
    folderId: v.optional(v.id("documentFolders")),
    isFavorite: v.optional(v.boolean()),
```

Add the identical two lines to the `coverLetters` table definition, also after its `tags` line.

Then add the new table to the same `documentsTables` object, after `coverLetters`:

```ts
  documentFolders: defineTable({
    userId: v.string(),
    name: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),
```

Both new document fields are optional, so existing rows need no backfill.

- [ ] **Step 2: Create the folder backend**

Create `convex/documentFolders.ts`:

```ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

const MAX_FOLDER_NAME_LENGTH = 60;

function normalizeName(raw: string): string {
  const name = raw.trim().slice(0, MAX_FOLDER_NAME_LENGTH);
  if (!name) throw new Error("Folder name cannot be empty");
  return name;
}

export const listFolders = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const folders = await ctx.db
      .query("documentFolders")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const [resumes, coverLetters] = await Promise.all([
      ctx.db
        .query("resumes")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("coverLetters")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
    ]);

    return folders
      .map((folder) => ({
        ...folder,
        resumeCount: resumes.filter((r) => r.folderId === folder._id).length,
        coverLetterCount: coverLetters.filter((c) => c.folderId === folder._id)
          .length,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const createFolder = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const now = Date.now();
    return await ctx.db.insert("documentFolders", {
      userId,
      name: normalizeName(name),
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const renameFolder = mutation({
  args: { folderId: v.id("documentFolders"), name: v.string() },
  handler: async (ctx, { folderId, name }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const folder = await ctx.db.get(folderId);
    if (!folder || folder.userId !== userId) {
      throw new Error("Folder not found or access denied");
    }

    await ctx.db.patch(folderId, {
      name: normalizeName(name),
      updatedAt: Date.now(),
    });
  },
});

/**
 * Deletes the folder and frees its members. Documents are NEVER deleted here —
 * they become loose. Members are cleared before the folder row is removed, so a
 * failure mid-way leaves the folder intact rather than orphaning documents.
 */
export const deleteFolder = mutation({
  args: { folderId: v.id("documentFolders") },
  handler: async (ctx, { folderId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const folder = await ctx.db.get(folderId);
    if (!folder || folder.userId !== userId) {
      throw new Error("Folder not found or access denied");
    }

    const [resumes, coverLetters] = await Promise.all([
      ctx.db
        .query("resumes")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("coverLetters")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
    ]);

    for (const resume of resumes) {
      if (resume.folderId === folderId) {
        await ctx.db.patch(resume._id, { folderId: undefined });
      }
    }
    for (const coverLetter of coverLetters) {
      if (coverLetter.folderId === folderId) {
        await ctx.db.patch(coverLetter._id, { folderId: undefined });
      }
    }

    await ctx.db.delete(folderId);
  },
});

/**
 * Files documents into a folder, or out of one when `folderId` is null.
 * Backs all three move paths (drag, per-card menu, multi-select batch).
 *
 * Deliberately does not touch `updatedAt` — that field is the tie-breaker in
 * sortDocuments, and filing something should not reorder the grid.
 */
export const moveDocuments = mutation({
  args: {
    items: v.array(
      v.object({
        id: v.string(),
        type: v.union(v.literal("resume"), v.literal("cover-letter")),
      })
    ),
    folderId: v.union(v.id("documentFolders"), v.null()),
  },
  handler: async (ctx, { items, folderId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    if (folderId !== null) {
      const folder = await ctx.db.get(folderId);
      if (!folder || folder.userId !== userId) {
        throw new Error("Folder not found or access denied");
      }
    }

    const nextFolderId = folderId ?? undefined;
    let moved = 0;

    for (const item of items) {
      if (item.type === "resume") {
        const id = ctx.db.normalizeId("resumes", item.id);
        if (!id) continue;
        const doc = await ctx.db.get(id);
        if (!doc || doc.userId !== userId) continue;
        await ctx.db.patch(id, { folderId: nextFolderId });
        moved++;
      } else {
        const id = ctx.db.normalizeId("coverLetters", item.id);
        if (!id) continue;
        const doc = await ctx.db.get(id);
        if (!doc || doc.userId !== userId) continue;
        await ctx.db.patch(id, { folderId: nextFolderId });
        moved++;
      }
    }

    return { moved };
  },
});
```

- [ ] **Step 3: Add `toggleFavorite`**

In `convex/documents.ts`, immediately after the `setBaseResume` mutation (which closes at line 420), add:

```ts
/**
 * Flips a document's favorite flag. Favorites sort after the base resume and
 * before regular documents (see lib/documents/sortDocuments.ts).
 *
 * `isFavorite` is intentionally separate from `isActive`: `isActive` is the base
 * resume the job-lead email agent tailors from, and any number of documents may
 * be favorited while exactly one resume is the base.
 *
 * Does not touch `updatedAt` — that field is the sort tie-breaker.
 */
export const toggleFavorite = mutation({
  args: {
    documentId: v.string(),
    documentType: v.union(v.literal("resume"), v.literal("cover-letter")),
  },
  handler: async (ctx, { documentId, documentType }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    if (documentType === "resume") {
      const id = ctx.db.normalizeId("resumes", documentId);
      if (!id) throw new Error("Resume not found or access denied");
      const doc = await ctx.db.get(id);
      if (!doc || doc.userId !== userId) {
        throw new Error("Resume not found or access denied");
      }
      const isFavorite = !(doc.isFavorite ?? false);
      await ctx.db.patch(id, { isFavorite });
      return { isFavorite };
    }

    const id = ctx.db.normalizeId("coverLetters", documentId);
    if (!id) throw new Error("Cover letter not found or access denied");
    const doc = await ctx.db.get(id);
    if (!doc || doc.userId !== userId) {
      throw new Error("Cover letter not found or access denied");
    }
    const isFavorite = !(doc.isFavorite ?? false);
    await ctx.db.patch(id, { isFavorite });
    return { isFavorite };
  },
});
```

- [ ] **Step 4: Push the schema and regenerate types**

Run: `npx convex dev --once`
Expected: schema pushes cleanly, `convex/_generated/api.d.ts` now includes `documentFolders`.

If it reports a schema validation failure against existing documents, stop and report it rather than deleting data — both new fields are optional, so a failure means something unexpected is in the table.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add convex/schema.ts convex/documentFolders.ts convex/documents.ts convex/_generated
git commit -m "feat(documents): add documentFolders table and favorite flag

New documentFolders table plus optional folderId and isFavorite on both
resumes and coverLetters. Deleting a folder frees its members rather than
deleting them. Neither move nor favorite touches updatedAt, which is the
sort tie-breaker."
```

Note: `convex/_generated` is committed in this repo. Leaving regenerated types out of the commit has broken the Vercel build before.

---

### Task 3: Favorites in the grid

Wires Task 1's ordering and Task 2's `toggleFavorite` into the documents form. Deliverable: favoriting works end to end. No folders yet.

**Files:**
- Modify: `app/jk-components/jk-chatwindow-components/jkChatWindow-DocumentsForm.tsx`
  - imports at :12 and :24
  - `baseResumeId` block at :604-613
  - in-place sort at :632-639
  - card container `className` at :1181-1187
  - preview thumbnail block at :1190-1219

**Interfaces:**
- Consumes: `resolveBaseResumeId`, `sortDocuments` from `@/lib/documents/sortDocuments`; `api.documents.toggleFavorite`
- Produces: `orderedDocuments` — the array the grid maps over, replacing `filteredDocuments`

- [ ] **Step 1: Add imports**

Add `Star` to the existing lucide-react import at line 12, and add after line 24:

```ts
import { resolveBaseResumeId, sortDocuments } from "@/lib/documents/sortDocuments";
```

- [ ] **Step 2: Replace the inline base-resume derivation**

Delete the entire IIFE at lines 604-613 (`const baseResumeId = (() => { ... })();`) including its preceding comment block, and replace with:

```ts
    // The base resume is the one the email agent tailors from for job leads
    // (resumes.isActive === true). Ordering logic lives in lib/documents/sortDocuments.ts.
    const baseResumeId = resolveBaseResumeId(allDocuments);
```

- [ ] **Step 3: Replace the in-place sort**

Delete the `if (baseResumeId) { filteredDocuments.sort(...) }` block at lines 632-639 and replace with:

```ts
    // Base resume → favorites → regulars.
    const orderedDocuments = sortDocuments(filteredDocuments, baseResumeId);
```

Then change the grid's map at line 1128 from `filteredDocuments.map(` to `orderedDocuments.map(`.

Leave the other three `filteredDocuments` references alone — the `length === 0` empty-state check at :1118 and the two Select All expressions at :1079-1080 are all order-independent.

- [ ] **Step 4: Add the favorite flag and mutation**

Add near the other mutations (beside `setBaseResume` at line 114):

```ts
    const toggleFavorite = useMutation(api.documents.toggleFavorite);
```

Inside the `orderedDocuments.map` callback, next to the existing `isBaseResume` line at :1164, add:

```ts
                        const isFavorite = Boolean(resume?.isFavorite);
```

- [ ] **Step 5: Style the favorited card**

In the card container `cn(...)` at :1181-1187, add one entry between the `selectionMode && isSelectedForBulk` line and the `isBaseResume` line:

```ts
                                    // Favorite: blue border, but base resume still wins
                                    isFavorite && !isBaseResume && "border-blue-500 border-2",
```

Order matters — `isBaseResume` must stay last so the amber treatment continues to win.

- [ ] **Step 6: Add the star toggle**

Inside the preview thumbnail container (the `div` opening at :1190), add as the last child, after the job-count badge block that closes at :1218:

```tsx
                                    {/* Favorite toggle — bottom-right so it clears the
                                        type badge (top-right) and job count (top-left) */}
                                    <button
                                        type="button"
                                        aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
                                        aria-pressed={isFavorite}
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            void toggleFavorite({
                                                documentId: resumeId,
                                                documentType,
                                            }).catch(() => {
                                                toast.error("Could not update favorite. Please try again.");
                                            });
                                        }}
                                        className="absolute bottom-2 right-2 z-10 rounded-full bg-white/90 p-1.5 shadow-sm transition-colors hover:bg-white"
                                    >
                                        <Star
                                            className={cn(
                                                "h-3.5 w-3.5",
                                                isFavorite
                                                    ? "fill-blue-500 text-blue-500"
                                                    : "text-muted-foreground"
                                            )}
                                        />
                                    </button>
```

- [ ] **Step 7: Typecheck and test**

Run: `npx tsc --noEmit && npm test`
Expected: no type errors; all vitest tests pass

- [ ] **Step 8: Verify in the running app**

Run: `npm run dev`, open My Documents.
Expected: every card shows an outline star bottom-right on its preview. Clicking one fills it blue, gives the card a blue border, and the card jumps to just after the base resume. Clicking the star does not open the document. The base resume keeps its amber border even when favorited.

- [ ] **Step 9: Commit**

```bash
git add app/jk-components/jk-chatwindow-components/jkChatWindow-DocumentsForm.tsx
git commit -m "feat(documents): favorite documents and sort them after the base resume

Star toggle on each card preview. Ordering now comes from the tested
sortDocuments module instead of an in-place sort."
```

---

### Task 4: Folder cards, folder row, and navigation

Deliverable: folders can be created, renamed, deleted, and opened. Moving documents in comes in Task 5.

**Files:**
- Create: `app/jk-components/jk-documents/jkDocumentFolderCard.tsx`
- Create: `app/jk-components/jk-documents/jkFolderBreadcrumb.tsx`
- Modify: `app/jk-components/jk-chatwindow-components/jkChatWindow-DocumentsForm.tsx`

**Interfaces:**
- Consumes: `api.documentFolders.listFolders` / `createFolder` / `renameFolder` / `deleteFolder`
- Produces:
  - `type JkFolder = { _id: Id<"documentFolders">; name: string; resumeCount: number; coverLetterCount: number }`
  - `JkDocumentFolderCard` props: `{ folder: JkFolder; count: number; onOpen: () => void; onRename: (name: string) => void; onDelete: () => void; onDropDocument?: (payload: { id: string; type: "resume" | "cover-letter" }) => void }`
  - `JkFolderBreadcrumb` props: `{ folderName: string; onBack: () => void; onDropDocument?: (payload: { id: string; type: "resume" | "cover-letter" }) => void }`
  - `DRAG_MIME = "application/x-jk-document"` exported from `jkDocumentFolderCard.tsx` and reused in Task 5

`onDropDocument` is optional in both components and stays unused until Task 5.

- [ ] **Step 1: Create the folder card**

Create `app/jk-components/jk-documents/jkDocumentFolderCard.tsx`:

```tsx
'use client'

import { useState } from "react";
import { motion } from "framer-motion";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import JkConfirmDelete from "../jkConfirmDelete";
import { Id } from "@/convex/_generated/dataModel";

/** Payload key for dragging a document card onto a folder. */
export const DRAG_MIME = "application/x-jk-document";

export type JkDraggedDocument = {
  id: string;
  type: "resume" | "cover-letter";
};

export type JkFolder = {
  _id: Id<"documentFolders">;
  name: string;
  resumeCount: number;
  coverLetterCount: number;
};

/**
 * Blue manila folder. Deliberately a sibling of the sticky notes in
 * jkChatWindow-ResourcesMode.tsx — same color-object shape, same hover spring —
 * but with no index rotation, because a row of filing folders reads better flat
 * and keeps its labels legible.
 */
const folderColor = {
  bg: '#93C5FD',                    // blue-300
  border: '#3B82F6',                // blue-500
  shadow: 'rgba(59, 130, 246, 0.3)',
};

export default function JkDocumentFolderCard({
  folder,
  count,
  onOpen,
  onRename,
  onDelete,
  onDropDocument,
}: {
  folder: JkFolder;
  count: number;
  onOpen: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  onDropDocument?: (payload: JkDraggedDocument) => void;
}) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [draftName, setDraftName] = useState(folder.name);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDropTarget, setIsDropTarget] = useState(false);

  const commitRename = () => {
    const next = draftName.trim();
    if (next && next !== folder.name) onRename(next);
    setIsRenaming(false);
  };

  return (
    <motion.div
      layout
      whileHover={{ scale: 1.05 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className="relative"
      onDragOver={(event) => {
        if (!onDropDocument) return;
        event.preventDefault();
        setIsDropTarget(true);
      }}
      onDragLeave={() => setIsDropTarget(false)}
      onDrop={(event) => {
        setIsDropTarget(false);
        if (!onDropDocument) return;
        event.preventDefault();
        try {
          const raw = event.dataTransfer.getData(DRAG_MIME);
          if (!raw) return;
          const payload = JSON.parse(raw) as JkDraggedDocument;
          if (!payload?.id || !payload?.type) return;
          onDropDocument(payload);
        } catch {
          // A drop from outside the app is a no-op, not an error.
        }
      }}
    >
      {/* Tab */}
      <div
        className="h-3.5 w-2/5 rounded-t-md"
        style={{
          backgroundColor: folderColor.bg,
          border: `1px solid ${folderColor.border}`,
          borderBottom: 'none',
        }}
      />
      {/* Body */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          if (!isRenaming && !showDeleteConfirm) onOpen();
        }}
        onKeyDown={(event) => {
          if (isRenaming || showDeleteConfirm) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onOpen();
          }
        }}
        className={cn(
          "flex min-h-[104px] cursor-pointer flex-col justify-between rounded-b-xl rounded-tr-xl p-4 text-black transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600",
          isDropTarget && "ring-4 ring-blue-600/40"
        )}
        style={{
          backgroundColor: folderColor.bg,
          border: `1px solid ${folderColor.border}`,
          boxShadow: `0 4px 12px ${folderColor.shadow}, 0 2px 4px rgba(0,0,0,0.1)`,
        }}
      >
        <div className="flex items-start justify-between gap-2">
          {isRenaming ? (
            <Input
              autoFocus
              value={draftName}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => setDraftName(event.target.value)}
              onBlur={commitRename}
              onKeyDown={(event) => {
                event.stopPropagation();
                if (event.key === "Enter") commitRename();
                if (event.key === "Escape") {
                  setDraftName(folder.name);
                  setIsRenaming(false);
                }
              }}
              className="h-8 bg-white/80 text-black"
            />
          ) : (
            <p className="min-w-0 flex-1 truncate text-sm font-semibold">
              {folder.name}
            </p>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-black/70 hover:bg-black/10 hover:text-black"
                onClick={(event) => event.stopPropagation()}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              onClick={(event) => event.stopPropagation()}
            >
              <DropdownMenuItem
                onClick={(event) => {
                  event.stopPropagation();
                  setDraftName(folder.name);
                  setIsRenaming(true);
                }}
              >
                <Pencil className="h-4 w-4" />
                <span>Rename</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={(event) => {
                  event.stopPropagation();
                  setShowDeleteConfirm(true);
                }}
              >
                <Trash2 className="h-4 w-4" />
                <span>Delete folder</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {showDeleteConfirm ? (
          <div className="mt-2" onClick={(event) => event.stopPropagation()}>
            <JkConfirmDelete
              message={`Delete "${folder.name}"? Its documents will be moved out, not deleted.`}
              onConfirm={() => {
                setShowDeleteConfirm(false);
                onDelete();
              }}
              onCancel={() => setShowDeleteConfirm(false)}
            />
          </div>
        ) : (
          <p className="mt-2 text-xs text-black/70">
            {count} document{count === 1 ? '' : 's'}
          </p>
        )}
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 2: Create the breadcrumb**

Create `app/jk-components/jk-documents/jkFolderBreadcrumb.tsx`:

```tsx
'use client'

import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { DRAG_MIME, type JkDraggedDocument } from "./jkDocumentFolderCard";

/**
 * "← All documents / <folder>" row shown while a folder is open. Doubles as a
 * drop target so a card can be dragged back out of the folder.
 */
export default function JkFolderBreadcrumb({
  folderName,
  onBack,
  onDropDocument,
}: {
  folderName: string;
  onBack: () => void;
  onDropDocument?: (payload: JkDraggedDocument) => void;
}) {
  const [isDropTarget, setIsDropTarget] = useState(false);

  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-lg border border-transparent px-1 py-1 text-sm",
        isDropTarget && "border-blue-500 bg-blue-50 dark:bg-blue-950/40"
      )}
      onDragOver={(event) => {
        if (!onDropDocument) return;
        event.preventDefault();
        setIsDropTarget(true);
      }}
      onDragLeave={() => setIsDropTarget(false)}
      onDrop={(event) => {
        setIsDropTarget(false);
        if (!onDropDocument) return;
        event.preventDefault();
        try {
          const raw = event.dataTransfer.getData(DRAG_MIME);
          if (!raw) return;
          const payload = JSON.parse(raw) as JkDraggedDocument;
          if (!payload?.id || !payload?.type) return;
          onDropDocument(payload);
        } catch {
          // Ignore drops that did not originate from a document card.
        }
      }}
    >
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        All documents
      </button>
      <span className="text-muted-foreground">/</span>
      <span className="truncate font-semibold text-foreground">{folderName}</span>
    </div>
  );
}
```

- [ ] **Step 3: Wire folders into the form — state and queries**

In `jkChatWindow-DocumentsForm.tsx`, add these imports after the `sortDocuments` import added in Task 3:

```ts
import JkDocumentFolderCard, { type JkFolder } from "../jk-documents/jkDocumentFolderCard";
import JkFolderBreadcrumb from "../jk-documents/jkFolderBreadcrumb";
```

Add `FolderPlus` to the lucide-react import at line 12.

Add alongside the other hooks:

```ts
    const folders = useQuery(api.documentFolders.listFolders) ?? [];
    const createFolder = useMutation(api.documentFolders.createFolder);
    const renameFolder = useMutation(api.documentFolders.renameFolder);
    const deleteFolder = useMutation(api.documentFolders.deleteFolder);

    const [openFolderId, setOpenFolderId] = useState<Id<"documentFolders"> | null>(null);
    const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
    const [newFolderName, setNewFolderName] = useState("");

    const openFolder = folders.find((folder) => folder._id === openFolderId) ?? null;
    const knownFolderIds = new Set(folders.map((folder) => String(folder._id)));

    // A folderId pointing at a deleted folder is treated as loose, so an orphaned
    // document is always reachable rather than invisible.
    const isLoose = (doc: any) =>
        !doc?.folderId || !knownFolderIds.has(String(doc.folderId));
```

If `openFolderId` is set but `openFolder` resolves to `null` (the folder was deleted), reset it:

```ts
    useEffect(() => {
        if (openFolderId && !openFolder) setOpenFolderId(null);
    }, [openFolderId, openFolder]);
```

- [ ] **Step 4: Apply the view rules to filtering**

The existing `filteredDocuments` filter at :616-630 already handles `typeFilter` and `searchTerm`. Add a folder-scope clause to it, immediately after the `typeFilter` check and before the search check:

```ts
        // Folder scope. Search overrides folders entirely: when the user is
        // searching, every document is in scope regardless of where it is filed,
        // because the flat list being unsearchable is the problem folders solve.
        const isSearching = searchTerm.trim().length > 0;
        if (!isSearching) {
            if (openFolderId) {
                if (String(doc?.folderId ?? "") !== String(openFolderId)) return false;
            } else if (!isLoose(doc)) {
                return false;
            }
        }
```

- [ ] **Step 5: Render the folder row and breadcrumb**

Directly above the documents grid (the block starting at :1118 with `{filteredDocuments.length === 0 ? ...`), insert:

```tsx
            {searchTerm.trim().length === 0 && openFolder && (
                <JkFolderBreadcrumb
                    folderName={openFolder.name}
                    onBack={() => setOpenFolderId(null)}
                />
            )}

            {searchTerm.trim().length === 0 && !openFolderId && (
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Folders
                        </h2>
                        <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={() => {
                                setNewFolderName("");
                                setShowNewFolderDialog(true);
                            }}
                        >
                            <FolderPlus className="h-4 w-4" />
                            New folder
                        </Button>
                    </div>
                    {folders.length > 0 && (
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                            {folders.map((folder: JkFolder) => (
                                <JkDocumentFolderCard
                                    key={String(folder._id)}
                                    folder={folder}
                                    count={
                                        typeFilter === "resume"
                                            ? folder.resumeCount
                                            : typeFilter === "cover-letter"
                                              ? folder.coverLetterCount
                                              : folder.resumeCount + folder.coverLetterCount
                                    }
                                    onOpen={() => setOpenFolderId(folder._id)}
                                    onRename={(name) => {
                                        void renameFolder({ folderId: folder._id, name })
                                            .catch(() => toast.error("Could not rename folder."));
                                    }}
                                    onDelete={() => {
                                        void deleteFolder({ folderId: folder._id })
                                            .then(() => toast.success(`Deleted "${folder.name}". Its documents were moved out.`))
                                            .catch(() => toast.error("Could not delete folder."));
                                    }}
                                />
                            ))}
                        </div>
                    )}
                    <div className="border-b border-border" />
                </div>
            )}

            {searchTerm.trim().length > 0 && folders.length > 0 && (
                <p className="text-xs text-muted-foreground">
                    Searching across all folders.
                </p>
            )}
```

- [ ] **Step 6: Add the new-folder dialog**

Add near the existing upload `Dialog`, inside the top-level returned fragment:

```tsx
            <Dialog
                open={showNewFolderDialog}
                onOpenChange={(open) => {
                    if (!open) {
                        setShowNewFolderDialog(false);
                        setNewFolderName("");
                    }
                }}
            >
                <DialogContent className="sm:max-w-[420px]">
                    <DialogHeader>
                        <DialogTitle>New folder</DialogTitle>
                        <DialogDescription>
                            Group your documents. A document can live in one folder at a time.
                        </DialogDescription>
                    </DialogHeader>
                    <Input
                        autoFocus
                        value={newFolderName}
                        onChange={(event) => setNewFolderName(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === "Enter" && newFolderName.trim()) {
                                event.preventDefault();
                                void createFolder({ name: newFolderName })
                                    .then(() => {
                                        setShowNewFolderDialog(false);
                                        setNewFolderName("");
                                    })
                                    .catch(() => toast.error("Could not create folder."));
                            }
                        }}
                        placeholder="e.g., Design roles"
                    />
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setShowNewFolderDialog(false);
                                setNewFolderName("");
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            disabled={!newFolderName.trim()}
                            onClick={() => {
                                void createFolder({ name: newFolderName })
                                    .then(() => {
                                        setShowNewFolderDialog(false);
                                        setNewFolderName("");
                                    })
                                    .catch(() => toast.error("Could not create folder."));
                            }}
                        >
                            Create folder
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
```

Note: the `!hasDocuments` early return at :662 renders before this. That is acceptable — with zero documents there is nothing to file. Do not duplicate the folder UI into the empty state.

- [ ] **Step 7: Typecheck and test**

Run: `npx tsc --noEmit && npm test`
Expected: no type errors; all tests pass

- [ ] **Step 8: Verify in the running app**

Run: `npm run dev`, open My Documents.
Expected: a "Folders" heading with a "New folder" button above the document grid. Creating a folder shows a blue folder card with a tab, reading "0 documents". Hover scales it. `⋮` → Rename edits in place; `⋮` → Delete folder asks for confirmation and says documents will be moved out. Clicking a folder shows the breadcrumb and an empty grid; "All documents" goes back. Typing in search hides the folder row and shows "Searching across all folders."

- [ ] **Step 9: Commit**

```bash
git add app/jk-components/jk-documents app/jk-components/jk-chatwindow-components/jkChatWindow-DocumentsForm.tsx
git commit -m "feat(documents): blue folder cards with open, rename, and delete

Folder row above the grid, breadcrumb navigation into a folder, and a
create dialog. Search deliberately overrides folder scope. Documents with
a stale folderId fall back to loose so they are never hidden."
```

---

### Task 5: Filing documents into folders

The three move paths, all calling `moveDocuments`.

**Files:**
- Create: `app/jk-components/jk-documents/jkMoveToFolderMenu.tsx`
- Modify: `app/jk-components/jk-chatwindow-components/jkChatWindow-DocumentsForm.tsx`

**Interfaces:**
- Consumes: `api.documentFolders.moveDocuments`; `DRAG_MIME`, `JkDraggedDocument`, `JkFolder` from `jkDocumentFolderCard.tsx`
- Produces: `JkMoveToFolderMenu` props: `{ folders: JkFolder[]; currentFolderId?: string | null; onMove: (folderId: Id<"documentFolders"> | null) => void; onCreateAndMove: (name: string) => void }`

- [ ] **Step 1: Create the folder picker**

Create `app/jk-components/jk-documents/jkMoveToFolderMenu.tsx`:

```tsx
'use client'

import { useState } from "react";
import { Folder, FolderMinus, FolderPlus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Id } from "@/convex/_generated/dataModel";
import type { JkFolder } from "./jkDocumentFolderCard";

/**
 * Folder picker shared by the per-card ⋮ menu and the multi-select toolbar.
 * Renders as a plain list so it can sit inside a dropdown or a popover.
 */
export default function JkMoveToFolderMenu({
  folders,
  currentFolderId,
  onMove,
  onCreateAndMove,
}: {
  folders: JkFolder[];
  currentFolderId?: string | null;
  onMove: (folderId: Id<"documentFolders"> | null) => void;
  onCreateAndMove: (name: string) => void;
}) {
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState("");

  return (
    <div className="min-w-[220px] space-y-1 p-1">
      {folders.length === 0 && !isCreating && (
        <p className="px-2 py-1.5 text-xs text-muted-foreground">
          No folders yet.
        </p>
      )}

      {folders.map((folder) => {
        const isCurrent = String(folder._id) === String(currentFolderId ?? "");
        return (
          <button
            key={String(folder._id)}
            type="button"
            disabled={isCurrent}
            onClick={() => onMove(folder._id)}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted disabled:opacity-50"
          >
            <Folder className="h-4 w-4 text-blue-500" />
            <span className="min-w-0 flex-1 truncate">{folder.name}</span>
            {isCurrent && (
              <span className="text-[10px] text-muted-foreground">current</span>
            )}
          </button>
        );
      })}

      {currentFolderId && (
        <button
          type="button"
          onClick={() => onMove(null)}
          className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted"
        >
          <FolderMinus className="h-4 w-4" />
          Remove from folder
        </button>
      )}

      {isCreating ? (
        <div className="flex gap-1 p-1">
          <Input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && name.trim()) {
                event.preventDefault();
                onCreateAndMove(name);
                setName("");
                setIsCreating(false);
              }
              if (event.key === "Escape") {
                setName("");
                setIsCreating(false);
              }
            }}
            placeholder="Folder name"
            className="h-8"
          />
          <Button
            size="sm"
            disabled={!name.trim()}
            onClick={() => {
              onCreateAndMove(name);
              setName("");
              setIsCreating(false);
            }}
          >
            Add
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsCreating(true)}
          className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted"
        >
          <FolderPlus className="h-4 w-4" />
          New folder…
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add the shared move handler to the form**

In `jkChatWindow-DocumentsForm.tsx`, add the import:

```ts
import JkMoveToFolderMenu from "../jk-documents/jkMoveToFolderMenu";
import { DRAG_MIME, type JkDraggedDocument } from "../jk-documents/jkDocumentFolderCard";
```

Add the mutation and one handler that every path funnels through:

```ts
    const moveDocuments = useMutation(api.documentFolders.moveDocuments);

    const handleMoveDocuments = async (
        items: JkDraggedDocument[],
        folderId: Id<"documentFolders"> | null,
        folderName?: string,
    ) => {
        if (items.length === 0) return;
        try {
            const { moved } = await moveDocuments({ items, folderId });
            if (moved === 0) return;
            toast.success(
                folderId === null
                    ? `Moved ${moved} document${moved === 1 ? '' : 's'} out of the folder`
                    : `Moved ${moved} document${moved === 1 ? '' : 's'} to "${folderName ?? 'folder'}"`
            );
        } catch {
            toast.error("Could not move documents. Please try again.");
        }
    };

    const handleCreateFolderAndMove = async (
        name: string,
        items: JkDraggedDocument[],
    ) => {
        try {
            const folderId = await createFolder({ name });
            await handleMoveDocuments(items, folderId, name.trim());
        } catch {
            toast.error("Could not create folder. Please try again.");
        }
    };
```

- [ ] **Step 3: Wire drop targets on the folder cards and breadcrumb**

Pass `onDropDocument` to `JkDocumentFolderCard` in the folder row added in Task 4:

```tsx
                                    onDropDocument={(payload) => {
                                        void handleMoveDocuments([payload], folder._id, folder.name);
                                    }}
```

And to `JkFolderBreadcrumb`:

```tsx
                    onDropDocument={(payload) => {
                        void handleMoveDocuments([payload], null);
                    }}
```

- [ ] **Step 4: Make document cards draggable**

On the card container `div` at :1168, add these props next to the existing `role`/`tabIndex`:

```tsx
                                draggable={!selectionMode}
                                onDragStart={(event) => {
                                    if (selectionMode) return;
                                    event.dataTransfer.setData(
                                        DRAG_MIME,
                                        JSON.stringify({ id: resumeId, type: documentType })
                                    );
                                    event.dataTransfer.effectAllowed = "move";
                                }}
```

Dragging is off during `selectionMode` so drag and bulk-select never compete.

- [ ] **Step 5: Add "Move to folder" to the per-card menu**

In the card's `DropdownMenuContent`, immediately before the `DropdownMenuSeparator` that precedes Delete, add:

```tsx
                                                        <DropdownMenuSeparator />
                                                        <div className="px-1 py-1">
                                                            <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                                                Move to folder
                                                            </p>
                                                            <JkMoveToFolderMenu
                                                                folders={folders}
                                                                currentFolderId={resume?.folderId ? String(resume.folderId) : null}
                                                                onMove={(folderId) => {
                                                                    const target = folders.find(
                                                                        (f: JkFolder) => String(f._id) === String(folderId)
                                                                    );
                                                                    void handleMoveDocuments(
                                                                        [{ id: resumeId, type: documentType }],
                                                                        folderId,
                                                                        target?.name
                                                                    );
                                                                }}
                                                                onCreateAndMove={(name) => {
                                                                    void handleCreateFolderAndMove(name, [
                                                                        { id: resumeId, type: documentType },
                                                                    ]);
                                                                }}
                                                            />
                                                        </div>
```

- [ ] **Step 6: Add "Move to folder" to the multi-select toolbar**

In the `selectionMode` toolbar at :1071-1103, add between "Delete Selected" and "Cancel":

```tsx
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={selectedResumeIds.length === 0}
                            >
                                Move to folder
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                            <JkMoveToFolderMenu
                                folders={folders}
                                currentFolderId={openFolderId ? String(openFolderId) : null}
                                onMove={(folderId) => {
                                    const target = folders.find(
                                        (f: JkFolder) => String(f._id) === String(folderId)
                                    );
                                    void handleMoveDocuments(
                                        selectedResumeIds.map((id) => ({ id, type: "resume" as const })),
                                        folderId,
                                        target?.name
                                    ).then(() => {
                                        clearResumeSelection();
                                        setSelectionMode(false);
                                    });
                                }}
                                onCreateAndMove={(name) => {
                                    void handleCreateFolderAndMove(
                                        name,
                                        selectedResumeIds.map((id) => ({ id, type: "resume" as const }))
                                    ).then(() => {
                                        clearResumeSelection();
                                        setSelectionMode(false);
                                    });
                                }}
                            />
                        </DropdownMenuContent>
                    </DropdownMenu>
```

Batch move handles resumes only. `selectedResumeIds` is the only selection state the app has — cover letters cannot be multi-selected at all today (see the `documentType === "resume" ? ... : null` checkbox guard at :1301). That is pre-existing and out of scope here. Cover letters remain fully folderable by drag and by the `⋮` menu.

- [ ] **Step 7: Typecheck and test**

Run: `npx tsc --noEmit && npm test`
Expected: no type errors; all tests pass

- [ ] **Step 8: Verify every path in the running app**

Run: `npm run dev`, open My Documents. Confirm each of these:

1. Drag a resume card onto a folder — folder rings blue while hovering, card leaves the loose list, folder count goes up.
2. Open that folder — the resume is there.
3. Drag it onto the "All documents" breadcrumb — it returns to the loose list.
4. `⋮` → Move to folder on a **cover letter** — it files correctly.
5. `⋮` → Move to folder → "New folder…" — creates and files in one step.
6. `⋮` → Remove from folder on a filed document — returns it to loose.
7. Multi-select → pick two resumes → Move to folder — both move, selection mode exits.
8. Dragging is disabled while multi-select is on.
9. Delete a folder holding documents — the folder disappears and its documents are back in the loose list, not gone.
10. Favorites still sort base → favorites → regulars, both at root and inside a folder.

- [ ] **Step 9: Commit**

```bash
git add app/jk-components/jk-documents app/jk-components/jk-chatwindow-components/jkChatWindow-DocumentsForm.tsx
git commit -m "feat(documents): file documents into folders via drag, menu, and batch

All three paths call the same moveDocuments mutation. Batch move covers
resumes only, matching the existing selection state; cover letters file
via drag or the per-card menu."
```

---

## Final Verification

- [ ] `npx tsc --noEmit` — clean
- [ ] `npm test` — all pass
- [ ] Do **not** run `npm run lint` (broken repo-wide, see Global Constraints)
- [ ] `npm run build` — succeeds. This has caught real breakage in this repo before: a root `tsconfig` sweeping unintended directories, and stale committed `convex/_generated` types. Confirm `convex/_generated` changes from Task 2 are committed.
- [ ] Confirm the base resume still shows amber and still sorts first, and that `setBaseResume` from the `⋮` menu still works — `isActive` must be untouched by any of this work.
