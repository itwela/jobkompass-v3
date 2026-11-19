import { v } from "convex/values";
import { documentsUsedSince } from "../documentCount";
import { internalMutation, internalQuery, internalAction } from "../_generated/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { AgentError } from "./auth";
import { shouldSeedBaseResume } from "../baseResume";
import { nextStatusHistory } from "../jobStatusHistory";
import { planRank } from "../plans";
import { setResumeShared } from "../resumeShares";
import { foldersWithCounts } from "../documentFolders";
import { executeResumeMove } from "./resumeMove";
import { tailoringValidator } from "../tailoring";
import { exportResumePdf } from "./resumePdf";
import { canUseResumeTemplate, isValidResumeTemplateId, resolveResumeTemplateId } from "../../lib/templates";
import type { PlanRank } from "../plans";
import {
  flashcardValidator,
  storyValidator,
  requirementMatchValidator,
  questionToAskValidator,
  trapValidator,
  checklistItemValidator,
} from "../interviewPreps";
import type { BulletQuestion } from "../../lib/resume/bulletQuestions";
import type { ResumeScorecard } from "../../lib/resume/scorecard";
import {
  QUESTIONS_RULE,
  isAnswered,
  resolveAnswers,
  scorecardFor,
  storedToAnswers,
  templatedQuestions,
} from "./resumeQuestions";

/**
 * The caller's plan rank, resolved from their subscription row. Used by the
 * agent API's auth chokepoint and by every server-to-server export call.
 */
export const agentPlanRank = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    return planRank(subscription);
  },
});

/**
 * What the in-app tailor reads from the account before writing: saved resume
 * preferences (auth.getResumePreferences) and the Settings default template, dropped
 * when it is above the plan (auth.getDefaultTemplate).
 */
export const tailorSettings = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }): Promise<{ resumePreferences: string[]; defaultTemplate: string | null; rank: number }> => {
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    const rank = planRank(subscription);
    const id = ctx.db.normalizeId("users", userId);
    const user: any = id ? await ctx.db.get(id) : null;
    const resumePreferences: string[] = Array.isArray(user?.resumePreferences) ? user.resumePreferences : [];
    const stored = user?.defaultTemplate as string | undefined;
    const defaultTemplate =
      stored && isValidResumeTemplateId(stored) && canUseResumeTemplate(stored, rank as PlanRank)
        ? resolveResumeTemplateId(stored)
        : null;
    return { resumePreferences, defaultTemplate, rank };
  },
});

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
    return await ctx.db.insert("jobs", { ...args, statusHistory: nextStatusHistory(undefined, undefined, args.status, now) ?? undefined, createdAt: now, updatedAt: now });
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
    const job = await owned<Doc<"jobs">>(ctx, id, userId, "Job");
    const now = Date.now();
    const statusHistory = nextStatusHistory(job.statusHistory, job.status, fields.status, now);
    await ctx.db.patch(id, { ...definedOnly(fields), ...(statusHistory ? { statusHistory } : {}), updatedAt: now });
  },
});

/** Stores the job's extracted must-have list so later tailor runs reuse it. */
export const jobsSetMustHaves = internalMutation({
  args: { userId: v.string(), id: v.id("jobs"), mustHaves: v.array(v.string()), mustHavesKey: v.string() },
  handler: async (ctx, { userId, id, mustHaves, mustHavesKey }) => {
    await owned(ctx, id, userId, "Job");
    await ctx.db.patch(id, { mustHaves: mustHaves.slice(0, 20), mustHavesKey });
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
      // A copy of the base must not become a second base — see convex/baseResume.ts
      createdAt: now,
      updatedAt: now,
      isActive: await shouldSeedBaseResume(ctx, userId),
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

// ---- folders ----
export const foldersList = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) =>
    (await foldersWithCounts(ctx, userId)).map((f) => ({
      id: f._id,
      name: f.name,
      resumeCount: f.resumeCount,
      coverLetterCount: f.coverLetterCount,
    })),
});

/**
 * Files one or many resumes into one of the caller's folders. Only folderId is
 * written (same as documentFolders.moveDocuments: no updatedAt bump, nothing
 * deleted). Bulk (allExceptFavorites) is a dry run unless confirm is true.
 */
