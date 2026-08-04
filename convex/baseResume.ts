/**
 * Base-resume assignment rule (shared by every code path that inserts a resume).
 *
 * `isActive === true` marks the ONE base resume: the amber-badged card that sorts
 * first in My Documents (lib/documents/sortDocuments.ts) and the resume the
 * job-lead email agent tailors from (convex/emailAgent/draft.ts).
 *
 * Historically every insert path hard-coded `isActive: true`, so each newly
 * generated or uploaded resume silently stole base status from the user's real
 * master — `resolveBaseResumeId` picks the most recently updated active resume,
 * so the newest one always won. Generated resumes are OUTPUTS, not the master.
 *
 * The rule now: seed if empty, never steal. A new resume becomes the base only
 * when the user has no base yet (so a brand-new account still gets one without
 * any clicks). Once a base exists, only an explicit `setBaseResume` call — the
 * "make base resume" action in the ⋮ menu — can change it.
 *
 * Deliberately NOT used by `saveGeneratedResumeInternal`: that path is the email
 * agent auto-tailoring from an existing base, so a base necessarily already
 * exists and its inserts stay unconditionally inactive.
 */

type ResumeReaderCtx = {
  db: {
    query: (table: "resumes") => any;
  };
};

/**
 * True when `userId` has no base resume yet, meaning the resume about to be
 * inserted should seed it. False when a base already exists — the new resume
 * must be saved inactive so it does not displace the user's master.
 */
export async function shouldSeedBaseResume(
  ctx: ResumeReaderCtx,
  userId: string
): Promise<boolean> {
  const existing = await ctx.db
    .query("resumes")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .collect();

  return !existing.some((r: { isActive?: boolean }) => r.isActive === true);
}
