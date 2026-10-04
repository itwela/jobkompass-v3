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
  resumeEvidenceLines,
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
  if (!guard) return value;
  const source = guard.source == null || guard.source === "" ? EMPTY_CANDIDATE : guard.source;
  return scrubInventedExperience(source, value, {
    applicationTarget: guard.applicationTarget,
  });
}

function parseModelPayload(rawText: string): unknown {
  const trimmed = rawText.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  if (candidate.startsWith("{") || candidate.startsWith("[")) {
    try {
      return JSON.parse(candidate);
    } catch {
      return rawText;
    }
  }
  return rawText;
}

/**
 * Guard one chat turn. The source is a saved resume or Resume: JSON in this
 * message. Earlier conversation turns are not a source. With neither, the
 * turn is still scrubbed against an empty candidate so invented employers,
 * dates, and durations are not returned.
 */
export function guardChatTurn(input: {
  message: string;
  rawText: string;
  savedResume?: unknown | null;
}): { saved: unknown; streamed: string; toolArguments: unknown; guardOn: boolean } {
  const pasted = resumeJsonFromText(input.message);
  const source = input.savedResume ?? pasted ?? null;
  const guardOn = source != null;
  const saved = scrubInventedExperience(guardOn ? source : EMPTY_CANDIDATE, parseModelPayload(input.rawText));
  const streamed = typeof saved === "string" ? saved : JSON.stringify(saved, null, 2);
  return { saved, streamed, toolArguments: saved, guardOn };
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

type GroundedJob = { title: string; company: string; date: string; location: string; details: string[] };
type GroundedSchool = { name: string; degree: string; startDate: string; endDate: string; details: string[] };
type GroundedCert = { name: string; issuer: string; date: string };

function sectionName(line: string): "experience" | "education" | "skills" | "certs" | "projects" | null {
  if (/^(experience|work experience)$/i.test(line)) return "experience";
  if (/^education$/i.test(line)) return "education";
  if (/^skills$/i.test(line)) return "skills";
  if (/^certifications?$/i.test(line)) return "certs";
  if (/^projects$/i.test(line)) return "projects";
  return null;
}

function headerParts(line: string): { left: string; right: string } | null {
  const header = line.match(/^(.+?)\s+[—–]\s+(.+)$/);
  if (!header) return null;
  if (/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d)/i.test(header[1])) return null;
  return { left: header[1].trim(), right: header[2].trim() };
}

function assignYearRange(school: { startDate: string; endDate: string }, line: string) {
  const years = line.match(/\b(?:19|20)\d{2}\b/g) ?? [];
  if (years.length >= 2) {
    school.startDate = years[0] ?? "";
    school.endDate = years[years.length - 1] ?? "";
  } else if (years.length === 1 && !school.endDate) {
    school.endDate = years[0] ?? "";
  }
}

/** Experience headers are jobs. Education and certification headers stay in those sections. */
function parseGrounding(text: string) {
  const jobs: GroundedJob[] = [];
  const education: GroundedSchool[] = [];
  const certifications: GroundedCert[] = [];
  const skills: string[] = [];
  let section: "header" | "experience" | "education" | "skills" | "certs" | "projects" = "header";
  let currentJob: GroundedJob | null = null;
  let currentSchool: GroundedSchool | null = null;
  for (const raw of groundingResumeText(text).split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const nextSection = sectionName(line);
    if (nextSection) {
      section = nextSection;
      currentJob = null;
      currentSchool = null;
      continue;
    }
    if (/^[-•]\s+/.test(line)) {
      const bullet = line.replace(/^[-•]\s+/, "");
      if ((section === "experience" || section === "header") && currentJob) currentJob.details.push(bullet);
      else if (section === "education" && currentSchool) currentSchool.details.push(bullet);
      continue;
    }
    const header = headerParts(line);
    if (section === "education") {
      if (header) {
        currentSchool = { degree: header.left, name: header.right, startDate: "", endDate: "", details: [] };
        education.push(currentSchool);
      } else if (currentSchool) assignYearRange(currentSchool, line);
      continue;
    }
    if (section === "certs") {
      if (header) {
        certifications.push({ name: header.left, issuer: header.right, date: "" });
        continue;
      }
      const year = line.match(/\b((?:19|20)\d{2})\b/);
      const last = certifications[certifications.length - 1];
      if (year && last && !last.date) last.date = year[1];
      continue;
    }
    if (section === "skills") {
      skills.push(...line.split(",").map((part) => part.trim()).filter(Boolean));
      continue;
    }
    if (section === "projects") continue;
    if (header) {
      currentJob = { title: header.left, company: header.right, date: "", location: "", details: [] };
      jobs.push(currentJob);
      if (section === "header") section = "experience";
      continue;
    }
    if (currentJob && !currentJob.date && (/\b(?:19|20)\d{2}\b/.test(line) || /\bpresent\b/i.test(line))) {
      const [date, location] = line.split("|").map((part) => part.trim());
      currentJob.date = date;
      if (location) currentJob.location = location;
    }
  }
  return { jobs, education, certifications, skills };
}

