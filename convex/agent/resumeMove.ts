/**
 * Filing resumes (POST /agent/resumes/move) and cover letters
 * (POST /agent/coverletters/move) into a folder from the agent API. Cover
 * letters use the same model via `coverLetters.folderId`.
 *
 * Same storage model as the app (convex/documentFolders.ts → moveDocuments):
 * a resume belongs to at most one folder via `resumes.folderId`. This only
 * ever writes `folderId` — never content, never `updatedAt` (the grid's sort
 * tie-breaker), never deletes. Base and tailored resumes are treated alike,
 * exactly as the app does.
 *
 * Kept free of Convex imports so the planning and safety rules are unit-tested
 * directly; fns.ts supplies the user's rows and the patch function.
 */

export type MoveFolder = { _id: string; name: string };
export type MoveDoc = { _id: string; name: string; folderId?: string };
export type MoveResume = MoveDoc & { isFavorite?: boolean };

export type MoveRequest = {
  /** Folder id or exact name (case-insensitive). */
  folder: string;
  resumeIds?: string[];
  /** Bulk: every resume that is not a favorite (`isFavorite`). */
  allExceptFavorites?: boolean;
  /** true never writes. Bulk moves default to a dry run unless confirm is true. */
  dryRun?: boolean;
  confirm?: boolean;
};

export type MoveItem = { id: string; name: string };
export type SkipItem = { id: string; name?: string; reason: "favorite" | "not_found" | "in_other_folder" };

export type MoveResult = {
  dryRun: boolean;
  folder: { id: string; name: string };
  /** Moved, or on a dry run the ones that WOULD move. */
  moved: MoveItem[];
  skipped: SkipItem[];
  alreadyInFolder: MoveItem[];
  counts: { moved: number; skipped: number; alreadyInFolder: number; total: number };
  hint?: string;
};

/** Errors carry a prefix dispatch.ts maps to a 4xx status. */
export const INVALID = "Invalid request:";
export const AMBIGUOUS = "Ambiguous folder:";

/** Resolves a folder ref against the CALLER's folders only: another user's id is simply "not found". */
export function resolveFolder(folders: MoveFolder[], ref: string): MoveFolder {
  const raw = ref.trim();
  if (!raw) throw new Error(`${INVALID} 'folder' cannot be empty`);
  const byId = folders.find((f) => f._id === raw);
  if (byId) return byId;
  const wanted = raw.toLowerCase();
  const byName = folders.filter((f) => f.name.trim().toLowerCase() === wanted);
  if (byName.length === 1) return byName[0];
  if (byName.length > 1) {
    throw new Error(
      `${AMBIGUOUS} ${byName.length} folders are named '${raw}' (${byName.map((f) => f._id).join(", ")}). Pass the folder id instead.`
    );
  }
  const names = folders.map((f) => `'${f.name}'`).join(", ") || "(none)";
  throw new Error(`Folder '${raw}' not found. Your folders: ${names}. GET /agent/folders lists ids.`);
}

/** The bulk filter: everything except favorites. */
export function nonFavorites<T extends { isFavorite?: boolean }>(resumes: T[]): T[] {
  return resumes.filter((r) => !r.isFavorite);
}

/** Whether this request writes. Bulk is dry-run unless explicitly confirmed. */
export function shouldApply(req: MoveRequest): boolean {
  if (req.dryRun === true) return false;
  if (req.allExceptFavorites) return req.confirm === true;
  return true;
}

export function planResumeMove(
  resumes: MoveResume[],
  folders: MoveFolder[],
  req: MoveRequest
): Omit<MoveResult, "dryRun" | "hint"> {
  const hasIds = Array.isArray(req.resumeIds) && req.resumeIds.length > 0;
  if (hasIds === Boolean(req.allExceptFavorites)) {
    throw new Error(`${INVALID} pass exactly one of 'resumeIds' (non-empty) or 'allExceptFavorites: true'`);
  }
  return planDocumentMove(
    resumes,
    folders,
    req.folder,
    hasIds
      ? { ids: req.resumeIds!, idsParam: "resumeIds" }
      : { skipReason: (r) => (r.isFavorite ? "favorite" : null) }
  );
}

/**
 * Selection for planDocumentMove: explicit ids (unknown ids -> skipped
 * not_found; duplicates collapse), or bulk over every doc, where skipReason
 * returns why to leave a doc alone (null = move it unless already filed there).
 */
export type MoveSelection<T> =
  | { ids: string[]; idsParam: string }
  | { skipReason: (doc: T) => SkipItem["reason"] | null; skipAlreadyInFolderFirst?: boolean };

/**
 * Shared planner for resumes and cover letters. Resolves the folder first (so
 * a bad folder never plans anything), then sorts each selected doc into
 * moved / alreadyInFolder / skipped. `docs` must be the CALLER's only.
 */
