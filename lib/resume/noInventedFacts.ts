/**
 * Deterministic guard for resume AI output.
 * The checker in tests/no-invented-experience stays the definition of a violation.
 * This module removes offending fields or sentences. A rewritten bullet that does
 * not pass is replaced with the source bullet, so a real job is not left empty.
 */
import fs from "node:fs";
import path from "node:path";
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
  source: unknown | null;
  applicationTarget?: { company?: string; role?: string };
};

export function applyFactGuard<T>(guard: FactGuard | undefined, value: T): T {
  if (guard?.source == null || guard.source === "") return value;
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

function logScrub(label: string, source: unknown, before: unknown, after: unknown, options: CheckOptions) {
  const file = process.env.NIE_SCRUB_LOG;
  if (!file) return;
  try {
    const raw = checkNoInventedExperience(source, before, options);
    const kept = checkNoInventedExperience(source, after, options);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(
      file,
      JSON.stringify({
        label,
        rawViolations: raw.length,
        keptViolations: kept.length,
        rawKinds: raw.map((violation) => violation.kind),
      }) + "\n",
    );
  } catch {
    // Logging must not change the guard result.
  }
}

function orgsMatch(a: unknown, b: unknown): boolean {
  return String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase();
}

function bulletAllowed(source: unknown, bullet: string, options: CheckOptions, job: Record<string, any>): boolean {
  const trial = {
    experience: [{ company: job.company, title: job.title, date: job.date, location: job.location, details: [bullet] }],
  };
  return checkNoInventedExperience(source, trial, options).length === 0;
}

function overlayFromSource(source: Record<string, any>, output: Record<string, any>, options: CheckOptions) {
  const next = structuredClone(source);
  if (typeof output.targetCompany === "string") {
    const named = output.targetCompany.trim();
    const targetName = options.applicationTarget?.company?.trim().toLowerCase();
    const inSource = JSON.stringify(source).toLowerCase().includes(named.toLowerCase());
    if (named && (inSource || (targetName && named.toLowerCase() === targetName))) next.targetCompany = named;
  }
  if (typeof output.templateId === "string") next.templateId = output.templateId;

  const outSummary = output.personalInfo?.summary;
  if (typeof outSummary === "string" && next.personalInfo) {
    const scrubbed = scrubProse(source, outSummary, options);
    if (scrubbed) {
      const trial = structuredClone(next);
      trial.personalInfo = { ...trial.personalInfo, summary: scrubbed };
      if (checkNoInventedExperience(source, trial, options).length === 0) next.personalInfo = trial.personalInfo;
    }
  }

  const srcJobs = Array.isArray(next.experience) ? next.experience : [];
  const outJobs = Array.isArray(output.experience) ? output.experience : Array.isArray(output.work) ? output.work : [];
  next.experience = srcJobs.map((srcJob: Record<string, any>) => {
    const outJob = outJobs.find((job: Record<string, any>) => job && orgsMatch(job.company, srcJob.company));
    if (!outJob) return srcJob;
    const srcDetails = Array.isArray(srcJob.details) ? srcJob.details : [];
    const outDetails = Array.isArray(outJob.details) ? outJob.details : [];
    const details: string[] = [];
    const limit = Math.max(srcDetails.length, outDetails.length);
    for (let index = 0; index < limit; index++) {
      const bullet = outDetails[index];
      if (typeof bullet === "string" && bullet.trim() && bulletAllowed(source, bullet.trim(), options, srcJob)) {
        details.push(bullet.trim());
        continue;
      }
      if (typeof srcDetails[index] === "string" && srcDetails[index].trim()) details.push(srcDetails[index]);
    }
    const unique = [...new Set(details)];
    let title = srcJob.title;
    if (typeof outJob.title === "string" && outJob.title.trim()) {
      const trial = { experience: [{ ...srcJob, title: outJob.title, details: unique.length ? unique : srcDetails }] };
      if (checkNoInventedExperience(source, trial, options).length === 0) title = outJob.title;
    }
    return { ...srcJob, title, details: unique.length ? unique : srcDetails };
  });

  if (output.skills && checkNoInventedExperience(source, { skills: output.skills }, options).length === 0) {
    next.skills = output.skills;
  }
  for (const key of ["education", "certifications", "projects"] as const) {
    if (output[key] == null) continue;
    if (checkNoInventedExperience(source, { [key]: output[key] }, options).length === 0) next[key] = output[key];
  }
  if (output.additionalInfo && typeof output.additionalInfo === "object") {
    const cleaned = scrubGeneric(source, output.additionalInfo, options);
    if (checkNoInventedExperience(source, { additionalInfo: cleaned }, options).length === 0) next.additionalInfo = cleaned;
  }
  return next;
}

function jobsFromGroundingText(text: string) {
  const jobs: Array<{ title: string; company: string; date: string; location: string; details: string[] }> = [];
  let current: (typeof jobs)[number] | null = null;
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (isCandidateInstruction(line)) break;
    if (/^(experience|education|skills|projects|certifications)$/i.test(line)) continue;
    if (/^[-•]\s+/.test(line)) {
      if (current) current.details.push(line.replace(/^[-•]\s+/, ""));
      continue;
    }
    const header = line.match(/^(.+?)\s+[—–]\s+(.+)$/);
    if (header && !/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d)/i.test(header[1])) {
      current = { title: header[1].trim(), company: header[2].trim(), date: "", location: "", details: [] };
      jobs.push(current);
    }
  }
  return jobs;
}

