import { describe, expect, it, vi } from "vitest";
import {
  AMBIGUOUS,
  INVALID,
  executeResumeMove,
  nonFavorites,
  planResumeMove,
  resolveFolder,
  shouldApply,
  type MoveFolder,
  type MoveResume,
} from "./resumeMove";

const folders: MoveFolder[] = [
  { _id: "fArchive", name: "archived resumes" },
  { _id: "fWork", name: "Work" },
];

function resumes(): MoveResume[] {
  return [
    { _id: "r1", name: "Base", isFavorite: true },
    { _id: "r2", name: "Tailored Acme" },
    { _id: "r3", name: "Tailored Globex", isFavorite: false, folderId: "fWork" },
    { _id: "r4", name: "Old one", folderId: "fArchive" },
    { _id: "r5", name: "Fav in work", isFavorite: true, folderId: "fWork" },
  ];
}

describe("resolveFolder", () => {
  it("matches an id", () => {
    expect(resolveFolder(folders, "fWork").name).toBe("Work");
  });

  it("matches an exact name case-insensitively, trimming the ref", () => {
    expect(resolveFolder(folders, "  ARCHIVED Resumes ")._id).toBe("fArchive");
  });

  it("does not partial-match", () => {
    expect(() => resolveFolder(folders, "archived")).toThrow(/not found/);
  });

  it("errors on a missing folder and lists the user's folders", () => {
    expect(() => resolveFolder(folders, "Nope")).toThrow(/Folder 'Nope' not found.*'archived resumes', 'Work'/);
  });

  it("errors on an ambiguous name and names the candidate ids", () => {
    const dup = [...folders, { _id: "fWork2", name: "work" }];
    expect(() => resolveFolder(dup, "Work")).toThrow(AMBIGUOUS);
    expect(() => resolveFolder(dup, "Work")).toThrow(/fWork, fWork2/);
    // the id still resolves unambiguously
    expect(resolveFolder(dup, "fWork2").name).toBe("work");
  });

  it("rejects another user's folder: only the caller's folders are searched", () => {
    expect(() => resolveFolder(folders, "fSomeoneElse")).toThrow(/not found/);
  });

  it("rejects an empty ref", () => {
    expect(() => resolveFolder(folders, "  ")).toThrow(INVALID);
  });
});

describe("nonFavorites", () => {
  it("keeps resumes whose isFavorite is false or unset", () => {
    expect(nonFavorites(resumes()).map((r) => r._id)).toEqual(["r2", "r3", "r4"]);
  });
});

describe("shouldApply (dry run is the safe default for bulk)", () => {
  it("bulk without confirm is a dry run, even with dryRun:false", () => {
    expect(shouldApply({ folder: "x", allExceptFavorites: true })).toBe(false);
    expect(shouldApply({ folder: "x", allExceptFavorites: true, dryRun: false })).toBe(false);
    expect(shouldApply({ folder: "x", allExceptFavorites: true, confirm: true })).toBe(true);
  });

  it("dryRun:true always wins", () => {
    expect(shouldApply({ folder: "x", allExceptFavorites: true, confirm: true, dryRun: true })).toBe(false);
    expect(shouldApply({ folder: "x", resumeIds: ["a"], dryRun: true })).toBe(false);
  });

  it("explicit ids apply without confirm", () => {
    expect(shouldApply({ folder: "x", resumeIds: ["a"] })).toBe(true);
  });
});

describe("planResumeMove", () => {
  it("bulk: every non-favorite moves; favorites skipped; already-filed reported", () => {
    const plan = planResumeMove(resumes(), folders, { folder: "archived resumes", allExceptFavorites: true });
    expect(plan.folder).toEqual({ id: "fArchive", name: "archived resumes" });
    expect(plan.moved.map((m) => m.id)).toEqual(["r2", "r3"]);
    expect(plan.alreadyInFolder.map((m) => m.id)).toEqual(["r4"]);
    expect(plan.skipped).toEqual([
      { id: "r1", name: "Base", reason: "favorite" },
      { id: "r5", name: "Fav in work", reason: "favorite" },
    ]);
    expect(plan.counts).toEqual({ moved: 2, skipped: 2, alreadyInFolder: 1, total: 5 });
  });

  it("ids: unknown or other users' ids are skipped as not_found; duplicates collapse; favorites are moved when named", () => {
    const plan = planResumeMove(resumes(), folders, { folder: "fArchive", resumeIds: ["r1", "r2", "r2", "r4", "theirs"] });
    expect(plan.moved.map((m) => m.id)).toEqual(["r1", "r2"]);
    expect(plan.alreadyInFolder.map((m) => m.id)).toEqual(["r4"]);
    expect(plan.skipped).toEqual([{ id: "theirs", reason: "not_found" }]);
    expect(plan.counts.total).toBe(4);
  });

  it("requires exactly one selector", () => {
    expect(() => planResumeMove(resumes(), folders, { folder: "Work" })).toThrow(INVALID);
    expect(() => planResumeMove(resumes(), folders, { folder: "Work", resumeIds: [] })).toThrow(INVALID);
    expect(() => planResumeMove(resumes(), folders, { folder: "Work", resumeIds: ["r2"], allExceptFavorites: true })).toThrow(INVALID);
  });

  it("validates the folder before anything else is decided", () => {
    expect(() => planResumeMove(resumes(), folders, { folder: "missing", allExceptFavorites: true })).toThrow(/not found/);
  });
});

describe("executeResumeMove", () => {
  it("bulk dry run (default) changes nothing and says how to confirm", async () => {
    const setFolder = vi.fn(async () => {});
    const rows = resumes();
    const before = JSON.stringify(rows);
    const out = await executeResumeMove(rows, folders, { folder: "archived resumes", allExceptFavorites: true }, setFolder);
    expect(setFolder).not.toHaveBeenCalled();
    expect(JSON.stringify(rows)).toBe(before);
    expect(out.dryRun).toBe(true);
    expect(out.counts.moved).toBe(2);
    expect(out.hint).toMatch(/confirm: true/);
  });

  it("explicit dryRun on ids changes nothing", async () => {
    const setFolder = vi.fn(async () => {});
    const out = await executeResumeMove(resumes(), folders, { folder: "Work", resumeIds: ["r2"], dryRun: true }, setFolder);
    expect(setFolder).not.toHaveBeenCalled();
    expect(out.dryRun).toBe(true);
  });

  it("confirmed bulk sets only folderId on the planned resumes", async () => {
    const calls: [string, string][] = [];
    const out = await executeResumeMove(resumes(), folders, { folder: "archived resumes", allExceptFavorites: true, confirm: true }, async (id, f) => {
      calls.push([id, f]);
    });
    expect(calls).toEqual([["r2", "fArchive"], ["r3", "fArchive"]]);
    expect(out.dryRun).toBe(false);
    expect(out.hint).toBeUndefined();
  });

  it("errors (ambiguous folder) never write", async () => {
    const setFolder = vi.fn(async () => {});
    const dup = [...folders, { _id: "fWork2", name: "WORK" }];
    await expect(executeResumeMove(resumes(), dup, { folder: "work", resumeIds: ["r2"] }, setFolder)).rejects.toThrow(AMBIGUOUS);
    expect(setFolder).not.toHaveBeenCalled();
  });
});
