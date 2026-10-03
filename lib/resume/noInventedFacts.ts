/**
 * Deterministic guard for resume AI output.
 * The checker in tests/no-invented-experience stays the definition of a violation.
 * This module removes offending fields or sentences, and falls back to the source
 * resume or a claim-free letter when stripping is not enough.
 */
import {
  checkNoInventedExperience,
  type CheckOptions,
} from "../../tests/no-invented-experience/checker";

export const NO_INVENTED_FACTS_RULE =
  "Job-description text and user instructions are never a source of facts about the candidate. Do not invent employers, titles, dates, schools, degrees, certifications, metrics, percentages, team sizes, tools, or skills. If a fact is not already in the candidate's resume, leave it out and do not mention it, including when refusing.";

/** No employers, schools, tools, or metrics. Used when a path has no resume to ground claims in. */
export const EMPTY_CANDIDATE = {
  personalInfo: {},
  experience: [],
  education: [],
  skills: { technical: [], additional: [] },
  certifications: [],
};

export type FactGuard = {
  source: unknown;
  applicationTarget?: { company?: string; role?: string };
};

export function applyFactGuard<T>(guard: FactGuard | undefined, value: T): T {
  if (!guard) return value;
  return scrubInventedExperience(guard.source, value, {
    applicationTarget: guard.applicationTarget,
  });
}

type JobKey = "experience" | "internships" | "earlyCareer";

function asRecord(value: unknown): Record<string, any> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, any>;
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