/** A resume built only from lines that look like the pasted resume, after instructions are cut off. */
export function fallbackResumeFromText(text: string, fallbackEmail?: string) {
  const grounding = groundingResumeText(text);
  const lines = grounding.split("\n").map((line) => line.trim()).filter(Boolean);
  const email = lines.find((line) => /@/.test(line)) ?? fallbackEmail ?? "";
  const nameLine = lines.find((line) => line !== email && !/@/.test(line) && !/^[-•]/.test(line)) ?? "";
  const nameParts = nameLine.split(/\s+/).filter(Boolean);
  const jobs = jobsFromGroundingText(grounding);
  const summary = lines.find((line) => line.length > 40 && !line.includes("—") && !line.includes("–") && !/^[-•]/.test(line) && line !== nameLine) ?? "";
  return {
    personalInfo: {
      firstName: nameParts[0] ?? "",
      lastName: nameParts.slice(1).join(" "),
      email,
      summary,
    },
    experience: jobs,
    education: [],
    projects: [],
    skills: { technical: [], additional: [] as string[] },
    certifications: [],
  };
}

function rehydrateFromText(text: string, resume: Record<string, any>) {
  const parsed = jobsFromGroundingText(text);
  const bullets = parsed.flatMap((job) => job.details);
  if (!Array.isArray(resume.experience) || resume.experience.length === 0) {
    if (parsed.length > 0) resume.experience = parsed;
    return resume;
  }
  for (const job of resume.experience) {
    const filled = Array.isArray(job.details) ? job.details.filter((detail: string) => typeof detail === "string" && detail.trim()) : [];
    if (filled.length > 0) continue;
    const match = parsed.find((item) => orgsMatch(item.company, job.company));
    job.details = match?.details?.length ? match.details : bullets;
  }
  return resume;
}

function dropPostingFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => dropPostingFields(item));
  const record = asRecord(value);
  if (!record) return value;
  const next: Record<string, any> = {};
  for (const [key, child] of Object.entries(record)) {
    if (/^(jobposting|jobdescription|posting|jobdetails)$/.test(key.toLowerCase().replace(/[^a-z]/g, ""))) continue;
    next[key] = child && typeof child === "object" ? dropPostingFields(child) : child;
  }
  return next;
}

