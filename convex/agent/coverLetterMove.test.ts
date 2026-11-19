import { describe, expect, it, vi } from "vitest";
import {
  AMBIGUOUS,
  INVALID,
  executeCoverLetterMove,
  planCoverLetterMove,
  shouldApplyCoverLetterMove,
  type MoveDoc,
  type MoveFolder,
} from "./resumeMove";

const ARCHIVE = "n97dha19vtncgx7vnjsvrs7ta58brdp1";
const folders: MoveFolder[] = [
  { _id: ARCHIVE, name: "Archive - Cover Letters" },
  { _id: "fWork", name: "Work" },
];

function letters(): MoveDoc[] {
  return [
    { _id: "c1", name: "Acme CL" },
    { _id: "c2", name: "Globex CL" },
    { _id: "c3", name: "Filed in work", folderId: "fWork" },
    { _id: "c4", name: "Already archived", folderId: ARCHIVE },
  ];
}

describe("folder resolution (shared with resumes)", () => {
  it("resolves by id and by exact case-insensitive name", () => {
    expect(planCoverLetterMove(letters(), folders, { folder: ARCHIVE, all: true }).folder.name).toBe("Archive - Cover Letters");
    expect(planCoverLetterMove(letters(), folders, { folder: " archive - cover letters ", all: true }).folder.id).toBe(ARCHIVE);
  });

  it("missing folder is not found; ambiguous name is AMBIGUOUS", () => {
    expect(() => planCoverLetterMove(letters(), folders, { folder: "Archive", all: true })).toThrow(/not found/);
    const dup = [...folders, { _id: "fWork2", name: "WORK" }];
    expect(() => planCoverLetterMove(letters(), dup, { folder: "work", all: true })).toThrow(AMBIGUOUS);
  });

  it("another user's folder id is not found (only the caller's folders are searched)", () => {
    expect(() => planCoverLetterMove(letters(), folders, { folder: "fTheirs", coverLetterIds: ["c1"] })).toThrow(/not found/);
  });
});

describe("selection rules", () => {
  it("requires exactly one of coverLetterIds or all", () => {
    expect(() => planCoverLetterMove(letters(), folders, { folder: ARCHIVE })).toThrow(INVALID);
    expect(() => planCoverLetterMove(letters(), folders, { folder: ARCHIVE, coverLetterIds: [] })).toThrow(INVALID);
    expect(() => planCoverLetterMove(letters(), folders, { folder: ARCHIVE, coverLetterIds: ["c1"], all: true })).toThrow(INVALID);
  });

  it("unfiledOnly requires all", () => {
    expect(() => planCoverLetterMove(letters(), folders, { folder: ARCHIVE, coverLetterIds: ["c1"], unfiledOnly: true })).toThrow(INVALID);
  });

  it("ids: other users' / unknown ids are skipped not_found; duplicates collapse", () => {
    const plan = planCoverLetterMove(letters(), folders, { folder: ARCHIVE, coverLetterIds: ["c1", "c1", "c4", "theirs"] });
    expect(plan.moved).toEqual([{ id: "c1", name: "Acme CL" }]);
    expect(plan.alreadyInFolder).toEqual([{ id: "c4", name: "Already archived" }]);
    expect(plan.skipped).toEqual([{ id: "theirs", reason: "not_found" }]);
    expect(plan.counts).toEqual({ moved: 1, skipped: 1, alreadyInFolder: 1, total: 3 });
  });

  it("all: moves everything not already in the folder, including letters filed elsewhere", () => {
    const plan = planCoverLetterMove(letters(), folders, { folder: ARCHIVE, all: true });
    expect(plan.moved.map((m) => m.id)).toEqual(["c1", "c2", "c3"]);
    expect(plan.alreadyInFolder.map((m) => m.id)).toEqual(["c4"]);
    expect(plan.skipped).toEqual([]);
  });

  it("all + unfiledOnly: only unfiled letters move; filed elsewhere skipped; target-folder ones are alreadyInFolder", () => {
    const plan = planCoverLetterMove(letters(), folders, { folder: ARCHIVE, all: true, unfiledOnly: true });
    expect(plan.moved).toEqual([
      { id: "c1", name: "Acme CL" },
      { id: "c2", name: "Globex CL" },
    ]);
    expect(plan.skipped).toEqual([{ id: "c3", name: "Filed in work", reason: "in_other_folder" }]);
    expect(plan.alreadyInFolder.map((m) => m.id)).toEqual(["c4"]);
    expect(plan.counts).toEqual({ moved: 2, skipped: 1, alreadyInFolder: 1, total: 4 });
  });
});

