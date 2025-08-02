import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const applicationTables = {
  users: defineTable({
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    tokenIdentifier: v.string(),
  }).index("by_token", ["tokenIdentifier"]),

  resumes: defineTable({
    userId: v.id("users"),
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

  coverLetters: defineTable({
    userId: v.id("users"),
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
    userId: v.id("users"),
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
};

export default defineSchema(applicationTables);
