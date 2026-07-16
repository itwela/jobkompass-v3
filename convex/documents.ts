import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { Auth } from "convex/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// Resume functions
export const saveResume = mutation({
  args: {
    name: v.string(),
    content: v.any(), // Flexible content - can be any JSON structure
    label: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    template: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    
    const now = Date.now();
    
    return await ctx.db.insert("resumes", {
      userId: userId,
      name: args.name,
      createdAt: now,
      updatedAt: now,
      isActive: args.isActive ?? true,
      content: args.content,
      label: args.label,
      tags: args.tags,
      template: args.template,
    });
  },
});

export const updateResume = mutation({
  args: {
    resumeId: v.id("resumes"),
    name: v.optional(v.string()),
    content: v.optional(v.any()), // Flexible content - can be any JSON structure
    label: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    template: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    // Get the resume to ensure it belongs to the user
    const resume = await ctx.db.get(args.resumeId);
    // Check both new userId format and old tokenIdentifier format for backward compatibility
    if (!resume || (resume.userId !== userId && resume.userId !== identity.tokenIdentifier)) {
      throw new Error("Resume not found or access denied");
    }
    
    const updateData: any = {
      updatedAt: Date.now(),
    };
    
    if (args.name !== undefined) updateData.name = args.name;
    if (args.content !== undefined) updateData.content = args.content;
    if (args.label !== undefined) updateData.label = args.label;
    if (args.tags !== undefined) updateData.tags = args.tags;
    if (args.template !== undefined) updateData.template = args.template;
    if (args.isActive !== undefined) updateData.isActive = args.isActive;
    
    return await ctx.db.patch(args.resumeId, updateData);
  },
});

export const deleteResume = mutation({
  args: {
    resumeId: v.id("resumes"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    // Get the resume to ensure it belongs to the user
    const resume = await ctx.db.get(args.resumeId);
    // Check both new userId format and old tokenIdentifier format for backward compatibility
    if (!resume || (resume.userId !== userId && resume.userId !== identity.tokenIdentifier)) {
      throw new Error("Resume not found or access denied");
    }
    
    // Delete the file from storage if it exists
    if (resume.fileId) {
      await ctx.storage.delete(resume.fileId);
    }
    
    return await ctx.db.delete(args.resumeId);
  },
});

// Migration function - run once to update existing documents from tokenIdentifier to userId
export const migrateUserIds = mutation({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    let totalUpdated = 0;
    
    // Migrate resumes
    const oldResumes = await ctx.db
      .query("resumes")
      .withIndex("by_user", (q) => q.eq("userId", identity.tokenIdentifier))
      .collect();
    
    for (const resume of oldResumes) {
      await ctx.db.patch(resume._id, { userId: userId });
      totalUpdated++;
    }
    
    // Migrate resumeIRs
    const oldResumeIRs = await ctx.db
      .query("resumeIRs")
      .withIndex("by_user", (q) => q.eq("userId", identity.tokenIdentifier))
      .collect();
    
    for (const resumeIR of oldResumeIRs) {
      await ctx.db.patch(resumeIR._id, { userId: userId });
      totalUpdated++;
    }
    
    // Migrate coverLetters
    const oldCoverLetters = await ctx.db
      .query("coverLetters")
      .withIndex("by_user", (q) => q.eq("userId", identity.tokenIdentifier))
      .collect();
    
    for (const coverLetter of oldCoverLetters) {
      await ctx.db.patch(coverLetter._id, { userId: userId });
      totalUpdated++;
    }
    
    // Migrate emailTemplates
    const oldEmailTemplates = await ctx.db
      .query("emailTemplates")
      .withIndex("by_user_and_type", (q) => q.eq("userId", identity.tokenIdentifier))
      .collect();
    
    for (const emailTemplate of oldEmailTemplates) {
      await ctx.db.patch(emailTemplate._id, { userId: userId });
      totalUpdated++;
    }
    
    return { 
      success: true, 
      updated: totalUpdated, 
      message: `Successfully migrated ${totalUpdated} document(s) to new userId format`,
      breakdown: {
        resumes: oldResumes.length,
        resumeIRs: oldResumeIRs.length,
        coverLetters: oldCoverLetters.length,
        emailTemplates: oldEmailTemplates.length,
      }
    };
  },
});

