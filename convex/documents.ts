import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Auth } from "convex/server";

// Resume functions
export const saveResume = mutation({
  args: {
    name: v.string(),
    content: v.object({
      personalInfo: v.object({
        name: v.string(),
        email: v.string(),
        phone: v.optional(v.string()),
        location: v.optional(v.string()),
        linkedin: v.optional(v.string()),
        github: v.optional(v.string()),
        portfolio: v.optional(v.string()),
        summary: v.optional(v.string()),
      }),
      experience: v.array(
        v.object({
          company: v.string(),
          position: v.string(),
          startDate: v.string(),
          endDate: v.optional(v.string()),
          description: v.string(),
          achievements: v.optional(v.array(v.string())),
          technologies: v.optional(v.array(v.string())),
          location: v.optional(v.string()),
        })
      ),
      education: v.array(
        v.object({
          school: v.string(),
          degree: v.string(),
          graduationDate: v.string(),
          gpa: v.optional(v.string()),
          relevantCoursework: v.optional(v.array(v.string())),
          location: v.optional(v.string()),
        })
      ),
      skills: v.array(v.string()),
      certifications: v.optional(v.array(
        v.object({
          name: v.string(),
          issuer: v.string(),
          dateObtained: v.string(),
          expiryDate: v.optional(v.string()),
          credentialId: v.optional(v.string()),
        })
      )),
      projects: v.optional(v.array(
        v.object({
          name: v.string(),
          description: v.string(),
          technologies: v.array(v.string()),
          githubUrl: v.optional(v.string()),
          liveUrl: v.optional(v.string()),
          startDate: v.optional(v.string()),
          endDate: v.optional(v.string()),
        })
      )),
      languages: v.optional(v.array(
        v.object({
          language: v.string(),
          proficiency: v.string(),
        })
      )),
      volunteerWork: v.optional(v.array(
        v.object({
          organization: v.string(),
          role: v.string(),
          startDate: v.string(),
          endDate: v.optional(v.string()),
          description: v.string(),
        })
      )),
    }),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    // Get the user ID from the users table based on the tokenIdentifier
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    
    if (!user) throw new Error("User not found");
    
    const now = Date.now();
    
    return await ctx.db.insert("resumes", {
      userId: user._id,
      name: args.name,
      createdAt: now,
      updatedAt: now,
      isActive: args.isActive ?? true,
      content: args.content,
    });
  },
});

export const updateResume = mutation({
  args: {
    resumeId: v.id("resumes"),
    name: v.optional(v.string()),
    content: v.optional(v.object({
      personalInfo: v.object({
        name: v.string(),
        email: v.string(),
        phone: v.optional(v.string()),
        location: v.optional(v.string()),
        linkedin: v.optional(v.string()),
        github: v.optional(v.string()),
        portfolio: v.optional(v.string()),
        summary: v.optional(v.string()),
      }),
      experience: v.array(
        v.object({
          company: v.string(),
          position: v.string(),
          startDate: v.string(),
          endDate: v.optional(v.string()),
          description: v.string(),
          achievements: v.optional(v.array(v.string())),
          technologies: v.optional(v.array(v.string())),
          location: v.optional(v.string()),
        })
      ),
      education: v.array(
        v.object({
          school: v.string(),
          degree: v.string(),
          graduationDate: v.string(),
          gpa: v.optional(v.string()),
          relevantCoursework: v.optional(v.array(v.string())),
          location: v.optional(v.string()),
        })
      ),
      skills: v.array(v.string()),
      certifications: v.optional(v.array(
        v.object({
          name: v.string(),
          issuer: v.string(),
          dateObtained: v.string(),
          expiryDate: v.optional(v.string()),
          credentialId: v.optional(v.string()),
        })
      )),
      projects: v.optional(v.array(
        v.object({
          name: v.string(),
          description: v.string(),
          technologies: v.array(v.string()),
          githubUrl: v.optional(v.string()),
          liveUrl: v.optional(v.string()),
          startDate: v.optional(v.string()),
          endDate: v.optional(v.string()),
        })
      )),
      languages: v.optional(v.array(
        v.object({
          language: v.string(),
          proficiency: v.string(),
        })
      )),
      volunteerWork: v.optional(v.array(
        v.object({
          organization: v.string(),
          role: v.string(),
          startDate: v.string(),
          endDate: v.optional(v.string()),
          description: v.string(),
        })
      )),
    })),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    // Get the user ID from the users table
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    
    if (!user) throw new Error("User not found");
    
    // Get the resume to ensure it belongs to the user
    const resume = await ctx.db.get(args.resumeId);
    if (!resume || resume.userId !== user._id) {
      throw new Error("Resume not found or access denied");
    }
    
    const updateData: any = {
      updatedAt: Date.now(),
    };
    
    if (args.name !== undefined) updateData.name = args.name;
    if (args.content !== undefined) updateData.content = args.content;
    if (args.isActive !== undefined) updateData.isActive = args.isActive;
    
    return await ctx.db.patch(args.resumeId, updateData);
  },
});