function jobsFromGroundingText(text: string) {
  return parseGrounding(text).jobs;
}

function sameLabel(a: unknown, b: unknown): boolean {
  return String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase();
}

function educationFromGrounding(education: GroundedSchool[]) {
  return education.map((school) => ({
    name: school.name,
    degree: school.degree,
    field: null as string | null,
    startDate: school.startDate || null,
    endDate: school.endDate,
    details: school.details,
  }));
}

/**
 * A model (or the text fallback) sometimes files "GED — School" and
 * "Cert — Issuer" as extra jobs. Put them back in education and certifications.
 */
function restoreSectionsFromText(text: string, resume: Record<string, any>) {
  const parsed = parseGrounding(text);
  if (Array.isArray(resume.experience)) {
    resume.experience = resume.experience.filter((job: Record<string, any>) => {
      const school = parsed.education.some((item) => sameLabel(item.degree, job?.title) && sameLabel(item.name, job?.company));
      const cert = parsed.certifications.some((item) => sameLabel(item.name, job?.title) && sameLabel(item.issuer, job?.company));
      return !school && !cert;
    });
  }
  if (!Array.isArray(resume.education) || resume.education.length === 0) {
    resume.education = educationFromGrounding(parsed.education);
  }
  if (!Array.isArray(resume.certifications) || resume.certifications.length === 0) {
    resume.certifications = parsed.certifications.map((cert) => ({ name: cert.name, issuer: cert.issuer, date: cert.date }));
  }
  const technical = Array.isArray(resume.skills?.technical) ? resume.skills.technical : [];
  const additional = Array.isArray(resume.skills?.additional) ? resume.skills.additional : [];
  const listed = Array.isArray(resume.skills) ? resume.skills : [];
  if (technical.length + additional.length + listed.length === 0 && parsed.skills.length > 0) {
    resume.skills = { technical: [], additional: parsed.skills };
  }
  return resume;
}

/** A resume built only from lines that look like the pasted resume, after instructions are cut off. */
export function fallbackResumeFromText(text: string, fallbackEmail?: string) {
  const grounding = groundingResumeText(text);
  const lines = grounding.split("\n").map((line) => line.trim()).filter(Boolean);
  const email = lines.find((line) => /@/.test(line)) ?? fallbackEmail ?? "";
  const nameLine = lines.find((line) => line !== email && !/@/.test(line) && !/^[-•]/.test(line)) ?? "";
  const nameParts = nameLine.split(/\s+/).filter(Boolean);
  const parsed = parseGrounding(grounding);
  const summary = lines.find((line) => line.length > 40 && !line.includes("—") && !line.includes("–") && !/^[-•]/.test(line) && line !== nameLine) ?? "";
  return {
    personalInfo: {
      firstName: nameParts[0] ?? "",
      lastName: nameParts.slice(1).join(" "),
      email,
      summary,
    },
    experience: parsed.jobs,
    education: educationFromGrounding(parsed.education),
    projects: [],
    skills: { technical: [] as string[], additional: parsed.skills },
    certifications: parsed.certifications.map((cert) => ({ name: cert.name, issuer: cert.issuer, date: cert.date })),
  };
}

