import { v } from "convex/values";
import { internalMutation, internalQuery, internalAction } from "../_generated/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { AgentError } from "./auth";

const jobFields = {
  company: v.string(),
  title: v.string(),
  link: v.string(),
  status: v.string(),
  compensation: v.optional(v.string()),
  keywords: v.optional(v.array(v.string())),
  skills: v.optional(v.array(v.string())),
  description: v.optional(v.string()),
  dateApplied: v.optional(v.string()),
  interviewed: v.optional(v.boolean()),
  easyApply: v.optional(v.string()),
  resumeUsed: v.optional(v.string()),
  coverLetterUsed: v.optional(v.string()),
  notes: v.optional(v.string()),
};

const emailTemplateContent = v.object({
  template: v.string(),
  variables: v.array(v.string()),
  defaultValues: v.optional(v.record(v.string(), v.string())),
});

async function owned<T extends { userId?: string }>(
  ctx: QueryCtx | MutationCtx,
  id: Id<any>,
  userId: string,
  label: string
): Promise<T> {
  const doc = (await ctx.db.get(id)) as T | null;
  if (!doc || doc.userId !== userId) throw new Error(`${label} not found`);
  return doc;
}

function definedOnly(fields: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).filter(([, val]) => val !== undefined));
}

// ---- jobs ----
export const jobsList = internalQuery({
  args: { userId: v.string(), status: v.optional(v.string()) },
  handler: async (ctx, { userId, status }) => {
    const jobs = await ctx.db
      .query("jobs")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const filtered = status ? jobs.filter((j) => j.status.toLowerCase() === status.toLowerCase()) : jobs;
    return filtered.sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

export const jobsGet = internalQuery({
  args: { userId: v.string(), id: v.id("jobs") },
  handler: async (ctx, { userId, id }) => owned(ctx, id, userId, "Job"),
});

export const jobsAdd = internalMutation({
  args: { userId: v.string(), ...jobFields },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("jobs", { ...args, createdAt: now, updatedAt: now });
  },
});

export const jobsUpdate = internalMutation({
  args: {
    userId: v.string(),
    id: v.id("jobs"),
    company: v.optional(v.string()),
    title: v.optional(v.string()),
    link: v.optional(v.string()),
    status: v.optional(v.string()),
    compensation: v.optional(v.string()),
    keywords: v.optional(v.array(v.string())),
    skills: v.optional(v.array(v.string())),
    description: v.optional(v.string()),
    dateApplied: v.optional(v.string()),
    interviewed: v.optional(v.boolean()),
    easyApply: v.optional(v.string()),
    resumeUsed: v.optional(v.string()),
    coverLetterUsed: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { userId, id, ...fields }) => {
    await owned(ctx, id, userId, "Job");
    await ctx.db.patch(id, { ...definedOnly(fields), updatedAt: Date.now() });
  },
});

export const jobsRemove = internalMutation({
  args: { userId: v.string(), id: v.id("jobs") },
  handler: async (ctx, { userId, id }) => {
    await owned(ctx, id, userId, "Job");
    await ctx.db.delete(id);
  },
});

// ---- resumes ----
export const resumesList = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const rows = await ctx.db
      .query("resumes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return rows
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map(({ content: _content, ...meta }) => meta);
  },
});

export const resumesGet = internalQuery({
  args: { userId: v.string(), id: v.id("resumes") },
  handler: async (ctx, { userId, id }) => owned(ctx, id, userId, "Resume"),
});

export const resumesDelete = internalMutation({
  args: { userId: v.string(), id: v.id("resumes") },
  handler: async (ctx, { userId, id }) => {
    const resume = await owned<any>(ctx, id, userId, "Resume");
    if (resume.fileId) await ctx.storage.delete(resume.fileId);
    await ctx.db.delete(id);
  },
});