export const deleteResume = mutation({
  args: {
    resumeId: v.id("resumes"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    // Get the user ID from the users table
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    
    if (!user) throw new Error("User not found");
    
    // Get the resume to ensure it belongs to the user
    const resume = await ctx.db.get(args.resumeId);
    if (!resume || resume.userId !== user._id) {
      throw new Error("Resume not found or access denied");
    }
    
    return await ctx.db.delete(args.resumeId);
  },
});

export const listResumes = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // const identity = await ctx.auth.getUserIdentity();
    // console.log("identity", identity);
    // if (!identity) return [];
    
    // Get the user ID from the users table
    const user = await ctx.db
      .query("users")
      // .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      // .withIndex("by_token", (q) => q.eq("tokenIdentifier", 'k574b2c1mn5r6ytz0scg4qnnk97fzqny'))
      .withIndex("by_id", (q) => q.eq("_id", args.userId))
      .unique();
    
    // if (!user) return [];
    console.log("user", user);

    return await ctx.db
      .query("resumes")
      .withIndex("by_user", (q) => q.eq("userId", 'k9783nn9ajh5fwtm20vb5kvgfx7fyzze' as any))
      .collect();
  },

});

export const getResume = query({
  args: {
    resumeId: v.id("resumes"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    // Get the user ID from the users table
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    
    if (!user) throw new Error("User not found");
    
    const resume = await ctx.db.get(args.resumeId);
    if (!resume || resume.userId !== user._id) {
      throw new Error("Resume not found or access denied");
    }
    
    return resume;
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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    // Get the user ID from the users table
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    
    if (!user) throw new Error("User not found");
    
    const now = Date.now();
    
    return await ctx.db.insert("coverLetters", {
      userId: user._id,
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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    // Get the user ID from the users table
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    
    if (!user) throw new Error("User not found");
    
    // Get the cover letter to ensure it belongs to the user
    const coverLetter = await ctx.db.get(args.coverLetterId);
    if (!coverLetter || coverLetter.userId !== user._id) {
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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    // Get the user ID from the users table
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    
    if (!user) throw new Error("User not found");
    
    // Get the cover letter to ensure it belongs to the user
    const coverLetter = await ctx.db.get(args.coverLetterId);
    if (!coverLetter || coverLetter.userId !== user._id) {
      throw new Error("Cover letter not found or access denied");
    }
    
    return await ctx.db.delete(args.coverLetterId);
  },
});

export const listCoverLetters = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    
    // Get the user ID from the users table
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    
    if (!user) return [];
    
    return await ctx.db
      .query("coverLetters")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    // Get the user ID from the users table
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    
    if (!user) throw new Error("User not found");
    
    const now = Date.now();
    
    return await ctx.db.insert("emailTemplates", {
      userId: user._id,
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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    // Get the user ID from the users table
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    
    if (!user) throw new Error("User not found");
    
    // Get the template to ensure it belongs to the user
    const template = await ctx.db.get(args.templateId);
    if (!template || template.userId !== user._id) {
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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    // Get the user ID from the users table
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    
    if (!user) throw new Error("User not found");
    
    // Get the template to ensure it belongs to the user
    const template = await ctx.db.get(args.templateId);
    if (!template || template.userId !== user._id) {
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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    
    // Get the user ID from the users table
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    
    if (!user) return [];
    
    const query = ctx.db
      .query("emailTemplates")
      .withIndex("by_user_and_type", (q) => q.eq("userId", user._id));
    
    const results = await query.collect();
    if (args.type !== undefined) {
      return results.filter(doc => doc.type === args.type);
    }
    return results;
  },
});

export const createTestUser = mutation({
  handler: async (ctx) => {
    // Create a test user for development
    const testUserId = await ctx.db.insert("users", {
      name: "Test User",
      email: "test@example.com",
      tokenIdentifier: "",
    });
    
    console.log("Created test user:", testUserId);
    return testUserId;
  },
});

export const listUsers = query({
  handler: async (ctx) => {
    return await ctx.db.query("users").collect();
  },
});

export const createTestResumes = mutation({
  args: {
    count: v.number(),
  },
  handler: async (ctx, args) => {
    // Use the hardcoded user ID that matches listResumes
    const userId = 'k9783nn9ajh5fwtm20vb5kvgfx7fyzze' as any;
    
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