function rehydrateFromText(text: string, resume: Record<string, any>) {
  const parsed = jobsFromGroundingText(text);
  if (!Array.isArray(resume.experience) || resume.experience.length === 0) {
    if (parsed.length > 0) resume.experience = parsed;
    return resume;
  }
  for (const job of resume.experience) {
    const match = parsed.find((item) => orgsMatch(item.company, job.company));
    if (!match) continue;
    const filled = Array.isArray(job.details) ? job.details.filter((detail: string) => typeof detail === "string" && detail.trim()) : [];
    if (filled.length === 0 && match.details.length > 0) job.details = match.details;
    if (!String(job.date ?? "").trim() && match.date) job.date = match.date;
    if (!String(job.location ?? "").trim() && match.location) job.location = match.location;
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
  const kept: Record<string, any>[] = [];
  for (const job of resume.experience) {
    const company = String(job?.company ?? "").trim().toLowerCase();
    const date = String(job?.date ?? "").trim().toLowerCase();
    const details = (Array.isArray(job?.details) ? job.details : []).map((detail: unknown) => String(detail).trim().toLowerCase());
    const sameEmployerAndDates = kept.some((prev) => {
      const prevCompany = String(prev?.company ?? "").trim().toLowerCase();
      const prevDate = String(prev?.date ?? "").trim().toLowerCase();
      return company.length > 0 && company === prevCompany && date.length > 0 && date === prevDate;
    });
    const copiedDatesAndBullets = kept.some((prev) => {
      const prevCompany = String(prev?.company ?? "").trim().toLowerCase();
      const prevDate = String(prev?.date ?? "").trim().toLowerCase();
      if (!date || date !== prevDate || !prevCompany || company === prevCompany) return false;
      const prevDetails = (Array.isArray(prev?.details) ? prev.details : []).map((detail: unknown) => String(detail).trim().toLowerCase());
      if (details.length === 0) return true;
      return details.every((bullet: string) => prevDetails.some((prevBullet: string) => prevBullet === bullet || prevBullet.includes(bullet) || bullet.includes(prevBullet)));
    });
    if (sameEmployerAndDates || copiedDatesAndBullets) continue;
    kept.push(job);
  }
  resume.experience = kept;
  return resume;
}

const LOOSE_KNOWN_KEYS = new Set([
  "personalinfo",
  "experience",
  "education",
  "projects",
  "skills",
  "certifications",
  "internships",
  "earlycareer",
  "corecompetencies",
  "jobinfo",
  "lettercontent",
  "targetcompany",
  "templateid",
  "additionalinfo",
  "work",
  "company",
  "title",
  "date",
  "location",
  "details",
  "summary",
  "name",
  "degree",
  "field",
  "startdate",
  "enddate",
  "issuer",
  "description",
  "technologies",
  "technical",
  "additional",
  "firstname",
  "lastname",
  "email",
  "phone",
  "linkedin",
  "github",
  "portfolio",
  "citizenship",
  "openingparagraph",
  "bodyparagraphs",
  "closingparagraph",
  "position",
  "hiringmanagername",
  "companyaddress",
]);

function isJobLike(item: unknown): boolean {
  return !!item && typeof item === "object" && ("company" in (item as object) || "title" in (item as object));
}

function isNestedResume(value: object): boolean {
  return "experience" in value || "personalInfo" in value || "letterContent" in value || "education" in value;
}

/** A proper name in an extra field is not evidence just because the model repeated it. */
function mentionsNameOutsideSource(text: string, source: unknown): boolean {
  const corpus = JSON.stringify(source ?? "").toLowerCase();
  const names = text.match(/\b[A-Z][A-Za-z]{2,}\b/g) ?? [];
  return names.some((name) => !corpus.includes(name.toLowerCase()));
}

/** Unknown keys, non-English job lists, and numeric durations are not exempt. */
function scrubLooseFields(source: unknown, value: unknown, options: CheckOptions) {
  if (Array.isArray(value)) {
    value.forEach((item) => scrubLooseFields(source, item, options));
    return;
  }
  const record = asRecord(value);
  if (!record) return;
  for (const key of Object.keys(record)) {
    const norm = key.toLowerCase().replace(/[^a-z]/g, "");
    const child = record[key];
    if (typeof child === "number") {
      if (checkNoInventedExperience(source, String(child), options).length > 0) delete record[key];
      continue;
    }
    if (!LOOSE_KNOWN_KEYS.has(norm) && child && typeof child === "object" && !Array.isArray(child)) {
      const rendered = JSON.stringify(child);
      if (!isNestedResume(child as object) && (checkNoInventedExperience(source, rendered, options).length > 0 || mentionsNameOutsideSource(rendered, source))) {
        delete record[key];
        continue;
      }
    }
    if (!LOOSE_KNOWN_KEYS.has(norm) && typeof child === "string" && mentionsNameOutsideSource(child, source)) {
      delete record[key];
      continue;
    }
    if (!LOOSE_KNOWN_KEYS.has(norm) && Array.isArray(child) && child.some((item) => isJobLike(item))) {
      const kept = child.filter((job) => !isJobLike(job) || checkNoInventedExperience(source, { experience: [job] }, options).length === 0);
      if (kept.length === 0) delete record[key];
      else record[key] = kept;
      continue;
    }
    if (!LOOSE_KNOWN_KEYS.has(norm) && typeof child === "string") {
      const asBullet = { experience: [{ details: [child] }] };
      if (
        checkNoInventedExperience(source, child, options).length > 0 ||
        checkNoInventedExperience(source, asBullet, options).length > 0
      ) {
        delete record[key];
      }
      continue;
    }
    if (child && typeof child === "object") scrubLooseFields(source, child, options);
  }
}

function scrubResume(source: unknown, output: Record<string, any>, options: CheckOptions) {
  let current = structuredClone(output);
  if (typeof source === "string" && source.trim()) {
    rehydrateFromText(source, current);
    restoreSectionsFromText(source, current);
  }
  if (checkNoInventedExperience(source, current, options).length === 0) return collapseCopiedJobs(current);
  const sourceRecord = asRecord(source);
  if (sourceRecord && ("experience" in sourceRecord || "personalInfo" in sourceRecord || "education" in sourceRecord)) {
    const overlaid = collapseCopiedJobs(overlayFromSource(sourceRecord, output, options));
    if (checkNoInventedExperience(source, overlaid, options).length === 0) return overlaid;
  }
  for (let pass = 0; pass < 48; pass++) {
    const violations = checkNoInventedExperience(source, current, options);
    if (violations.length === 0) break;
    const next = stripResumeViolation(current, source, violations[0].where, violations[0].value, options);
    if (JSON.stringify(next) === JSON.stringify(current)) break;
    current = next;
  }
  if (typeof source === "string" && source.trim()) {
    rehydrateFromText(source, current);
    restoreSectionsFromText(source, current);
  }
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

function companyNamed(source: unknown, letter: Record<string, any>): boolean {
  const resume = asRecord(source);
  const job = Array.isArray(resume?.experience) ? resume.experience[0] : null;
  if (!job?.company) return true;
  const text = JSON.stringify(letter.letterContent ?? {}).toLowerCase();
  return text.includes(String(job.company).toLowerCase());
}

/** A clean letter that names the role but not the employer still has to name the employer. */
function withEmployerNamed(source: unknown, options: CheckOptions, letter: Record<string, any>) {
  if (companyNamed(source, letter)) return letter;
  const resume = asRecord(source);
  const job = Array.isArray(resume?.experience) ? resume.experience[0] : null;
  if (!job?.company || !job?.title) return letterKeepingFacts(source, options, letter);
  const next = structuredClone(letter);
  const content = next.letterContent ?? {};
  const body = Array.isArray(content.bodyParagraphs) ? [...content.bodyParagraphs] : [];
  body.push(`I worked as a ${job.title} at ${job.company}.`);
  next.letterContent = {
    ...content,
    bodyParagraphs: body.filter((paragraph: unknown) => typeof paragraph === "string" && paragraph.trim()),
  };
  if (checkNoInventedExperience(source, next, options).length === 0) return next;
  return letterKeepingFacts(source, options, letter);
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
    const dropped = value && typeof value === "object" ? dropPostingFields(value) : value;
    const record = asRecord(dropped);
    if (record) {
      collapseCopiedJobs(record);
      scrubLooseFields(source, record, options);
    }
    const cleaned = (record ?? dropped) as T;
    logScrub("scrub", source, output, cleaned, options);
    return cleaned;
  };
  if (typeof output === "string") {
    const parsed = parseModelPayload(output);
    if (parsed !== output && parsed && typeof parsed === "object") {
      return scrubInventedExperience(source, parsed as T, options);
    }
    return finish(scrubProse(source, output, options) as T);
  }
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
    const letter = withEmployerNamed(source, options, scrubLetter(source, record, options));
    return finish(letter as T);
  }
  if ("personalInfo" in record || "experience" in record || "education" in record || "skills" in record || "work" in record) {
    return finish(scrubResume(source, record, options) as T);
  }
  const wrapped = scrubNestedResumes(source, record, options);
  return finish(wrapped as T);
}