export const resumesMove = internalMutation({
  args: {
    userId: v.string(),
    folder: v.string(),
    resumeIds: v.optional(v.array(v.string())),
    allExceptFavorites: v.optional(v.boolean()),
    dryRun: v.optional(v.boolean()),
    confirm: v.optional(v.boolean()),
  },
  handler: async (ctx, { userId, ...req }) => {
    const [folders, resumes] = await Promise.all([
      ctx.db.query("documentFolders").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      ctx.db.query("resumes").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
    ]);
    const ownResumes = new Map(resumes.map((r) => [r._id as string, r]));
    const ownFolders = new Map(folders.map((f) => [f._id as string, f]));
    return await executeResumeMove(
      resumes.map((r) => ({ _id: r._id, name: r.name, folderId: r.folderId, isFavorite: r.isFavorite })),
      folders.map((f) => ({ _id: f._id, name: f.name })),
      req,
      async (resumeId, folderId) => {
        // Both rows came from by_user queries; re-checked at the write anyway.
        const resume = ownResumes.get(resumeId);
        const folder = ownFolders.get(folderId);
        if (!resume || resume.userId !== userId || !folder || folder.userId !== userId) {
          throw new Error("Resume or folder not found");
        }
        await ctx.db.patch(resume._id, { folderId: folder._id });
      }
    );
  },
});

export const resumesShare = internalMutation({
  args: { userId: v.string(), id: v.id("resumes"), off: v.optional(v.boolean()) },
  handler: async (ctx, { userId, id, off }) => {
    const resume = await owned<any>(ctx, id, userId, "Resume");
    return await setResumeShared(ctx, resume, off);
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
    const used = documentsUsedSince(resumes, coverLetters, monthStart);

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
    /** Set by server-side tailoring so the Documents UI can mark what changed. */
    tailoring: v.optional(tailoringValidator),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    if (args.tailoring?.baseResumeId) await owned(ctx, args.tailoring.baseResumeId, args.userId, "Resume");
    if (args.tailoring?.jobId) await owned(ctx, args.tailoring.jobId, args.userId, "Job");
    return await ctx.db.insert("resumes", {
      userId: args.userId,
      name: args.name,
      fileId: args.fileId,
      fileName: args.fileName,
      fileSize: args.fileSize,
      fileType: "application/pdf",
      content: args.content,
      template: args.template,
      ...(args.tailoring ? { tailoring: args.tailoring } : {}),
      // Seed if empty, never steal — see convex/baseResume.ts
      isActive: await shouldSeedBaseResume(ctx, args.userId),
      createdAt: now,
      updatedAt: now,
    });
  },
});

// ---- bullet questions (agent path) ----

/** The user's base resume (isActive), or null. Its bulletAnswers are the saved facts. */
export const baseResumeForUser = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const rows = await ctx.db
      .query("resumes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const base = rows.find((r) => r.isActive === true);
    if (!base) return null;
    return { _id: base._id, name: base.name, bulletAnswers: base.bulletAnswers ?? [] };
  },
});

type QuestionsBlock = {
  questions: BulletQuestion[];
  questionSource: "template" | "ai" | "none";
  questionsError?: string;
  scorecard: ResumeScorecard;
  rule: string;
};

/**
 * Questions + scorecard for content the calling agent wrote. Deterministic by
 * default; `ai` asks the model (rewrite discarded) and falls back to the
 * templated questions if the model is unavailable. Never changes `content`.
 */
async function questionsFor(
  ctx: any,
  args: { userId: string; content: any; jobId?: Id<"jobs">; ai?: boolean; answers?: unknown }
): Promise<QuestionsBlock> {
  const job: any = args.jobId
    ? await ctx.runQuery(internal.agent.fns.jobsGet, { userId: args.userId, id: args.jobId })
    : null;
  let answers = args.answers;
  if (answers === undefined) {
    const base: any = await ctx.runQuery(internal.agent.fns.baseResumeForUser, { userId: args.userId });
    answers = base?.bulletAnswers ?? [];
  }
  const clean = storedToAnswers(answers);
  const scorecard = scorecardFor(args.content, job);
  let questions: BulletQuestion[] = [];
  let questionSource: QuestionsBlock["questionSource"] = "template";
  let questionsError: string | undefined;
  if (args.ai) {
    try {
      questions = await ctx.runAction(internal.agent.tailor.modelQuestions, {
        userId: args.userId,
        content: args.content,
        company: job?.company,
        role: job?.title,
        jobDescription: job?.description,
        answers: clean,
      });
      questionSource = "ai";
    } catch (err) {
      questionsError = err instanceof Error ? err.message : String(err);
    }
  }
  if (questionSource !== "ai" || questions.length === 0) {
    questions = templatedQuestions(args.content, clean);
    questionSource = "template";
  }
  if (questions.length === 0) questionSource = "none";
  return { questions, questionSource, ...(questionsError ? { questionsError } : {}), scorecard, rule: QUESTIONS_RULE };
}