export function planDocumentMove<T extends MoveDoc>(
  docs: T[],
  folders: MoveFolder[],
  folderRef: string,
  selection: MoveSelection<T>
): Omit<MoveResult, "dryRun" | "hint"> {
  if ("ids" in selection && !selection.ids.every((id) => typeof id === "string")) {
    throw new Error(`${INVALID} '${selection.idsParam}' must be an array of strings`);
  }
  const folder = resolveFolder(folders, folderRef);

  const moved: MoveItem[] = [];
  const skipped: SkipItem[] = [];
  const alreadyInFolder: MoveItem[] = [];

  const consider = (r: MoveDoc) => {
    if (r.folderId === folder._id) alreadyInFolder.push({ id: r._id, name: r.name });
    else moved.push({ id: r._id, name: r.name });
  };

  if ("ids" in selection) {
    // Only the caller's own docs are visible; anything else is "not_found".
    const byId = new Map(docs.map((r) => [r._id, r]));
    for (const id of [...new Set(selection.ids)]) {
      const r = byId.get(id);
      if (!r) skipped.push({ id, reason: "not_found" });
      else consider(r);
    }
  } else {
    for (const r of docs) {
      const inTarget = selection.skipAlreadyInFolderFirst && r.folderId === folder._id;
      const reason = inTarget ? null : selection.skipReason(r);
      if (reason) skipped.push({ id: r._id, name: r.name, reason });
      else consider(r);
    }
  }

  return {
    folder: { id: folder._id, name: folder.name },
    moved,
    skipped,
    alreadyInFolder,
    counts: {
      moved: moved.length,
      skipped: skipped.length,
      alreadyInFolder: alreadyInFolder.length,
      total: moved.length + skipped.length + alreadyInFolder.length,
    },
  };
}

/** Plans, then (unless dry) patches folderId on each resume to move. */
export async function executeResumeMove(
  resumes: MoveResume[],
  folders: MoveFolder[],
  req: MoveRequest,
  setFolder: (resumeId: string, folderId: string) => Promise<void>
): Promise<MoveResult> {
  const plan = planResumeMove(resumes, folders, req);
  return await applyPlan(plan, shouldApply(req), Boolean(req.allExceptFavorites), setFolder);
}

// ---- cover letters (POST /agent/coverletters/move) ----
// Same storage as resumes: coverLetters.folderId, as written by moveDocuments.

export type CoverLetterMoveRequest = {
  /** Folder id or exact name (case-insensitive). */
  folder: string;
  coverLetterIds?: string[];
  /** Bulk: every cover letter not already in the target folder. */
  all?: boolean;
  /** With all: only cover letters in no folder yet; ones filed elsewhere are skipped (in_other_folder). */
  unfiledOnly?: boolean;
  /** true never writes. Bulk moves default to a dry run unless confirm is true. */
  dryRun?: boolean;
  confirm?: boolean;
};

/** Same rule as resumes: dryRun always wins; bulk (all) needs confirm. */
export function shouldApplyCoverLetterMove(req: CoverLetterMoveRequest): boolean {
  return shouldApply({ folder: req.folder, allExceptFavorites: req.all, dryRun: req.dryRun, confirm: req.confirm });
}

export function planCoverLetterMove(
  coverLetters: MoveDoc[],
  folders: MoveFolder[],
  req: CoverLetterMoveRequest
): Omit<MoveResult, "dryRun" | "hint"> {
  const hasIds = Array.isArray(req.coverLetterIds) && req.coverLetterIds.length > 0;
  if (hasIds === Boolean(req.all)) {
    throw new Error(`${INVALID} pass exactly one of 'coverLetterIds' (non-empty) or 'all: true'`);
  }
  if (req.unfiledOnly && !req.all) {
    throw new Error(`${INVALID} 'unfiledOnly' only applies with 'all: true'`);
  }
  return planDocumentMove(
    coverLetters,
    folders,
    req.folder,
    hasIds
      ? { ids: req.coverLetterIds!, idsParam: "coverLetterIds" }
      : { skipReason: (c) => (req.unfiledOnly && c.folderId ? "in_other_folder" : null), skipAlreadyInFolderFirst: true }
  );
}

/** Plans, then (unless dry) patches folderId on each cover letter to move. */
export async function executeCoverLetterMove(
  coverLetters: MoveDoc[],
  folders: MoveFolder[],
  req: CoverLetterMoveRequest,
  setFolder: (coverLetterId: string, folderId: string) => Promise<void>
): Promise<MoveResult> {
  const plan = planCoverLetterMove(coverLetters, folders, req);
  return await applyPlan(plan, shouldApplyCoverLetterMove(req), Boolean(req.all), setFolder);
}

async function applyPlan(
  plan: Omit<MoveResult, "dryRun" | "hint">,
  apply: boolean,
  bulk: boolean,
  setFolder: (id: string, folderId: string) => Promise<void>
): Promise<MoveResult> {
  if (apply) {
    for (const item of plan.moved) await setFolder(item.id, plan.folder.id);
  }
  return {
    dryRun: !apply,
    ...plan,
    ...(apply
      ? {}
      : {
          hint: bulk
            ? "Dry run: nothing changed. Re-send with confirm: true (CLI: --yes) to move these."
            : "Dry run: nothing changed. Re-send without dryRun to move these.",
        }),
  };
}