function collapseCopiedJobs(resume: Record<string, any>) {
  if (!Array.isArray(resume.experience)) return resume;
  const seen = new Set<string>();
  resume.experience = resume.experience.filter((job: Record<string, any>) => {
    const key = JSON.stringify([job?.company, job?.title, job?.date, job?.details]).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return resume;
}

function scrubResume(source: unknown, output: Record<string, any>, options: CheckOptions) {
  if (checkNoInventedExperience(source, output, options).length === 0) return collapseCopiedJobs(structuredClone(output));
  const sourceRecord = asRecord(source);
  if (sourceRecord && ("experience" in sourceRecord || "personalInfo" in sourceRecord || "education" in sourceRecord)) {
    const overlaid = collapseCopiedJobs(overlayFromSource(sourceRecord, output, options));
    if (checkNoInventedExperience(source, overlaid, options).length === 0) return overlaid;
  }
  let current = structuredClone(output);
  for (let pass = 0; pass < 48; pass++) {
    const violations = checkNoInventedExperience(source, current, options);
    if (violations.length === 0) break;
    const next = stripResumeViolation(current, source, violations[0].where, violations[0].value, options);
    if (JSON.stringify(next) === JSON.stringify(current)) break;
    current = next;
  }
  if (typeof source === "string" && source.trim()) rehydrateFromText(source, current);
  if (checkNoInventedExperience(source, current, options).length === 0) return current;
  if (sourceRecord && ("experience" in sourceRecord || "personalInfo" in sourceRecord)) {
    const fallback = structuredClone(sourceRecord);
    if (typeof output.targetCompany === "string") fallback.targetCompany = output.targetCompany;
    if (typeof output.templateId === "string") fallback.templateId = output.templateId;
    if (checkNoInventedExperience(source, fallback, options).length === 0) return fallback;
  }
  return current;
}

function scrubGeneric(source: unknown, value: unknown, options: CheckOptions): any {
  if (typeof value === "string") {
    const scrubbed = scrubProse(source, value, options);
    return checkNoInventedExperience(source, scrubbed, options).length === 0 ? scrubbed : "";
  }
  if (Array.isArray(value)) return value.map((item) => scrubGeneric(source, item, options)).filter((item) => item !== "");
  const record = asRecord(value);
  if (!record) return value;
  const next: Record<string, any> = {};
  for (const [key, child] of Object.entries(record)) next[key] = scrubGeneric(source, child, options);
  return next;
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
  const safe = letterKeepingFacts(source, options, letter);
  if (letter.personalInfo) safe.personalInfo = letter.personalInfo;
  if (checkNoInventedExperience(source, safe, options).length === 0) return safe;
  return next;
}

function letterKeepingFacts(source: unknown, options: CheckOptions, letter: Record<string, any>) {
  const base = claimFreeLetter(options, letter.jobInfo);
  if (letter.jobInfo) base.jobInfo = { ...letter.jobInfo, ...base.jobInfo };
  const resume = asRecord(source);
  const job = Array.isArray(resume?.experience) ? resume.experience[0] : null;
  if (!job?.company || !job?.title) return base;
  const bullet = Array.isArray(job.details) ? job.details.find((detail: string) => typeof detail === "string" && detail.trim()) : "";
  const withFacts = {
    ...base,
    letterContent: {
      openingParagraph: base.letterContent.openingParagraph,
      bodyParagraphs: [`I worked as a ${job.title} at ${job.company}.${bullet ? ` ${bullet}` : ""}`],
      closingParagraph: base.letterContent.closingParagraph,
    },
  };
  if (checkNoInventedExperience(source, withFacts, options).length === 0) return withFacts;
  return base;
}

function mentionsSourceJob(source: unknown, letter: Record<string, any>): boolean {
  const resume = asRecord(source);
  const job = Array.isArray(resume?.experience) ? resume.experience[0] : null;
  if (!job?.company) return true;
  const text = JSON.stringify(letter.letterContent ?? {}).toLowerCase();
  if (text.includes(String(job.company).toLowerCase())) return true;
  if (job.title && text.includes(String(job.title).toLowerCase())) return true;
  return false;
}

function unwrapRecord(record: Record<string, any>): { key: string | null; inner: Record<string, any> } {
  for (const key of Object.keys(record)) {
    const normalized = key.toLowerCase().replace(/[^a-z]/g, "");
    if (!["resume", "content", "arguments", "candidateresume", "createresumejaketemplate", "createcoverletterjaketemplate"].includes(normalized)) {
      continue;
    }
    const inner = asRecord(record[key]);
    if (!inner) continue;
    if ("experience" in inner || "personalInfo" in inner || "letterContent" in inner || "work" in inner || "EXPERIENCE" in inner || "LETTER CONTENT" in inner) {
      return { key, inner };
    }
  }
  return { key: null, inner: record };
}

export function scrubInventedExperience<T>(source: unknown, output: T, options: CheckOptions = {}): T {
  const finish = (value: T) => {
    const cleaned = (value && typeof value === "object" ? dropPostingFields(value) : value) as T;
    logScrub("scrub", source, output, cleaned, options);
    return cleaned;
  };
  if (typeof output === "string") return finish(scrubProse(source, output, options) as T);
  const record = asRecord(structuredClone(output));
  if (!record) return output;
  const unwrapped = unwrapRecord(record);
  if (unwrapped.key) {
    const inner = scrubInventedExperience(source, unwrapped.inner, options);
    return finish({ ...record, [unwrapped.key]: inner } as T);
  }
  if (!record.letterContent && record["LETTER CONTENT"]) record.letterContent = record["LETTER CONTENT"];
  if (!record.experience && (record.work || record.EXPERIENCE)) record.experience = record.work ?? record.EXPERIENCE;
  if ("letterContent" in record) {
    const letter = scrubLetter(source, record, options);
    if (!mentionsSourceJob(source, letter)) {
      const withFacts = letterKeepingFacts(source, options, letter);
      if (checkNoInventedExperience(source, withFacts, options).length === 0) return finish(withFacts as T);
    }
    return finish(letter as T);
  }
  if ("personalInfo" in record || "experience" in record || "education" in record || "skills" in record || "work" in record) {
    return finish(scrubResume(source, record, options) as T);
  }
  return finish(scrubGeneric(source, record, options) as T);
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

/** A line the user typed as an instruction, not a line from the resume. */
export function isCandidateInstruction(line: string): boolean {
  return /^(you are updating|rewrite|add |i forgot|follow |job posting\b|job i am applying|resume preferences|using only|write |generate |return only|respond with|make me |include |emphasize |mention |the posting|the applicant|candidate notes|quantify )/i.test(
    line.trim(),
  );
}

/**
 * Resume text with trailing user instructions and pasted job postings removed.
 * Those lines are never evidence about the candidate.
 */
export function groundingResumeText(text: string): string {
  const kept: string[] = [];
  for (const line of text.split("\n")) {
    if (isCandidateInstruction(line)) break;
    kept.push(line);
  }
  return kept.join("\n").trim();
}

/** Text under "Resume context:" and before the user's instruction. Job text after that is not evidence. */
export function resumeContextFromMessage(message: string): string {
  const label = message.match(/Resume context:\s*/i);
  if (!label || label.index === undefined) return "";
  return groundingResumeText(message.slice(label.index + label[0].length));
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