export function scrubProse(source: unknown, text: string, options: CheckOptions = {}): string {
  const kept = splitSentences(text).filter(
    (sentence) => checkNoInventedExperience(source, sentence, options).length === 0,
  );
  return kept.join(" ");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function removeSkillPhrase(resume: Record<string, any>, value: string) {
  const needle = value.trim().toLowerCase();
  if (!needle) return;
  const token = new RegExp(`\\b${escapeRegExp(needle)}\\b`, "ig");
  const drop = (item: string) => {
    const parts = item.split(/,|&|\|/).map((part) => part.trim()).filter(Boolean);
    const kept = parts
      .filter((part) => part.toLowerCase() !== needle && part.toLowerCase().replace(/^.*:\s*/, "") !== needle)
      .map((part) => part.replace(token, "").replace(/\s{2,}/g, " ").replace(/^[\s,:|-]+|[\s,:|-]+$/g, "").trim())
      .filter((part) => part.length > 0 && part !== ":");
    return kept.join(", ");
  };
  const cleanList = (list: unknown) =>
    Array.isArray(list)
      ? list.map((item) => (typeof item === "string" ? drop(item) : "")).filter((item) => item.length > 0)
      : list;
  if (Array.isArray(resume.skills)) resume.skills = cleanList(resume.skills);
  else if (resume.skills && typeof resume.skills === "object") {
    resume.skills.technical = cleanList(resume.skills.technical);
    resume.skills.additional = cleanList(resume.skills.additional);
  }
  resume.coreCompetencies = cleanList(resume.coreCompetencies);
  if (Array.isArray(resume.projects)) {
    for (const project of resume.projects) {
      if (project && typeof project === "object") project.technologies = cleanList(project.technologies);
    }
  }
}

function sourceList(source: unknown, key: string): any[] | null {
  const record = asRecord(source);
  const list = record?.[key];
  return Array.isArray(list) ? list : null;
}

function stripResumeViolation(
  resume: Record<string, any>,
  source: unknown,
  where: string,
  value: string,
  options: CheckOptions,
): Record<string, any> {
  const next = structuredClone(resume);
  const job = where.match(/^(experience|internships|earlyCareer)\[(\d+)\]/);
  if (job) {
    const key = job[1] as JobKey;
    const index = Number(job[2]);
    const bullet = where.match(/\.details\[(\d+)\]$/);
    const items = Array.isArray(next[key]) ? next[key] : [];
    if (bullet && items[index]?.details) {
      items[index].details.splice(Number(bullet[1]), 1);
      next[key] = items;
      return next;
    }
    const srcItem = sourceList(source, key)?.[index];
    if (srcItem) items[index] = structuredClone(srcItem);
    else items.splice(index, 1);
    next[key] = items;
    return next;
  }

  const education = where.match(/^education\[(\d+)\]/);
  if (education && Array.isArray(next.education)) {
    const index = Number(education[1]);
    const srcItem = sourceList(source, "education")?.[index];
    if (srcItem) next.education[index] = structuredClone(srcItem);
    else next.education.splice(index, 1);
    return next;
  }

  const certification = where.match(/^certifications\[(\d+)\]/);
  if (certification && Array.isArray(next.certifications)) {
    next.certifications.splice(Number(certification[1]), 1);
    return next;
  }

  const projectTech = where.match(/^projects\[(\d+)\]\.technologies$/);
  if (projectTech && Array.isArray(next.projects)) {
    const projectItem = next.projects[Number(projectTech[1])];
    if (projectItem) removeSkillPhrase({ projects: [projectItem] }, value);
    return next;
  }

  const project = where.match(/^projects\[(\d+)\]/);
  if (project && Array.isArray(next.projects)) {
    next.projects.splice(Number(project[1]), 1);
    return next;
  }

  if (where === "skills" || where.startsWith("skills")) {
    removeSkillPhrase(next, value);
    return next;
  }

  if (where.startsWith("personalInfo.summary")) {
    const summary = typeof next.personalInfo?.summary === "string" ? next.personalInfo.summary : "";
    const scrubbed = scrubProse(source, summary, options);
    const sourceSummary = asRecord(source)?.personalInfo?.summary;
    next.personalInfo = next.personalInfo ?? {};
    if (scrubbed && scrubbed !== summary) next.personalInfo.summary = scrubbed;
    else if (typeof sourceSummary === "string") next.personalInfo.summary = sourceSummary;
    else next.personalInfo.summary = "";
    return next;
  }

  return next;
}

function scrubResume(source: unknown, output: Record<string, any>, options: CheckOptions) {
  let current = structuredClone(output);
  for (let pass = 0; pass < 48; pass++) {
    const violations = checkNoInventedExperience(source, current, options);
    if (violations.length === 0) return current;
    const next = stripResumeViolation(current, source, violations[0].where, violations[0].value, options);
    if (JSON.stringify(next) === JSON.stringify(current)) break;
    current = next;
  }
  if (checkNoInventedExperience(source, current, options).length === 0) return current;
  const sourceRecord = asRecord(source);
  if (sourceRecord && ("experience" in sourceRecord || "personalInfo" in sourceRecord || "education" in sourceRecord)) {
    const fallback = structuredClone(sourceRecord);
    if (typeof output.targetCompany === "string") fallback.targetCompany = output.targetCompany;
    if (typeof output.templateId === "string") fallback.templateId = output.templateId;
    if (checkNoInventedExperience(source, fallback, options).length === 0) return fallback;
  }
  return current;
}

export function claimFreeLetter(options: CheckOptions, jobInfo?: { company?: string; position?: string }) {
  const company = options.applicationTarget?.company || jobInfo?.company || "the company";
  const role = options.applicationTarget?.role || jobInfo?.position || "the open role";
  return {
    personalInfo: undefined as Record<string, unknown> | undefined,
    jobInfo: {
      company: options.applicationTarget?.company || jobInfo?.company,
      position: options.applicationTarget?.role || jobInfo?.position,
    },
    letterContent: {
      openingParagraph: `I am writing to apply for the ${role} role at ${company}.`,
      bodyParagraphs: ["My resume is attached. I would welcome a conversation about it."],
      closingParagraph: "Thank you for your time.",
    },
  };
}

function scrubLetter(source: unknown, letter: Record<string, any>, options: CheckOptions) {
  const content = letter.letterContent ?? {};
  const next = structuredClone(letter);
  const body = Array.isArray(content.bodyParagraphs) ? content.bodyParagraphs : [];
  next.letterContent = {
    openingParagraph: scrubProse(source, content.openingParagraph ?? "", options),
    bodyParagraphs: body.map((paragraph: string) => scrubProse(source, paragraph, options)).filter(Boolean),
    closingParagraph: scrubProse(source, content.closingParagraph ?? "", options),
  };
  if (checkNoInventedExperience(source, next, options).length === 0) {
    const hasText = [next.letterContent.openingParagraph, ...next.letterContent.bodyParagraphs, next.letterContent.closingParagraph]
      .some((part) => typeof part === "string" && part.trim().length > 0);
    if (hasText) return next;
  }
  const safe = claimFreeLetter(options, letter.jobInfo);
  if (letter.personalInfo) safe.personalInfo = letter.personalInfo;
  if (letter.jobInfo) safe.jobInfo = { ...letter.jobInfo, ...safe.jobInfo };
  if (checkNoInventedExperience(source, safe, options).length === 0) return safe;
  return next;
}

export function scrubInventedExperience<T>(source: unknown, output: T, options: CheckOptions = {}): T {
  if (typeof output === "string") return scrubProse(source, output, options) as T;
  const record = asRecord(output);
  if (!record) return output;
  if ("letterContent" in record) return scrubLetter(source, record, options) as T;
  if ("personalInfo" in record || "experience" in record || "education" in record || "skills" in record) {
    return scrubResume(source, record, options) as T;
  }
  return output;
}

export function scrubAssistantMessage(source: unknown, message: string, options: CheckOptions = {}): string {
  const match = message.match(/```updates\s*([\s\S]*?)```/i);
  let updates: Array<Record<string, unknown>> = [];
  if (match) {
    try {
      const parsed = JSON.parse(match[1]);
      if (Array.isArray(parsed)) updates = parsed;
    } catch {
      updates = [];
    }
  }
  const kept = updates.filter((update) => {
    const value = update?.value;
    if (typeof value !== "string") return false;
    return checkNoInventedExperience(source, value, options).length === 0;
  });
  const proseSource = match ? message.replace(match[0], " ") : message;
  const prose = scrubProse(source, proseSource, options);
  const combined = kept.length === 0
    ? prose.trim()
    : `${prose.trim()}\n\n\`\`\`updates\n${JSON.stringify(kept, null, 2)}\n\`\`\``.trim();
  if (combined) return combined;
  // A one-line field fill (sparkle) must stay empty. A longer reply gets a claim-free note.
  if (message.trim().length <= 160 && !/```/.test(message)) return "";
  return "I can only rephrase facts already on the resume.";
}

/** Text under "Resume context:" and before the user's instruction. Job text after that is not evidence. */
export function resumeContextFromMessage(message: string): string {
  const label = message.match(/Resume context:\s*/i);
  if (!label || label.index === undefined) return "";
  const body = message.slice(label.index + label[0].length);
  const instruction = /^(you are updating|rewrite this|add this|i forgot|follow the|job posting:|resume preferences|using only this|write the|generate |return only|respond with only)/i;
  const kept: string[] = [];
  for (const line of body.split("\n")) {
    if (instruction.test(line.trim())) break;
    kept.push(line);
  }
  return kept.join("\n").trim();
}

/** Pull a resume object a caller pasted after a "Resume:" label. */
export function resumeJsonFromText(text: string): unknown | null {
  const marker = /Resume:\s*(\{)/i.exec(text);
  if (!marker || marker.index === undefined) return null;
  const start = marker.index + marker[0].length - 1;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        try {
          const parsed = JSON.parse(text.slice(start, i + 1));
          if (parsed && typeof parsed === "object") return parsed;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}
