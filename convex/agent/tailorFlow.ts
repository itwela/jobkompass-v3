"use node";
// Node runtime: imports lib/resume/tailorCore.ts, whose fact guard (noInventedFacts.ts)
// uses node:fs. Only convex/agent/tailor.ts (also "use node") imports this module.

/**
 * POST /agent/resumes/tailor, minus the Convex plumbing (convex/agent/tailor.ts wires the
 * real queries and storage in). Mirrors the in-app tailor routes: same pipeline
 * (lib/resume/tailorCore.ts), same instructions, template default, naming, tailoring
 * metadata and job "Resume used".
 */
import type { Id } from "../_generated/dataModel";
import {
  isPremiumRank,
  originalBaseId,
  pickTailorTemplateWithNotice,
  tailorAndSaveWith,
  tailorInstructions,
  type TailorAndSaveResult,
  type TailorStore,
} from "../../lib/resume/tailorCore";
import { AgentError } from "./auth";

export interface AgentTailorArgs {
  base: Id<"resumes">;
  jobId: Id<"jobs">;
  template?: string;
  /** One-off instruction for this resume (wording and emphasis, never facts). */
  instructions?: string;
  /** Replaces the account's saved resume preferences for this call. Omit to use the saved ones. */
  preferences?: string[];
}

export interface AgentTailorDeps {
  /** Owned-by-user lookups: throw "... not found" for another user's record. */
  getResume(id: Id<"resumes">): Promise<any>;
  getJob(id: Id<"jobs">): Promise<any>;
  settings(): Promise<{ resumePreferences: string[]; defaultTemplate: string | null; rank: number }>;
  canGenerate(): Promise<{ allowed: boolean; used?: number; limit?: number }>;
  spendAi(): Promise<void>;
  store: TailorStore;
  setJobResumeUsed(jobId: Id<"jobs">, resumeName: string): Promise<void>;
  fileUrl(storageId: Id<"_storage">): Promise<string | null>;
  /** Swappable for tests. */
  tailor?: typeof tailorAndSaveWith;
}

export interface AgentTailorResult {
  base: Id<"resumes">;
  template: string;
  /** Set when the requested template is above the plan and Jake was used instead. */
  notice?: string;
  instructions: string[];
  job: any;
  baseRow: any;
  result: TailorAndSaveResult;
  fileUrl: string | null;
}

function cleanPreferences(raw: unknown): string[] | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (!Array.isArray(raw) || raw.some((p) => typeof p !== "string")) {
    throw new AgentError(400, "invalid_param", "preferences must be a JSON array of strings", 'Example: ["Keep it to one page"]');
  }
  return raw.map((p: string) => p.trim()).filter(Boolean);
}

export async function agentTailor(deps: AgentTailorDeps, args: AgentTailorArgs): Promise<AgentTailorResult> {
  const preferencesOverride = cleanPreferences(args.preferences);

  let baseRow: any = await deps.getResume(args.base);
  const job: any = await deps.getJob(args.jobId);

  // An already-tailored resume is not a base: write from the original it came from,
  // with the answers saved there, like the app's re-run does.
  const originalId = originalBaseId(baseRow ?? {});
  if (originalId && originalId !== baseRow._id) {
    const original = await deps.getResume(originalId).catch(() => null);
    if (!original) {
      throw new AgentError(
        404,
        "not_found",
        "That resume was tailored from a base resume that is no longer saved.",
        "Pass your base resume as 'base' (jk resumes list shows it)."
      );
    }
    baseRow = original;
  }
  if (!baseRow?.content) {
    throw new Error("Resume has no structured content to tailor. Pick a resume created by JobKompass (jk resumes get shows content).");
  }

  // Check the monthly document quota BEFORE spending a model call.
  const can = await deps.canGenerate();
  if (!can.allowed) throw new Error(`Limit reached: you've used ${can.used} of ${can.limit} documents this month.`);
  const settings = await deps.settings();
  await deps.spendAi();

  // An explicit template above the plan falls back to Jake with a notice (never a 402).
  const { template, notice } = pickTailorTemplateWithNotice({
    explicit: args.template,
    accountDefault: settings.defaultTemplate,
    baseTemplate: baseRow.template,
    rank: settings.rank,
  });
  const instructions = tailorInstructions(preferencesOverride ?? settings.resumePreferences, args.instructions);

  const result = await (deps.tailor ?? tailorAndSaveWith)(deps.store, {
    baseResume: { _id: baseRow._id, name: baseRow.name, content: baseRow.content, bulletAnswers: baseRow.bulletAnswers },
    job: {
      _id: job._id,
      title: job.title ?? "",
      company: job.company ?? "",
      description: job.description,
      skills: job.skills,
      keywords: job.keywords,
    },
    templateId: template,
    premium: isPremiumRank(settings.rank),
    instructions,
  });

  await deps.setJobResumeUsed(job._id, result.displayName).catch(() => undefined);
  const fileUrl = await deps.fileUrl(result.storageId).catch(() => null);

  return { base: baseRow._id, template, ...(notice ? { notice } : {}), instructions, job, baseRow, result, fileUrl };
}
