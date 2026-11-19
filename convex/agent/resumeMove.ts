/**
 * Filing resumes into a folder from the agent API (POST /agent/resumes/move).
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
export type MoveResume = { _id: string; name: string; folderId?: string; isFavorite?: boolean };

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
export type SkipItem = { id: string; name?: string; reason: "favorite" | "not_found" };

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
  if (hasIds && !req.resumeIds!.every((id) => typeof id === "string")) {
    throw new Error(`${INVALID} 'resumeIds' must be an array of strings`);
  }
  const folder = resolveFolder(folders, req.folder);

  const moved: MoveItem[] = [];
  const skipped: SkipItem[] = [];
  const alreadyInFolder: MoveItem[] = [];

  const consider = (r: MoveResume) => {
    if (r.folderId === folder._id) alreadyInFolder.push({ id: r._id, name: r.name });
    else moved.push({ id: r._id, name: r.name });
  };

  if (hasIds) {
    // Only the caller's own resumes are visible; anything else is "not_found".
    const byId = new Map(resumes.map((r) => [r._id, r]));
    for (const id of [...new Set(req.resumeIds!)]) {
      const r = byId.get(id);
      if (!r) skipped.push({ id, reason: "not_found" });
      else consider(r);
    }
  } else {
    for (const r of resumes) {
      if (r.isFavorite) skipped.push({ id: r._id, name: r.name, reason: "favorite" });
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
  const apply = shouldApply(req);
  if (apply) {
    for (const item of plan.moved) await setFolder(item.id, plan.folder.id);
  }
  return {
    dryRun: !apply,
    ...plan,
    ...(apply
      ? {}
      : {
          hint: req.allExceptFavorites
            ? "Dry run: nothing changed. Re-send with confirm: true (CLI: --yes) to move these."
            : "Dry run: nothing changed. Re-send without dryRun to move these.",
        }),
  };
}