function scrubNestedResumes(source: unknown, record: Record<string, any>, options: CheckOptions) {
  const next: Record<string, any> = {};
  let nested = false;
  for (const [key, child] of Object.entries(record)) {
    const inner = asRecord(child);
    if (inner && ("experience" in inner || "personalInfo" in inner || "letterContent" in inner || "education" in inner)) {
      next[key] = scrubInventedExperience(source, inner, options);
      nested = true;
      continue;
    }
    next[key] = child;
  }
  return nested ? next : scrubGeneric(source, record, options);
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
    if (typeof value !== "string" || !value.trim()) return false;
    return bulletGrounded(source, value, options);
  });
  const proseSource = match ? message.replace(match[0], " ") : message;
  const prose = splitSentences(proseSource).filter((sentence) => bulletGrounded(source, sentence, options)).join(" ");
  const combined = kept.length === 0
    ? prose.trim()
    : `${prose.trim()}\n\n\`\`\`updates\n${JSON.stringify(kept, null, 2)}\n\`\`\``.trim();
  if (combined) return combined;
  // A one-line field fill (sparkle) must stay empty. A longer reply gets a claim-free note.
  if (message.trim().length <= 160 && !/```/.test(message)) return "";
  return "I can only rephrase facts already on the resume.";
}

function bulletGrounded(source: unknown, text: string, options: CheckOptions): boolean {
  if (checkNoInventedExperience(source, text, options).length > 0) return false;
  return checkNoInventedExperience(source, { experience: [{ details: [text] }] }, options).length === 0;
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
  return resumeEvidenceLines(text).join("\n").trim();
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
