import { v } from "convex/values";

/** Where a job came from (see lib/jkJobSource.ts). Stored on jobs.source. */
export const jobSourceKind = v.union(
  v.literal("gmail"), v.literal("outlook"), v.literal("email"), v.literal("web"), v.literal("extension"), v.literal("none"),
);

export const jobSourceValidator = v.object({
  kind: jobSourceKind,
  host: v.optional(v.string()),
  site: v.optional(v.string()),
  inbox: v.optional(v.string()),
  sender: v.optional(v.string()),
  received: v.optional(v.string()),
  url: v.optional(v.string()),
});

/** What a caller may pass when adding a job. Everything else is read from the link and notes. */
export const jobSourceInputValidator = v.object({
  kind: v.optional(jobSourceKind),
  inbox: v.optional(v.string()),
  sender: v.optional(v.string()),
  received: v.optional(v.string()),
});
