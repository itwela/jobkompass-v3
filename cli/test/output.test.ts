import { describe, expect, it } from "vitest";
import { formatOutput, renderPretty } from "../src/output";

describe("resumes move output", () => {
  const result = {
    dryRun: true,
    folder: { id: "f1", name: "archived resumes" },
    moved: [{ id: "r2", name: "Tailored Acme" }],
    skipped: [{ id: "r1", name: "Base", reason: "favorite" }],
    alreadyInFolder: [],
    counts: { moved: 1, skipped: 1, alreadyInFolder: 0, total: 2 },
    hint: "Dry run: nothing changed. Re-send with confirm: true (CLI: --yes) to move these.",
  };

  it("pretty mode leads with a summary and marks dry runs", () => {
    const out = formatOutput(result, false);
    expect(out.split("\n")[0]).toBe("DRY RUN: would move 1 of 2 resume(s) into 'archived resumes' (f1).");
    expect(out).toContain("r2  Tailored Acme");
    expect(out).toContain("r1  Base  (favorite)");
    expect(out).toContain("--yes");
  });

  it("machine mode is the raw JSON", () => {
    expect(JSON.parse(formatOutput(result, true))).toEqual(result);
  });
});

describe("coverletters move output", () => {
  const result = {
    dryRun: true,
    folder: { id: "f9", name: "Archive - Cover Letters" },
    moved: [{ id: "c1", name: "Acme CL" }],
    skipped: [{ id: "c3", name: "Filed in work", reason: "in_other_folder" }],
    alreadyInFolder: [{ id: "c4", name: "Old" }],
    counts: { moved: 1, skipped: 1, alreadyInFolder: 1, total: 3 },
    hint: "Dry run: nothing changed. Re-send with confirm: true (CLI: --yes) to move these.",
  };

  it("uses the cover letter noun and lists titles", () => {
    const out = formatOutput(result, false, "cover letter");
    expect(out.split("\n")[0]).toBe("DRY RUN: would move 1 of 3 cover letter(s) into 'Archive - Cover Letters' (f9).");
    expect(out).toContain("Already in folder: 1. Skipped: 1.");
    expect(out).toContain("c1  Acme CL");
    expect(out).toContain("c3  Filed in work  (in_other_folder)");
  });

  it("machine mode is the raw JSON", () => {
    expect(JSON.parse(formatOutput(result, true, "cover letter"))).toEqual(result);
  });
});

describe("renderPretty", () => {
  it("renders array of objects as aligned columns", () => {
    const out = renderPretty([
      { name: "rice", calories: 300 },
      { name: "chicken breast", calories: 220 },
    ]);
    expect(out).toContain("name");
    expect(out).toContain("chicken breast");
    expect(out.split("\n").length).toBeGreaterThanOrEqual(3); // header + 2 rows
  });
  it("renders plain object as key: value lines", () => {
    const out = renderPretty({ calories: 2400, protein: 180 });
    expect(out).toContain("calories: 2400");
  });
  it("renders scalars and null", () => {
    expect(renderPretty(null)).toBe("(none)");
    expect(renderPretty("done")).toBe("done");
  });
});

describe("formatOutput notice", () => {
  const data = { id: "r1", template: "jake", notice: "Your plan doesn't include mar; used jake instead. Upgrade to use it." };
  it("keeps notice in JSON mode", () => {
    expect(JSON.parse(formatOutput(data, true)).notice).toBe(data.notice);
  });
  it("prints the notice on its own first line in pretty mode", () => {
    const out = formatOutput(data, false);
    expect(out.split("\n")[0]).toBe(`Notice: ${data.notice}`);
    expect(out).toContain("template: jake");
    expect(out).not.toContain("notice: ");
  });
  it("is unchanged without a notice", () => {
    expect(formatOutput({ a: 1 }, false)).toBe(renderPretty({ a: 1 }));
  });
});
