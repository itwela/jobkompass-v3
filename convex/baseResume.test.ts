import { describe, expect, it } from "vitest";
import { shouldSeedBaseResume } from "./baseResume";

type FakeResume = { userId: string; isActive?: boolean };

/**
 * Minimal stand-in for a Convex ctx: `.query("resumes").withIndex(...).collect()`.
 * Applies the by_user index filter the real query would.
 */
function fakeCtx(resumes: FakeResume[]) {
  return {
    db: {
      query: (_table: "resumes") => ({
        withIndex: (_index: string, fn: (q: any) => { userId: string }) => {
          const { userId } = fn({ eq: (_field: string, value: string) => ({ userId: value }) });
          return { collect: async () => resumes.filter((r) => r.userId === userId) };
        },
      }),
    },
  };
}

describe("shouldSeedBaseResume", () => {
  it("seeds when the user has no resumes at all", async () => {
    expect(await shouldSeedBaseResume(fakeCtx([]), "u1")).toBe(true);
  });

  it("seeds when the user has resumes but none is the base", async () => {
    const ctx = fakeCtx([
      { userId: "u1", isActive: false },
      { userId: "u1" }, // legacy row with isActive unset
    ]);
    expect(await shouldSeedBaseResume(ctx, "u1")).toBe(true);
  });

  it("does NOT steal when a base already exists", async () => {
    const ctx = fakeCtx([
      { userId: "u1", isActive: true },
      { userId: "u1", isActive: false },
    ]);
    expect(await shouldSeedBaseResume(ctx, "u1")).toBe(false);
  });

  it("ignores another user's base resume", async () => {
    const ctx = fakeCtx([
      { userId: "u2", isActive: true },
      { userId: "u1", isActive: false },
    ]);
    expect(await shouldSeedBaseResume(ctx, "u1")).toBe(true);
  });

  it("does not treat a truthy non-true value as a base", async () => {
    const ctx = fakeCtx([{ userId: "u1", isActive: undefined }]);
    expect(await shouldSeedBaseResume(ctx, "u1")).toBe(true);
  });
});