export const listResumes = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    // Get resumes with both new and old userId formats for backward compatibility
    const newFormatResumes = await ctx.db
      .query("resumes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    
    const oldFormatResumes = await ctx.db
      .query("resumes")
      .withIndex("by_user", (q) => q.eq("userId", identity.tokenIdentifier))
      .collect();

    // Combine and deduplicate
    const allResumes = [...newFormatResumes];
    const existingIds = new Set(newFormatResumes.map(r => r._id));
    
    for (const resume of oldFormatResumes) {
      if (!existingIds.has(resume._id)) {
        allResumes.push(resume);
      }
    }

    // Sort by updatedAt descending (most recently updated first)
    return allResumes.sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

export const getResume = query({
  args: {
    resumeId: v.id("resumes"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const resume = await ctx.db.get(args.resumeId);
    // Check both new userId format and old tokenIdentifier format for backward compatibility
    if (!resume || (resume.userId !== userId && resume.userId !== identity.tokenIdentifier)) {
      throw new Error("Resume not found or access denied");
    }
    
    return resume;
  },
});

// Generate upload URL for resume file
export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    return await ctx.storage.generateUploadUrl();
  },
});

// Upload resume file
export const uploadResumeFile = mutation({
  args: {
    name: v.string(),
    fileId: v.id("_storage"),
    fileName: v.string(),
    fileType: v.string(),
    fileSize: v.optional(v.number()),
    label: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    template: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    
    const now = Date.now();
    
    return await ctx.db.insert("resumes", {
      userId: userId,
      name: args.name,
      fileId: args.fileId,
      fileName: args.fileName,
      fileType: args.fileType,
      fileSize: args.fileSize,
      label: args.label,
      tags: args.tags,
      template: args.template,
      createdAt: now,
      updatedAt: now,
      isActive: true,
    });
  },
});

// Save resume with structured content; file is optional (e.g. paste-only import)
export const saveGeneratedResumeWithFile = mutation({
  args: {
    name: v.string(),
    fileId: v.optional(v.id("_storage")),
    fileName: v.optional(v.string()),
    fileSize: v.optional(v.number()),
    content: v.any(), // Structured content (the input used to generate the resume)
    template: v.optional(v.string()),
    label: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    
    const now = Date.now();
    
    return await ctx.db.insert("resumes", {
      userId: userId,
      name: args.name,
      fileId: args.fileId,
      fileName: args.fileName,
      fileType: args.fileId ? "application/pdf" : undefined,
      fileSize: args.fileSize,
      content: args.content,
      template: args.template || 'jake',
      label: args.label,
      tags: args.tags,
      createdAt: now,
      updatedAt: now,
      isActive: true,
    });
  },
});

// Internal counterpart to listResumes for server-side callers (e.g. the email
// agent's poll/draft cron) that have no authenticated user session and must pass
// userId explicitly. Only ever invoked from other trusted Convex code.
export const listResumesInternal = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const resumes = await ctx.db
      .query("resumes")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    return resumes.sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

// Internal counterpart to generateUploadUrl for server-side callers with no
// authenticated user session.
export const generateUploadUrlInternal = internalMutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

// Internal counterpart to saveGeneratedResumeWithFile for server-side callers
// (e.g. the email agent's draft action) that have no authenticated user session
// and must pass userId explicitly, matching the addInternal pattern in convex/jobs.ts.
export const saveGeneratedResumeInternal = internalMutation({
  args: {
    userId: v.string(),
    name: v.string(),
    fileId: v.optional(v.id("_storage")),
    fileName: v.optional(v.string()),
    fileSize: v.optional(v.number()),
    content: v.any(),
    template: v.optional(v.string()),
    label: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const { userId, ...resumeData } = args;
    const now = Date.now();

    return await ctx.db.insert("resumes", {
      userId,
      name: resumeData.name,
      fileId: resumeData.fileId,
      fileName: resumeData.fileName,
      fileType: resumeData.fileId ? "application/pdf" : undefined,
      fileSize: resumeData.fileSize,
      content: resumeData.content,
      template: resumeData.template || 'jake',
      label: resumeData.label,
      tags: resumeData.tags,
      createdAt: now,
      updatedAt: now,
      // Generated/tailored resumes are OUTPUTS, not the master base — leaving them
      // inactive keeps the email agent's `resumes.find(isActive)` base selection stable
      // (it should tailor from the user's one real master, not a prior tailored resume).
      isActive: false,
    });
  },
});

