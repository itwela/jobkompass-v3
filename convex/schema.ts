import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

const documentsTables = {
  resumes: defineTable({
    userId: v.string(),
    name: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    isActive: v.optional(v.boolean()),
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
          proficiency: v.string(), // e.g., "Native", "Fluent", "Intermediate", "Basic"
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
  }).index("by_user", ["userId"]),
  resumeIRs: defineTable({
    userId: v.string(),
    name: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    ir: v.any(),
    meta: v.optional(v.object({
      template: v.optional(v.string()),
      lastEditedISO: v.optional(v.string()),
      version: v.optional(v.number()),
    })),
    isActive: v.optional(v.boolean()),
  }).index("by_user", ["userId"]),

  coverLetters: defineTable({
    userId: v.string(),
    name: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    content: v.object({
      template: v.string(),
      company: v.optional(v.string()),
      position: v.optional(v.string()),
      customizations: v.optional(v.object({
        keyPoints: v.array(v.string()),
        tone: v.string(),
      })),
    }),
  }).index("by_user", ["userId"]),

  emailTemplates: defineTable({
    userId: v.string(),
    name: v.string(),
    type: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    content: v.object({
      template: v.string(),
      variables: v.array(v.string()),
      defaultValues: v.optional(v.record(v.string(), v.string())),
    }),
  }).index("by_user_and_type", ["userId", "type"]),

  resources: defineTable({
    userId: v.optional(v.string()), // Legacy field for backward compatibility
    username: v.optional(v.string()), // Username for user identification
    type: v.string(), // 'resource', 'link', etc.
    title: v.string(),
    url: v.string(),
    description: v.optional(v.string()),
    notes: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    category: v.optional(v.string()), // Optional category for filtering
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  jobs: defineTable({
    userId: v.optional(v.string()), // Legacy field for backward compatibility
    username: v.optional(v.string()), // Username for user identification
    company: v.string(),
    title: v.string(),
    link: v.string(),
    status: v.string(), // e.g., "Interested", "Applied", "Interviewing", "Rejected", "Offered"
    keywords: v.optional(v.array(v.string())),
    skills: v.optional(v.array(v.string())),
    description: v.optional(v.string()),
    dateApplied: v.optional(v.string()),
    interviewed: v.optional(v.boolean()),
    easyApply: v.optional(v.string()), // "Yes" or "No"
    resumeUsed: v.optional(v.string()),
    coverLetterUsed: v.optional(v.string()),
    notes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"])
    .index("by_username", ["username"]),

  threads: defineTable({
    username: v.string(), // Use username instead of userId
    title: v.string(), // Auto-generated from first message
    createdAt: v.number(),
    updatedAt: v.number(),
    lastMessageAt: v.number(),
    messageCount: v.number(),
  }).index("by_username", ["username"])
    .index("by_username_and_updated", ["username", "updatedAt"]),

  messages: defineTable({
    threadId: v.id("threads"),
    username: v.optional(v.string()), // Use username instead of userId (optional for backward compatibility)
    userId: v.optional(v.string()), // Legacy field for backward compatibility
    role: v.string(), // 'user' or 'assistant'
    content: v.string(),
    createdAt: v.number(),
    toolCalls: v.optional(v.array(v.object({
      name: v.string(),
      arguments: v.any(),
      result: v.any(),
    }))),
  }).index("by_thread", ["threadId"])
    .index("by_thread_and_created", ["threadId", "createdAt"]),
};

const schema = defineSchema({
  ...authTables,
  ...documentsTables,
  // Extend users table with custom fields
  users: defineTable({
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    image: v.optional(v.string()),
    isAnonymous: v.optional(v.boolean()),
    username: v.optional(v.string()), // Username field (optional for backward compatibility)
  })
    .index("email", ["email"]),
});

export default schema;