/** Saves open questions on the resume so the app can show them too. Best effort. */
async function savePending(ctx: any, userId: string, resumeId: Id<"resumes">, questions: BulletQuestion[]): Promise<void> {
  try {
    await ctx.runMutation(internal.documents.setResumeTailorMetaInternal, {
      userId,
      resumeId,
      pendingQuestions: questions,
    });
  } catch (err) {
    console.warn(`savePending ${resumeId}: ${err instanceof Error ? err.message : err}`);
  }
}

/**
 * Questions for an existing resume, BEFORE generating anything, so an agent can
 * ask its human first. Answers already saved (on this resume, or on the base it
 * was tailored from) suppress their questions.
 */
export const resumesQuestions = internalAction({
  args: {
    userId: v.string(),
    id: v.id("resumes"),
    jobId: v.optional(v.id("jobs")),
    ai: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    args
  ): Promise<QuestionsBlock & { resumeId: Id<"resumes">; answersOn: Id<"resumes">; answers: unknown[] }> => {
    const resume: any = await ctx.runQuery(internal.agent.fns.resumesGet, { userId: args.userId, id: args.id });
    const answersOn: Id<"resumes"> = resume.tailoredFrom?.baseResumeId ?? resume._id;
    const holder: any =
      answersOn === resume._id
        ? resume
        : await ctx.runQuery(internal.agent.fns.resumesGet, { userId: args.userId, id: answersOn }).catch(() => resume);
    const answers = [...(holder.bulletAnswers ?? []), ...(holder === resume ? [] : resume.bulletAnswers ?? [])];
    const block = await questionsFor(ctx, {
      userId: args.userId,
      content: resume.content ?? {},
      jobId: args.jobId ?? resume.tailoredFrom?.jobId,
      ai: args.ai,
      answers,
    });
    return { resumeId: resume._id, answersOn: holder._id, answers, ...block };
  },
});

/**
 * Saves the human's answers as facts on the BASE resume. Passing a tailored
 * resume's id saves onto the base it came from (indices line up: tailoring never
 * reorders jobs or projects). Each answer is {id, answer} using a question id
 * from this API, or {section, index, bullet, answer}.
 */
export const resumesAnswer = internalAction({
  args: { userId: v.string(), id: v.id("resumes"), answers: v.any() },
  handler: async (
    ctx,
    args
  ): Promise<{ savedTo: Id<"resumes">; saved: number; unresolved: string[]; bulletAnswers: unknown[] }> => {
    const resume: any = await ctx.runQuery(internal.agent.fns.resumesGet, { userId: args.userId, id: args.id });
    if (!Array.isArray(args.answers) || args.answers.length === 0) {
      throw new AgentError(400, "invalid_param", "answers must be a non-empty JSON array", 'Example: [{"id":"experience-0-abc12","answer":"about 40 tickets a day"}]');
    }
    const { answers, unresolved } = resolveAnswers(resume.content ?? {}, args.answers);
    if (answers.length === 0) {
      throw new AgentError(
        400,
        "invalid_param",
        `No usable answers${unresolved.length ? ` (unknown question ids: ${unresolved.join(", ")})` : ""}`,
        "Use ids from 'jk resumes questions --id <same resume>', or pass {section,index,bullet,answer}."
      );
    }
    const target: Id<"resumes"> = resume.tailoredFrom?.baseResumeId ?? resume._id;
    const result: { bulletAnswers: unknown[] } = await ctx.runMutation(internal.documents.saveBulletAnswersInternal, {
      userId: args.userId,
      resumeId: target,
      answers,
    });
    // Answered questions are no longer pending on the resume they were asked about.
    if (Array.isArray(resume.pendingQuestions) && resume.pendingQuestions.length) {
      const remaining = resume.pendingQuestions.filter(
        (q: any) => !isAnswered(answers, q.section, q.index, String(q.bullet ?? ""))
      );
      if (remaining.length !== resume.pendingQuestions.length) await savePending(ctx, args.userId, resume._id, remaining);
    }
    return { savedTo: target, saved: answers.length, unresolved, bulletAnswers: result.bulletAnswers };
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
    internships: v.optional(v.any()),
    coreCompetencies: v.optional(v.any()),
    earlyCareer: v.optional(v.any()),
    additionalInfo: v.optional(v.any()),
    targetCompany: v.optional(v.string()),
    template: v.optional(v.string()),
    jobId: v.optional(v.id("jobs")),
    aiQuestions: v.optional(v.boolean()),
    /** Internal: the tailor action computes its own questions. */
    skipQuestions: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ id: Id<"resumes">; name: string; fileUrl: string | null } & Partial<QuestionsBlock>> => {
    // Ownership of the job is checked before anything is spent.
    if (args.jobId) await ctx.runQuery(internal.agent.fns.jobsGet, { userId: args.userId, id: args.jobId });
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
      internships: args.internships ?? null,
      coreCompetencies: args.coreCompetencies ?? null,
      earlyCareer: args.earlyCareer ?? null,
      additionalInfo: args.additionalInfo ?? null,
    };

    const template = args.template || "jake";
    const rank = await ctx.runQuery(internal.agent.fns.agentPlanRank, { userId: args.userId });
    const pdfArrayBuffer = await exportResumePdf(content, template, rank);
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
      template,
    });

    if (args.skipQuestions) return { id, name, fileUrl };
    const block = await questionsFor(ctx, { userId: args.userId, content, jobId: args.jobId, ai: args.aiQuestions });
    await savePending(ctx, args.userId, id, block.questions);
    return { id, name, fileUrl, ...block };
  },
});

