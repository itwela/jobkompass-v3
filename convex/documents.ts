import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
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

    return allResumes;
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
    content: v.optional(v.object({
      template: v.string(),
      company: v.optional(v.string()),
      position: v.optional(v.string()),
      customizations: v.optional(v.object({
        keyPoints: v.array(v.string()),
        tone: v.string(),
      })),
    })),
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
    
    return await ctx.db.delete(args.coverLetterId);
  },
});

export const listCoverLetters = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    
    return await ctx.db
      .query("coverLetters")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
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
            phone: `+1-555-${String(i).padStart(3, '0')}-0000`,
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
