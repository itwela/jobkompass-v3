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
    // File storage fields for uploaded resumes
    fileId: v.optional(v.id("_storage")),
    fileName: v.optional(v.string()),
    fileType: v.optional(v.string()),
    fileSize: v.optional(v.number()),
    // Labels and tags for organization
    label: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    template: v.optional(v.string()), // Template used for this resume (e.g., "modern", "classic", "minimalist")
    // Flexible content field - can be any JSON structure
    content: v.optional(v.any()),
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

  // Waitlist table
  waitlist: defineTable({
    email: v.string(),
    name: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_email", ["email"]),
});

export default schema;
