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
