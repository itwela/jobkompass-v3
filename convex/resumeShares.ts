import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";

/** Turn sharing on (reusing any existing id) or off. Returns the public URL when on. */
export async function setResumeShared(ctx: MutationCtx, resume: Doc<"resumes">, off?: boolean) {
  if (off) {
    await ctx.db.patch(resume._id, { shareId: undefined });
    return { shared: false as const };
  }
  if (!resume.fileId) throw new Error("Resume has no PDF to share");
  let shareId = resume.shareId;
  if (!shareId) {
    const bytes = crypto.getRandomValues(new Uint8Array(9));
    shareId = Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 12);
    await ctx.db.patch(resume._id, { shareId });
  }
  const base = (process.env.APP_BASE_URL || "https://www.myjobkompass.com").replace(/\/$/, "");
  return { shared: true as const, shareId, url: `${base}/r/${shareId}` };
}

export const shareResume = mutation({
  args: { resumeId: v.id("resumes"), off: v.optional(v.boolean()) },
  handler: async (ctx, { resumeId, off }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const resume = await ctx.db.get(resumeId);
    if (!resume || resume.userId !== userId) throw new Error("Resume not found or access denied");
    return await setResumeShared(ctx, resume, off);
  },
});

/** Public lookup for /r/<shareId>. Only resumes with a shareId are reachable. */
export const getShared = query({
  args: { shareId: v.string() },
  handler: async (ctx, { shareId }) => {
    const resume = await ctx.db
      .query("resumes")
      .withIndex("by_shareId", (q) => q.eq("shareId", shareId))
      .first();
    if (!resume?.fileId) return null;
    const url = await ctx.storage.getUrl(resume.fileId);
    if (!url) return null;
    return { url, fileName: resume.fileName ?? `${resume.name}.pdf` };
  },
});