describe("shouldApplyCoverLetterMove (bulk defaults to dry run)", () => {
  it("bulk needs confirm; dryRun always wins; ids apply directly", () => {
    expect(shouldApplyCoverLetterMove({ folder: "x", all: true })).toBe(false);
    expect(shouldApplyCoverLetterMove({ folder: "x", all: true, dryRun: false })).toBe(false);
    expect(shouldApplyCoverLetterMove({ folder: "x", all: true, confirm: true })).toBe(true);
    expect(shouldApplyCoverLetterMove({ folder: "x", all: true, confirm: true, dryRun: true })).toBe(false);
    expect(shouldApplyCoverLetterMove({ folder: "x", coverLetterIds: ["a"] })).toBe(true);
    expect(shouldApplyCoverLetterMove({ folder: "x", coverLetterIds: ["a"], dryRun: true })).toBe(false);
  });
});

describe("executeCoverLetterMove", () => {
  it("bulk without confirm writes nothing and hints at confirm", async () => {
    const setFolder = vi.fn(async () => {});
    const rows = letters();
    const before = JSON.stringify(rows);
    const out = await executeCoverLetterMove(rows, folders, { folder: ARCHIVE, all: true, unfiledOnly: true }, setFolder);
    expect(setFolder).not.toHaveBeenCalled();
    expect(JSON.stringify(rows)).toBe(before);
    expect(out.dryRun).toBe(true);
    expect(out.counts.moved).toBe(2);
    expect(out.hint).toMatch(/confirm: true/);
  });

  it("explicit ids with dryRun write nothing", async () => {
    const setFolder = vi.fn(async () => {});
    const out = await executeCoverLetterMove(letters(), folders, { folder: ARCHIVE, coverLetterIds: ["c1"], dryRun: true }, setFolder);
    expect(setFolder).not.toHaveBeenCalled();
    expect(out.dryRun).toBe(true);
    expect(out.hint).toMatch(/without dryRun/);
  });

  it("confirmed bulk sets only folderId on the planned letters", async () => {
    const calls: [string, string][] = [];
    const out = await executeCoverLetterMove(letters(), folders, { folder: "Archive - Cover Letters", all: true, unfiledOnly: true, confirm: true }, async (id, f) => {
      calls.push([id, f]);
    });
    expect(calls).toEqual([["c1", ARCHIVE], ["c2", ARCHIVE]]);
    expect(out.dryRun).toBe(false);
    expect(out.hint).toBeUndefined();
  });

  it("a rejected folder never writes", async () => {
    const setFolder = vi.fn(async () => {});
    await expect(executeCoverLetterMove(letters(), folders, { folder: "fTheirs", coverLetterIds: ["c1"] }, setFolder)).rejects.toThrow(/not found/);
    expect(setFolder).not.toHaveBeenCalled();
  });

  it("an ownership failure at write time propagates (fns.ts re-checks each row)", async () => {
    const setFolder = vi.fn(async () => {
      throw new Error("Cover letter or folder not found");
    });
    await expect(executeCoverLetterMove(letters(), folders, { folder: ARCHIVE, coverLetterIds: ["c1"] }, setFolder)).rejects.toThrow(/not found/);
  });
});