export const resumesDuplicate = internalMutation({
  args: { userId: v.string(), id: v.id("resumes") },
  handler: async (ctx, { userId, id }) => {
    const resume = await owned<any>(ctx, id, userId, "Resume");
    const now = Date.now();
    return await ctx.db.insert("resumes", {
      userId,
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

export const resumesRename = internalMutation({
  args: { userId: v.string(), id: v.id("resumes"), name: v.string() },
  handler: async (ctx, { userId, id, name }) => {
    await owned(ctx, id, userId, "Resume");
    await ctx.db.patch(id, { name, updatedAt: Date.now() });
  },
});

const DOCUMENT_PLAN_LIMITS: Record<string, number> = {
  free: 3,
  starter: 10,
  plus: 60,
  "plus-annual": 60,
  pro: 180,
  "pro-annual": 180,
};

export const resumesCanGenerate = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    const planKey = ((subscription as any)?.planId || "free").toLowerCase();
    const limit = DOCUMENT_PLAN_LIMITS[planKey] || DOCUMENT_PLAN_LIMITS.free;

    const now = Date.now();
    const currentMonth = new Date(now);
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);
    const monthStart = currentMonth.getTime();

    const resumes = await ctx.db
      .query("resumes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const coverLetters = await ctx.db
      .query("coverLetters")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const used =
      resumes.filter((r) => r.fileId && r.createdAt >= monthStart).length +
      coverLetters.filter((c) => c.fileId && c.createdAt >= monthStart).length;

    return { allowed: used < limit, limit, used };
  },
});

export const resumesInsertGenerated = internalMutation({
  args: {
    userId: v.string(),
    name: v.string(),
    fileId: v.id("_storage"),
    fileName: v.string(),
    fileSize: v.number(),
    content: v.any(),
    template: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("resumes", {
      userId: args.userId,
      name: args.name,
      fileId: args.fileId,
      fileName: args.fileName,
      fileSize: args.fileSize,
      fileType: "application/pdf",
      content: args.content,
      template: args.template,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

function formattedTimestamp(): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const d = new Date();
  const hours24 = d.getHours();
  const hours12 = hours24 % 12 || 12;
  const ampm = hours24 < 12 ? "AM" : "PM";
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} ${hours12}:${minutes} ${ampm}`;
}

export const resumesGenerate = internalAction({
  args: {
    userId: v.string(),
    personalInfo: v.any(),
    education: v.optional(v.any()),
    experience: v.optional(v.any()),
    projects: v.optional(v.any()),
    skills: v.optional(v.any()),
    certifications: v.optional(v.any()),
    additionalInfo: v.optional(v.any()),
    targetCompany: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ id: Id<"resumes">; name: string; fileUrl: string | null }> => {
    const canGenerate = await ctx.runQuery(internal.agent.fns.resumesCanGenerate, { userId: args.userId });
    if (!canGenerate.allowed) {
      throw new AgentError(
        403,
        "limit_reached",
        `You've reached your limit of ${canGenerate.limit} documents this month.`,
        "Upgrade your plan to continue generating documents."
      );
    }

    const content = {
      personalInfo: args.personalInfo,
      education: args.education ?? [],
      experience: args.experience ?? [],
      projects: args.projects ?? [],
      skills: args.skills ?? null,
      certifications: args.certifications ?? [],
      additionalInfo: args.additionalInfo ?? null,
    };

    const appBaseUrl = process.env.APP_BASE_URL || "https://www.myjobkompass.com";
    const exportResponse = await fetch(`${appBaseUrl}/api/resume/export/jake`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    if (!exportResponse.ok) {
      const errorBody = await exportResponse.json().catch(() => ({}));
      throw new AgentError(
        502,
        "generation_failed",
        `Resume PDF generation failed: ${errorBody.error || exportResponse.statusText}`,
        errorBody.details
      );
    }
    const pdfArrayBuffer = await exportResponse.arrayBuffer();
    const pdfBlob = new Blob([pdfArrayBuffer], { type: "application/pdf" });

    const fileId = await ctx.storage.store(pdfBlob);
    const fileUrl = await ctx.storage.getUrl(fileId);

    const firstName = args.personalInfo?.firstName || "";
    const lastName = args.personalInfo?.lastName || "";
    const formattedTime = formattedTimestamp();
    const companySuffix = args.targetCompany ? ` - ${args.targetCompany}` : "";
    const name = `${firstName} ${lastName} Resume${companySuffix} (${formattedTime})`;
    const fileName = `resume-${firstName}-${lastName}-${formattedTime}.pdf`;

    const id: Id<"resumes"> = await ctx.runMutation(internal.agent.fns.resumesInsertGenerated, {
      userId: args.userId,
      name,
      fileId,
      fileName,
      fileSize: pdfBlob.size,
      content,
      template: "jake",
    });

    return { id, name, fileUrl };
  },
});

export const coverLettersInsertGenerated = internalMutation({
  args: {
    userId: v.string(),
    name: v.string(),
    fileId: v.id("_storage"),
    fileName: v.string(),
    fileSize: v.number(),
    content: v.any(),
    template: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("coverLetters", {
      userId: args.userId,
      name: args.name,
      fileId: args.fileId,
      fileName: args.fileName,
      fileSize: args.fileSize,
      fileType: "application/pdf",
      content: args.content,
      template: args.template,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const coverLettersGenerate = internalAction({
  args: {
    userId: v.string(),
    personalInfo: v.any(),
    jobInfo: v.any(),
    letterContent: v.any(),
  },
  handler: async (ctx, args): Promise<{ id: Id<"coverLetters">; name: string; fileUrl: string | null }> => {
    const canGenerate = await ctx.runQuery(internal.agent.fns.resumesCanGenerate, { userId: args.userId });
    if (!canGenerate.allowed) {
      throw new AgentError(
        403,
        "limit_reached",
        `You've reached your limit of ${canGenerate.limit} documents this month.`,
        "Upgrade your plan to continue generating documents."
      );
    }

    const content = {
      personalInfo: args.personalInfo,
      jobInfo: args.jobInfo,
      letterContent: args.letterContent,
    };

    const appBaseUrl = process.env.APP_BASE_URL || "https://www.myjobkompass.com";
    const exportResponse = await fetch(`${appBaseUrl}/api/coverletter/export/jake`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    if (!exportResponse.ok) {
      const errorBody = await exportResponse.json().catch(() => ({}));
      throw new AgentError(
        502,
        "generation_failed",
        `Cover letter PDF generation failed: ${errorBody.error || exportResponse.statusText}`,
        errorBody.details
      );
    }
    const pdfArrayBuffer = await exportResponse.arrayBuffer();
    const pdfBlob = new Blob([pdfArrayBuffer], { type: "application/pdf" });

    const fileId = await ctx.storage.store(pdfBlob);
    const fileUrl = await ctx.storage.getUrl(fileId);

    const firstName = args.personalInfo?.firstName || "";
    const lastName = args.personalInfo?.lastName || "";
    const formattedTime = formattedTimestamp();
    const companySuffix = args.jobInfo?.company ? ` - ${args.jobInfo.company}` : "";
    const name = `${firstName} ${lastName} Cover Letter${companySuffix} (${formattedTime})`;
    const fileName = `coverletter-${firstName}-${lastName}-${formattedTime}.pdf`;

    const id: Id<"coverLetters"> = await ctx.runMutation(internal.agent.fns.coverLettersInsertGenerated, {
      userId: args.userId,
      name,
      fileId,
      fileName,
      fileSize: pdfBlob.size,
      content,
      template: "jake",
    });

    return { id, name, fileUrl };
  },
});

// ---- cover letters ----
export const coverLettersList = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const rows = await ctx.db
      .query("coverLetters")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return rows
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map(({ content: _content, ...meta }) => meta);
  },
});

export const coverLettersGet = internalQuery({
  args: { userId: v.string(), id: v.id("coverLetters") },
  handler: async (ctx, { userId, id }) => owned(ctx, id, userId, "Cover letter"),
});

export const coverLettersDelete = internalMutation({
  args: { userId: v.string(), id: v.id("coverLetters") },
  handler: async (ctx, { userId, id }) => {
    const letter = await owned<any>(ctx, id, userId, "Cover letter");
    if (letter.fileId) await ctx.storage.delete(letter.fileId);
    await ctx.db.delete(id);
  },
});

export const coverLettersDuplicate = internalMutation({
  args: { userId: v.string(), id: v.id("coverLetters") },
  handler: async (ctx, { userId, id }) => {
    const letter = await owned<any>(ctx, id, userId, "Cover letter");
    const now = Date.now();
    return await ctx.db.insert("coverLetters", {
      userId,
      name: `${letter.name} (Copy)`,
      createdAt: now,
      updatedAt: now,
      content: letter.content,
      label: letter.label,
      tags: letter.tags,
      template: letter.template,
    });
  },
});

// ---- email templates ----
export const emailTemplatesList = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const rows = await ctx.db
      .query("emailTemplates")
      .withIndex("by_user_and_type", (q) => q.eq("userId", userId))
      .collect();
    return rows.sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

export const emailTemplatesSave = internalMutation({
  args: { userId: v.string(), name: v.string(), type: v.string(), content: emailTemplateContent },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("emailTemplates", { ...args, createdAt: now, updatedAt: now });
  },
});

export const emailTemplatesUpdate = internalMutation({
  args: {
    userId: v.string(),
    id: v.id("emailTemplates"),
    name: v.optional(v.string()),
    type: v.optional(v.string()),
    content: v.optional(emailTemplateContent),
  },
  handler: async (ctx, { userId, id, ...fields }) => {
    await owned(ctx, id, userId, "Email template");
    await ctx.db.patch(id, { ...definedOnly(fields), updatedAt: Date.now() });
  },
});

export const emailTemplatesDelete = internalMutation({
  args: { userId: v.string(), id: v.id("emailTemplates") },
  handler: async (ctx, { userId, id }) => {
    await owned(ctx, id, userId, "Email template");
    await ctx.db.delete(id);
  },
});

// ---- resources ----
export const resourcesList = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const rows = await ctx.db
      .query("resources")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return rows.sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

export const resourcesAdd = internalMutation({
  args: {
    userId: v.string(),
    type: v.string(),
    title: v.string(),
    url: v.string(),
    description: v.optional(v.string()),
    notes: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("resources", { ...args, createdAt: now, updatedAt: now });
  },
});

export const resourcesUpdate = internalMutation({
  args: {
    userId: v.string(),
    id: v.id("resources"),
    type: v.optional(v.string()),
    title: v.optional(v.string()),
    url: v.optional(v.string()),
    description: v.optional(v.string()),
    notes: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    category: v.optional(v.string()),
  },
  handler: async (ctx, { userId, id, ...fields }) => {
    await owned(ctx, id, userId, "Resource");
    await ctx.db.patch(id, { ...definedOnly(fields), updatedAt: Date.now() });
  },
});

export const resourcesRemove = internalMutation({
  args: { userId: v.string(), id: v.id("resources") },
  handler: async (ctx, { userId, id }) => {
    await owned(ctx, id, userId, "Resource");
    await ctx.db.delete(id);
  },
});

// ---- threads (read-only) ----
export const threadsList = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    // threads.userId is optional/legacy, so no by-user index exists; volume is small.
    const all = await ctx.db.query("threads").collect();
    return all
      .filter((t) => t.userId === userId)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((t) => ({ _id: t._id, title: t.title, createdAt: t.createdAt, updatedAt: t.updatedAt }));
  },
});

export const threadsGet = internalQuery({
  args: { userId: v.string(), id: v.id("threads") },
  handler: async (ctx, { userId, id }) => {
    const thread = await owned<any>(ctx, id, userId, "Thread");
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_thread", (q) => q.eq("threadId", id))
      .collect();
    return { thread, messages };
  },
});