// One-shot: make `resumeId` the user's SOLE active resume (deactivate all others).
// Cleans up the "every resume is active" state so the email agent tailors from one real
// master base. Reusable later for a "Make this my base resume" button.
export const setSoleActiveResume = internalMutation({
  args: { userId: v.string(), resumeId: v.id("resumes") },
  handler: async (ctx, { userId, resumeId }) => {
    const resumes = await ctx.db
      .query("resumes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    let activated = 0;
    let deactivated = 0;
    for (const r of resumes) {
      const shouldBeActive = r._id === resumeId;
      if ((r.isActive ?? false) !== shouldBeActive) {
        await ctx.db.patch(r._id, { isActive: shouldBeActive });
        if (shouldBeActive) activated++;
        else deactivated++;
      }
    }
    return { total: resumes.length, activated, deactivated };
  },
});

// Public: set `resumeId` as the caller's SOLE base resume (the one the email agent
// tailors from for job leads). Auth'd + ownership-checked. Deactivating every other
// resume on each switch also self-heals any lingering "multiple active" state.
export const setBaseResume = mutation({
  args: { resumeId: v.id("resumes") },
  handler: async (ctx, { resumeId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const target = await ctx.db.get(resumeId);
    if (!target || target.userId !== userId) {
      throw new Error("Resume not found or access denied");
    }

    const resumes = await ctx.db
      .query("resumes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const r of resumes) {
      const shouldBeActive = r._id === resumeId;
      if ((r.isActive ?? false) !== shouldBeActive) {
        await ctx.db.patch(r._id, { isActive: shouldBeActive });
      }
    }
    return { resumeId };
  },
});

// Add a certification to a resume's content.certifications (dedupes by name).
export const addCertificationInternal = internalMutation({
  args: {
    resumeId: v.id("resumes"),
    certification: v.object({
      name: v.string(),
      issuer: v.optional(v.string()),
      date: v.optional(v.string()),
      credentialId: v.optional(v.string()),
    }),
  },
  handler: async (ctx, { resumeId, certification }) => {
    const r = await ctx.db.get(resumeId);
    if (!r) throw new Error("Resume not found");
    const content: any = { ...((r as any).content ?? {}) };
    const certs = Array.isArray(content.certifications) ? content.certifications : [];
    if (!certs.some((c: any) => c?.name === certification.name)) certs.push(certification);
    content.certifications = certs;
    await ctx.db.patch(resumeId, { content, updatedAt: Date.now() });
    return { certifications: content.certifications };
  },
});

// Replace resume file with new PDF and update content
export const replaceResumeFile = mutation({
  args: {
    resumeId: v.id("resumes"),
    newFileId: v.id("_storage"),
    fileName: v.string(),
    fileSize: v.number(),
    content: v.any(), // Updated structured content
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    // Get the resume to ensure it belongs to the user
    const resume = await ctx.db.get(args.resumeId);
    if (!resume || (resume.userId !== userId && resume.userId !== identity.tokenIdentifier)) {
      throw new Error("Resume not found or access denied");
    }
    
    // Delete the old file from storage if it exists
    if (resume.fileId) {
      await ctx.storage.delete(resume.fileId);
    }
    
    // Update the resume record with new file and content
    return await ctx.db.patch(args.resumeId, {
      fileId: args.newFileId,
      fileName: args.fileName,
      fileType: 'application/pdf',
      fileSize: args.fileSize,
      content: args.content,
      updatedAt: Date.now(),
    });
  },
});

// Update resume file metadata (label, tags, template)
export const updateResumeFileMetadata = mutation({
  args: {
    resumeId: v.id("resumes"),
    name: v.optional(v.string()),
    label: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    template: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const resume = await ctx.db.get(args.resumeId);
    // Check both new userId format and old tokenIdentifier format for backward compatibility
    if (!resume || (resume.userId !== userId && resume.userId !== identity.tokenIdentifier)) {
      throw new Error("Resume not found or access denied");
    }
    
    const updateData: any = {
      updatedAt: Date.now(),
    };
    
    if (args.name !== undefined) updateData.name = args.name;
    if (args.label !== undefined) updateData.label = args.label;
    if (args.tags !== undefined) updateData.tags = args.tags;
    if (args.template !== undefined) updateData.template = args.template;
    
    return await ctx.db.patch(args.resumeId, updateData);
  },
});

// Get file download URL by resume ID (legacy; prefer fileId-based downloads)
export const getFileUrlByResumeId = query({
  args: {
    fileId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    return await ctx.storage.getUrl(args.fileId);
  },
});

// Get file download URL by file ID (preferred)
export const getFileUrl = query({
  args: {
    fileId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    return await ctx.storage.getUrl(args.fileId);
  },
});

// Get file download URL by file ID (for direct file access)
export const getFileUrlById = query({
  args: {
    fileId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
  
    // Verify the file belongs to a resume owned by the user
    const resume = await ctx.db
      .query("resumes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("fileId"), args.fileId))
      .first();

    return await ctx.storage.getUrl(args.fileId);
  },
});

// Internal counterpart to getFileUrlById for server-side callers (e.g. the email
// agent's send action) that have no authenticated user session. Safe because
// internal functions can't be called externally - same reasoning as the other
// internal wrappers in this file. Returns the resume's file URL and file name so
// the caller can attach it to an outbound email without needing its own auth.
export const getResumeFileInternal = internalQuery({
  args: { resumeId: v.id("resumes") },
  handler: async (ctx, args) => {
    const resume = await ctx.db.get(args.resumeId);
    if (!resume || !resume.fileId) return null;

    const url = await ctx.storage.getUrl(resume.fileId);
    if (!url) return null;

    return { url, fileName: resume.fileName || "resume.pdf" };
  },
});

// Resume IR (Intermediate Representation) functions
export const saveResumeIR = mutation({
  args: {
    name: v.string(),
    ir: v.any(),
    meta: v.optional(v.object({
      template: v.optional(v.string()),
      lastEditedISO: v.optional(v.string()),
      version: v.optional(v.number()),
    })),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const now = Date.now();
    return await ctx.db.insert("resumeIRs", {
      userId: userId,
      name: args.name,
      createdAt: now,
      updatedAt: now,
      ir: args.ir,
      meta: args.meta,
      isActive: args.isActive ?? true,
    });
  },
});

export const updateResumeIR = mutation({
  args: {
    resumeIrId: v.id("resumeIRs"),
    name: v.optional(v.string()),
    ir: v.optional(v.any()),
    meta: v.optional(v.object({
      template: v.optional(v.string()),
      lastEditedISO: v.optional(v.string()),
      version: v.optional(v.number()),
    })),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const doc = await ctx.db.get(args.resumeIrId);
    if (!doc || doc.userId !== userId) {
      throw new Error("Resume IR not found or access denied");
    }
    const updateData: any = { updatedAt: Date.now() };
    if (args.name !== undefined) updateData.name = args.name;
    if (args.ir !== undefined) updateData.ir = args.ir;
    if (args.meta !== undefined) updateData.meta = args.meta;
    if (args.isActive !== undefined) updateData.isActive = args.isActive;
    return await ctx.db.patch(args.resumeIrId, updateData);
  },
});

export const deleteResumeIR = mutation({
  args: { resumeIrId: v.id("resumeIRs") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const doc = await ctx.db.get(args.resumeIrId);
    if (!doc || doc.userId !== userId) {
      throw new Error("Resume IR not found or access denied");
    }
    return await ctx.db.delete(args.resumeIrId);
  },
});

export const listResumeIRs = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db.query("resumeIRs").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
  },
});

