import { describe, expect, it } from "vitest";
import { documentsUsedSince } from "./documentCount";

const month = 1_000_000;

describe("documentsUsedSince", () => {
  it("counts generated resumes and cover letters created this month", () => {
    const resumes = [
      { fileId: "a", createdAt: month + 1 },
      { fileId: "b", createdAt: month - 1 },
      { createdAt: month + 5 },
    ];
    const letters = [{ fileId: "c", createdAt: month + 2 }];
    expect(documentsUsedSince(resumes, letters, month)).toBe(2);
  });

  it("counts each in-place rewrite this month as a document, even on an older resume", () => {
    const resumes = [
      { fileId: "a", createdAt: month - 10, rerunsAt: [month - 5, month + 3, month + 9] },
      { fileId: "b", createdAt: month + 1, rerunsAt: [month + 4] },
    ];
    expect(documentsUsedSince(resumes, [], month)).toBe(1 + 2 + 1);
  });
});