export const resumesReplaceGenerated = internalMutation({
  args: {
    userId: v.string(),
    id: v.id("resumes"),
    fileId: v.id("_storage"),
    fileName: v.string(),
    fileSize: v.number(),
    content: v.any(),
    template: v.string(),
  },
  handler: async (ctx, { userId, id, ...rest }) => {
    const resume = await owned<any>(ctx, id, userId, "Resume");
    // Swap the stored PDF, dropping the old blob so storage doesn't accumulate
    // orphans on every regeneration.
    if (resume.fileId) await ctx.storage.delete(resume.fileId);
    await ctx.db.patch(id, {
      fileId: rest.fileId,
      fileName: rest.fileName,
      fileSize: rest.fileSize,
      fileType: "application/pdf",
      content: rest.content,
      template: rest.template,
      updatedAt: Date.now(),
    });
    return { id, name: resume.name };
  },
});

/**
 * Update an existing resume's content IN PLACE and regenerate its PDF.
 *
 * Only the sections passed are changed; everything else is carried over from the
 * stored content, so an agent can add one project without restating the resume.
 * The record keeps its id, name, label, favorite flag and created date — that is
 * the whole point of this endpoint versus `resumesGenerate`, which always makes a
 * new document.
 */
export const resumesUpdateContent = internalAction({
  args: {
    userId: v.string(),
    id: v.id("resumes"),
    personalInfo: v.optional(v.any()),
    education: v.optional(v.any()),
    experience: v.optional(v.any()),
    projects: v.optional(v.any()),
    skills: v.optional(v.any()),
    certifications: v.optional(v.any()),
    internships: v.optional(v.any()),
    coreCompetencies: v.optional(v.any()),
    earlyCareer: v.optional(v.any()),
    additionalInfo: v.optional(v.any()),
    template: v.optional(v.string()),
    jobId: v.optional(v.id("jobs")),
    aiQuestions: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ id: Id<"resumes">; name: string; fileUrl: string | null } & QuestionsBlock> => {
    const existing: any = await ctx.runQuery(internal.agent.fns.resumesGet, {
      userId: args.userId,
      id: args.id,
    });
    if (!existing) throw new AgentError(404, "not_found", "Resume not found");
    if (args.jobId) await ctx.runQuery(internal.agent.fns.jobsGet, { userId: args.userId, id: args.jobId });

    const prev = existing.content ?? {};
    const pick = <T,>(next: T | undefined, fallback: T): T => (next === undefined ? fallback : next);
    const content = {
      personalInfo: pick(args.personalInfo, prev.personalInfo ?? {}),
      education: pick(args.education, prev.education ?? []),
      experience: pick(args.experience, prev.experience ?? []),
      projects: pick(args.projects, prev.projects ?? []),
      skills: pick(args.skills, prev.skills ?? null),
      certifications: pick(args.certifications, prev.certifications ?? []),
      internships: pick(args.internships, prev.internships ?? null),
      coreCompetencies: pick(args.coreCompetencies, prev.coreCompetencies ?? null),
      earlyCareer: pick(args.earlyCareer, prev.earlyCareer ?? null),
      additionalInfo: pick(args.additionalInfo, prev.additionalInfo ?? null),
    };

    const template = args.template || existing.template || "jake";
    const rank = await ctx.runQuery(internal.agent.fns.agentPlanRank, { userId: args.userId });
    const pdfArrayBuffer = await exportResumePdf(content, template, rank);
    const pdfBlob = new Blob([pdfArrayBuffer], { type: "application/pdf" });

    const fileId = await ctx.storage.store(pdfBlob);
    const fileUrl = await ctx.storage.getUrl(fileId);

    const result: { id: Id<"resumes">; name: string } = await ctx.runMutation(
      internal.agent.fns.resumesReplaceGenerated,
      {
        userId: args.userId,
        id: args.id,
        fileId,
        fileName: existing.fileName || "resume.pdf",
        fileSize: pdfBlob.size,
        content,
        template,
      }
    );

    const block = await questionsFor(ctx, {
      userId: args.userId,
      content,
      jobId: args.jobId ?? existing.tailoredFrom?.jobId,
      ai: args.aiQuestions,
    });
    await savePending(ctx, args.userId, result.id, block.questions);
    return { id: result.id, name: result.name, fileUrl, ...block };
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

// ---- interview preps ----
const prepFields = {
  jobId: v.optional(v.id("jobs")),
  interviewerName: v.optional(v.string()),
  interviewerRole: v.optional(v.string()),
  interviewerEmail: v.optional(v.string()),
  interviewDate: v.optional(v.string()),
  meetingLink: v.optional(v.string()),
  phoneBackup: v.optional(v.string()),
  compensationTarget: v.optional(v.string()),
  resumeUsed: v.optional(v.string()),
  status: v.optional(v.string()),
  elevatorPitch: v.optional(v.string()),
  roleSummary: v.optional(v.string()),
  flashcards: v.optional(v.array(flashcardValidator)),
  stories: v.optional(v.array(storyValidator)),
  requirementMatches: v.optional(v.array(requirementMatchValidator)),
  questionsToAsk: v.optional(v.array(questionToAskValidator)),
  trapsAndGuardrails: v.optional(v.array(trapValidator)),
  checklist: v.optional(v.array(checklistItemValidator)),
  callNotes: v.optional(v.string()),
};

export const interviewPrepsList = internalQuery({
  args: { userId: v.string(), jobId: v.optional(v.id("jobs")) },
  handler: async (ctx, { userId, jobId }) => {
    const rows = await ctx.db
      .query("interviewPreps")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return rows
      .filter((r) => !jobId || r.jobId === jobId)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((r) => ({
        _id: r._id, company: r.company, role: r.role, status: r.status, jobId: r.jobId,
        interviewDate: r.interviewDate, interviewerName: r.interviewerName,
        flashcards: r.flashcards.length, stories: r.stories.length, updatedAt: r.updatedAt,
      }));
  },
});

export const interviewPrepsGet = internalQuery({
  args: { userId: v.string(), id: v.id("interviewPreps") },
  handler: async (ctx, { userId, id }) => owned(ctx, id, userId, "Interview prep"),
});

export const interviewPrepsAdd = internalMutation({
  args: { userId: v.string(), company: v.string(), role: v.string(), ...prepFields },
  handler: async (ctx, args) => {
    if (args.jobId) await owned(ctx, args.jobId, args.userId, "Job");
    const now = Date.now();
    return await ctx.db.insert("interviewPreps", {
      ...args,
      status: args.status ?? "upcoming",
      flashcards: args.flashcards ?? [],
      stories: args.stories ?? [],
      questionsToAsk: args.questionsToAsk ?? [],
      checklist: args.checklist ?? [],
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const interviewPrepsUpdate = internalMutation({
  args: {
    userId: v.string(),
    id: v.id("interviewPreps"),
    company: v.optional(v.string()),
    role: v.optional(v.string()),
    ...prepFields,
  },
  handler: async (ctx, { userId, id, ...fields }) => {
    await owned(ctx, id, userId, "Interview prep");
    if (fields.jobId) await owned(ctx, fields.jobId, userId, "Job");
    await ctx.db.patch(id, { ...definedOnly(fields), updatedAt: Date.now() });
  },
});

export const interviewPrepsRemove = internalMutation({
  args: { userId: v.string(), id: v.id("interviewPreps") },
  handler: async (ctx, { userId, id }) => {
    await owned(ctx, id, userId, "Interview prep");
    await ctx.db.delete(id);
  },
});