export const getResumeIR = query({
  args: { resumeIrId: v.id("resumeIRs") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const doc = await ctx.db.get(args.resumeIrId);
    if (!doc || doc.userId !== userId) {
      throw new Error("Resume IR not found or access denied");
    }
    return doc;
  },
});

// Cover Letter functions
export const saveCoverLetter = mutation({
  args: {
    name: v.string(),
    content: v.object({
      template: v.string(),
      company: v.optional(v.string()),
      position: v.optional(v.string()),
      customizations: v.optional(v.object({
        keyPoints: v.array(v.string()),
        tone: v.string(),
      })),
    }),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    
    const now = Date.now();
    
    return await ctx.db.insert("coverLetters", {
      userId: userId,
      name: args.name,
      createdAt: now,
      updatedAt: now,
      content: args.content,
    });
  },
});

export const updateCoverLetter = mutation({
  args: {
    coverLetterId: v.id("coverLetters"),
    name: v.optional(v.string()),
    content: v.optional(v.any()), // Flexible content - can be any JSON structure
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    
    // Get the cover letter to ensure it belongs to the user
    const coverLetter = await ctx.db.get(args.coverLetterId);
    if (!coverLetter || coverLetter.userId !== userId) {
      throw new Error("Cover letter not found or access denied");
    }
    
    const updateData: any = {
      updatedAt: Date.now(),
    };
    
    if (args.name !== undefined) updateData.name = args.name;
    if (args.content !== undefined) updateData.content = args.content;
    
    return await ctx.db.patch(args.coverLetterId, updateData);
  },
});

