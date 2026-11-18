/**
 * How many AI documents a user has used this month. Plain module: no Convex imports,
 * so queries, the agent API and tests can all share it.
 *
 * A document is a resume or cover letter with a generated file, created this month.
 * A re-run (a resume rewritten in place after the user answered questions) is a paid
 * generation too, so each one counts as a document.
 */
type Countable = { fileId?: unknown; createdAt: number; rerunsAt?: number[] };

export function documentsUsedSince(resumes: Countable[], coverLetters: Countable[], monthStart: number): number {
  const generated = (docs: Countable[]) => docs.filter((d) => d.fileId && d.createdAt >= monthStart).length;
  const reruns = resumes.reduce((n, r) => n + (r.rerunsAt ?? []).filter((t) => t >= monthStart).length, 0);
  return generated(resumes) + generated(coverLetters) + reruns;
}

/** Keeps the list from growing without bound; only this month's entries ever matter. */
export const MAX_RERUN_STAMPS = 200;
