import { v } from "convex/values";
import { query } from "./_generated/server";

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
