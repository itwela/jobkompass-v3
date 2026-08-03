import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

const MAX_FOLDER_NAME_LENGTH = 60;

function normalizeName(raw: string): string {
  const name = raw.trim().slice(0, MAX_FOLDER_NAME_LENGTH);
  if (!name) throw new Error("Folder name cannot be empty");
  return name;
}

export const listFolders = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const folders = await ctx.db
      .query("documentFolders")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const [resumes, coverLetters] = await Promise.all([
      ctx.db
        .query("resumes")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("coverLetters")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
    ]);

    return folders
      .map((folder) => ({
        ...folder,
        resumeCount: resumes.filter((r) => r.folderId === folder._id).length,
        coverLetterCount: coverLetters.filter((c) => c.folderId === folder._id)
          .length,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const createFolder = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const now = Date.now();
    return await ctx.db.insert("documentFolders", {
      userId,
      name: normalizeName(name),
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const renameFolder = mutation({
  args: { folderId: v.id("documentFolders"), name: v.string() },
  handler: async (ctx, { folderId, name }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const folder = await ctx.db.get(folderId);
    if (!folder || folder.userId !== userId) {
      throw new Error("Folder not found or access denied");
    }

    await ctx.db.patch(folderId, {
      name: normalizeName(name),
      updatedAt: Date.now(),
    });
  },
});

/**
 * Deletes the folder and frees its members. Documents are NEVER deleted here —
 * they become loose. Members are cleared before the folder row is removed, so a
 * failure mid-way leaves the folder intact rather than orphaning documents.
 */
export const deleteFolder = mutation({
  args: { folderId: v.id("documentFolders") },
  handler: async (ctx, { folderId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const folder = await ctx.db.get(folderId);
    if (!folder || folder.userId !== userId) {
      throw new Error("Folder not found or access denied");
    }

    const [resumes, coverLetters] = await Promise.all([
      ctx.db
        .query("resumes")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("coverLetters")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
    ]);

    for (const resume of resumes) {
      if (resume.folderId === folderId) {
        await ctx.db.patch(resume._id, { folderId: undefined });
      }
    }
    for (const coverLetter of coverLetters) {
      if (coverLetter.folderId === folderId) {
        await ctx.db.patch(coverLetter._id, { folderId: undefined });
      }
    }

    await ctx.db.delete(folderId);
  },
});

/**
 * Files documents into a folder, or out of one when `folderId` is null.
 * Backs all three move paths (drag, per-card menu, multi-select batch).
 *
 * Deliberately does not touch `updatedAt` — that field is the tie-breaker in
 * sortDocuments, and filing something should not reorder the grid.
 */
export const moveDocuments = mutation({
  args: {
    items: v.array(
      v.object({
        id: v.string(),
        type: v.union(v.literal("resume"), v.literal("cover-letter")),
      })
    ),
    folderId: v.union(v.id("documentFolders"), v.null()),
  },
  handler: async (ctx, { items, folderId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    if (folderId !== null) {
      const folder = await ctx.db.get(folderId);
      if (!folder || folder.userId !== userId) {
        throw new Error("Folder not found or access denied");
      }
    }

    const nextFolderId = folderId ?? undefined;
    let moved = 0;

    for (const item of items) {
      if (item.type === "resume") {
        const id = ctx.db.normalizeId("resumes", item.id);
        if (!id) continue;
        const doc = await ctx.db.get(id);
        if (!doc || doc.userId !== userId) continue;
        await ctx.db.patch(id, { folderId: nextFolderId });
        moved++;
      } else {
        const id = ctx.db.normalizeId("coverLetters", item.id);
        if (!id) continue;
        const doc = await ctx.db.get(id);
        if (!doc || doc.userId !== userId) continue;
        await ctx.db.patch(id, { folderId: nextFolderId });
        moved++;
      }
    }

    return { moved };
  },
});