export const deleteCoverLetter = mutation({
  args: {
    coverLetterId: v.id("coverLetters"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    
    // Get the cover letter to ensure it belongs to the user
    const coverLetter = await ctx.db.get(args.coverLetterId);
    if (!coverLetter || coverLetter.userId !== userId) {
      throw new Error("Cover letter not found or access denied");
    }
    
    // Delete the file from storage if it exists
    if (coverLetter.fileId) {
      await ctx.storage.delete(coverLetter.fileId);
    }
    
    return await ctx.db.delete(args.coverLetterId);
  },
});

export const listCoverLetters = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    
    const coverLetters = await ctx.db
      .query("coverLetters")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    
    // Sort by updatedAt descending (most recently updated first)
    return coverLetters.sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

// Save generated cover letter with PDF (called by AI tools during generation)
export const saveGeneratedCoverLetterWithFile = mutation({
  args: {
    name: v.string(),
    fileId: v.id("_storage"),
    fileName: v.string(),
    fileSize: v.number(),
    content: v.any(), // Structured content (the input used to generate the cover letter)
    template: v.optional(v.string()),
    label: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    
    const now = Date.now();
    
    // Save cover letter document with all metadata
    return await ctx.db.insert("coverLetters", {
      userId: userId,
      name: args.name,
      fileId: args.fileId,
      fileName: args.fileName,
      fileType: 'application/pdf',
      fileSize: args.fileSize,
      content: args.content,
      template: args.template,
      label: args.label,
      tags: args.tags,
      createdAt: now,
      updatedAt: now,
      isActive: true,
    });
  },
});

// Mark resume as seen
export const markResumeAsSeen = mutation({
  args: {
    resumeId: v.id("resumes"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const resume = await ctx.db.get(args.resumeId);
    if (!resume || (resume.userId !== userId && resume.userId !== identity.tokenIdentifier)) {
      throw new Error("Resume not found or access denied");
    }
    
    await ctx.db.patch(args.resumeId, {
      seenAt: Date.now(),
    });
  },
});

// Mark cover letter as seen
export const markCoverLetterAsSeen = mutation({
  args: {
    coverLetterId: v.id("coverLetters"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    
    const coverLetter = await ctx.db.get(args.coverLetterId);
    if (!coverLetter || coverLetter.userId !== userId) {
      throw new Error("Cover letter not found or access denied");
    }
    
    await ctx.db.patch(args.coverLetterId, {
      seenAt: Date.now(),
    });
  },
});

// Count new documents (resumes + cover letters)
export const countNewDocuments = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return 0;

    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return 0;

    // Get all resumes
    const newFormatResumes = await ctx.db
      .query("resumes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    
    const oldFormatResumes = await ctx.db
      .query("resumes")
      .withIndex("by_user", (q) => q.eq("userId", identity.tokenIdentifier))
      .collect();

    const allResumes = [...newFormatResumes];
    const existingIds = new Set(newFormatResumes.map(r => r._id));
    
    for (const resume of oldFormatResumes) {
      if (!existingIds.has(resume._id)) {
        allResumes.push(resume);
      }
    }

    // Get all cover letters
    const coverLetters = await ctx.db
      .query("coverLetters")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Count items where seenAt is null (never seen)
    const newResumes = allResumes.filter(r => !r.seenAt);

    const newCoverLetters = coverLetters.filter(cl => !cl.seenAt);

    return newResumes.length + newCoverLetters.length;
  },
});

// Get a cover letter with optional file URL
export const getCoverLetter = query({
  args: { coverLetterId: v.id("coverLetters") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    
    const coverLetter = await ctx.db.get(args.coverLetterId);
    if (!coverLetter || coverLetter.userId !== userId) {
      return null;
    }
    
    // Get the file URL if there's a fileId
    let fileUrl = null;
    if (coverLetter.fileId) {
      fileUrl = await ctx.storage.getUrl(coverLetter.fileId);
    }
    
    return {
      ...coverLetter,
      fileUrl,
    };
  },
});

// Replace cover letter file with new PDF and update content
export const replaceCoverLetterFile = mutation({
  args: {
    coverLetterId: v.id("coverLetters"),
    newFileId: v.id("_storage"),
    fileName: v.string(),
    fileSize: v.number(),
    content: v.any(), // Updated structured content
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    
    // Get the cover letter to ensure it belongs to the user
    const coverLetter = await ctx.db.get(args.coverLetterId);
    if (!coverLetter || coverLetter.userId !== userId) {
      throw new Error("Cover letter not found or access denied");
    }
    
    // Delete the old file from storage if it exists
    if (coverLetter.fileId) {
      await ctx.storage.delete(coverLetter.fileId);
    }
    
    // Update the cover letter record with new file and content
    return await ctx.db.patch(args.coverLetterId, {
      fileId: args.newFileId,
      fileName: args.fileName,
      fileType: 'application/pdf',
      fileSize: args.fileSize,
      content: args.content,
      updatedAt: Date.now(),
    });
  },
});

// Update cover letter metadata (label, tags, template)
export const updateCoverLetterMetadata = mutation({
  args: {
    coverLetterId: v.id("coverLetters"),
    name: v.optional(v.string()),
    label: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    template: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    
    const coverLetter = await ctx.db.get(args.coverLetterId);
    if (!coverLetter || coverLetter.userId !== userId) {
      throw new Error("Cover letter not found or access denied");
    }

    const updateData: {
      name?: string;
      label?: string;
      tags?: string[];
      template?: string;
      updatedAt: number;
    } = {
      updatedAt: Date.now(),
    };

    if (args.name !== undefined) updateData.name = args.name;
    if (args.label !== undefined) updateData.label = args.label;
    if (args.tags !== undefined) updateData.tags = args.tags;
    if (args.template !== undefined) updateData.template = args.template;

    return await ctx.db.patch(args.coverLetterId, updateData);
  },
});

// Email Template functions
export const saveEmailTemplate = mutation({
  args: {
    name: v.string(),
    type: v.string(),
    content: v.object({
      template: v.string(),
      variables: v.array(v.string()),
      defaultValues: v.optional(v.record(v.string(), v.string())),
    }),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    
    const now = Date.now();
    
    return await ctx.db.insert("emailTemplates", {
      userId: userId,
      name: args.name,
      type: args.type,
      createdAt: now,
      updatedAt: now,
      content: args.content,
    });
  },
});

export const updateEmailTemplate = mutation({
  args: {
    templateId: v.id("emailTemplates"),
    name: v.optional(v.string()),
    type: v.optional(v.string()),
    content: v.optional(v.object({
      template: v.string(),
      variables: v.array(v.string()),
      defaultValues: v.optional(v.record(v.string(), v.string())),
    })),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    
    // Get the template to ensure it belongs to the user
    const template = await ctx.db.get(args.templateId);
    if (!template || template.userId !== userId) {
      throw new Error("Email template not found or access denied");
    }
    
    const updateData: any = {
      updatedAt: Date.now(),
    };
    
    if (args.name !== undefined) updateData.name = args.name;
    if (args.type !== undefined) updateData.type = args.type;
    if (args.content !== undefined) updateData.content = args.content;
    
    return await ctx.db.patch(args.templateId, updateData);
  },
});

export const deleteEmailTemplate = mutation({
  args: {
    templateId: v.id("emailTemplates"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    
    // Get the template to ensure it belongs to the user
    const template = await ctx.db.get(args.templateId);
    if (!template || template.userId !== userId) {
      throw new Error("Email template not found or access denied");
    }
    
    return await ctx.db.delete(args.templateId);
  },
});

export const listEmailTemplates = query({
  args: {
    type: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    
    const query = ctx.db
      .query("emailTemplates")
      .withIndex("by_user_and_type", (q) => q.eq("userId", userId));
    
    const results = await query.collect();
    if (args.type !== undefined) {
      return results.filter(doc => doc.type === args.type);
    }
    return results;
  },
});

// Test functions for development
export const createTestResumes = mutation({
  args: {
    count: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    
    const now = Date.now();
    const testResumes = [];
    
    for (let i = 1; i <= args.count; i++) {
      const testResume = {
        userId: userId,
        name: `Test Resume ${i}`,
        createdAt: now,
        updatedAt: now,
        isActive: true,
        content: {
          personalInfo: {
            name: `Test User ${i}`,
            email: `test${i}@example.com`,
            location: `Test City ${i}, TS`,
            linkedin: `https://linkedin.com/in/testuser${i}`,
            github: `https://github.com/testuser${i}`,
            portfolio: `https://testuser${i}.dev`,
            summary: `Experienced software developer with ${i} years of experience in web development and cloud technologies.`,
          },
          experience: [
            {
              company: `Test Company ${i}`,
              position: `Senior Developer`,
              startDate: `202${i}-01-01`,
              endDate: `202${i+1}-12-31`,
              description: `Led development of web applications using React, Node.js, and cloud technologies.`,
              achievements: [`Improved performance by ${i * 10}%`, `Reduced bugs by ${i * 5}%`],
              technologies: ['React', 'Node.js', 'TypeScript', 'AWS'],
              location: `Test City ${i}`,
            },
            {
              company: `Previous Company ${i}`,
              position: `Developer`,
              startDate: `202${i-1}-01-01`,
              endDate: `202${i}-12-31`,
              description: `Developed and maintained web applications using modern technologies.`,
              achievements: [`Delivered ${i} major features`, `Mentored ${i} junior developers`],
              technologies: ['JavaScript', 'Python', 'Docker', 'Git'],
              location: `Previous City ${i}`,
            }
          ],
          education: [
            {
              school: `Test University ${i}`,
              degree: `Bachelor of Science in Computer Science`,
              graduationDate: `202${i-2}-05-15`,
              gpa: `3.${8 + i}`,
              relevantCoursework: ['Data Structures', 'Algorithms', 'Web Development', 'Database Systems'],
              location: `University City ${i}`,
            }
          ],
          skills: ['JavaScript', 'TypeScript', 'React', 'Node.js', 'Python', 'AWS', 'Docker', 'Git'],
          certifications: [
            {
              name: `AWS Certified Developer - Associate`,
              issuer: 'Amazon Web Services',
              dateObtained: `202${i}-06-15`,
              credentialId: `AWS-DEV-${i}000`,
            }
          ],
          projects: [
            {
              name: `Test Project ${i}`,
              description: `A full-stack web application built with modern technologies.`,
              technologies: ['React', 'Node.js', 'MongoDB', 'Docker'],
              githubUrl: `https://github.com/testuser${i}/test-project-${i}`,
              liveUrl: `https://test-project-${i}.vercel.app`,
              startDate: `202${i}-03-01`,
              endDate: `202${i}-08-31`,
            }
          ],
          languages: [
            {
              language: 'English',
              proficiency: 'Native',
            },
            {
              language: 'Spanish',
              proficiency: 'Intermediate',
            }
          ],
          volunteerWork: [
            {
              organization: `Test Non-Profit ${i}`,
              role: 'Volunteer Developer',
              startDate: `202${i}-01-01`,
              endDate: `202${i}-12-31`,
              description: 'Developed websites and applications for local non-profit organizations.',
            }
          ],
        },
      };
      
      const resumeId = await ctx.db.insert("resumes", testResume);
      testResumes.push(resumeId);
    }
    
    return testResumes;
  },
});

// Duplicate a resume
export const duplicateResume = mutation({
  args: {
    resumeId: v.id("resumes"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const resume = await ctx.db.get(args.resumeId);
    if (!resume || resume.userId !== userId) {
      throw new Error("Resume not found or access denied");
    }

    const now = Date.now();

    return await ctx.db.insert("resumes", {
      userId: userId,
      name: `${resume.name} (Copy)`,
      createdAt: now,
      updatedAt: now,
      isActive: resume.isActive ?? true,
      content: resume.content,
      label: resume.label,
      tags: resume.tags,
      template: resume.template,
    });
  },
});

// Duplicate a cover letter
export const duplicateCoverLetter = mutation({
  args: {
    coverLetterId: v.id("coverLetters"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const coverLetter = await ctx.db.get(args.coverLetterId);
    if (!coverLetter || coverLetter.userId !== userId) {
      throw new Error("Cover letter not found or access denied");
    }

    const now = Date.now();

    return await ctx.db.insert("coverLetters", {
      userId: userId,
      name: `${coverLetter.name} (Copy)`,
      createdAt: now,
      updatedAt: now,
      content: coverLetter.content,
      label: coverLetter.label,
      tags: coverLetter.tags,
      template: coverLetter.template,
    });
  },
});
