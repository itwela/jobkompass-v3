import type { ResumeContent } from "@/lib/resume/types";

/** One line in "What changed and why". */
export interface ResumeChange {
  section: "summary" | "skills" | "experience" | "projects";
  title: string;
  note: string;
}

/** Which parts of the page get the blue mark. */
export interface ResumeMarks {
  summary: boolean;
  skills: boolean;
  /** Indices into content.experience whose bullets changed. */
  experience: number[];
  /** Indices into content.projects whose text changed. */
  projects: number[];
}

const norm = (s: unknown) => (typeof s === "string" ? s.trim().replace(/\s+/g, " ") : "");
const list = (a: unknown): string[] => (Array.isArray(a) ? a.map(norm).filter(Boolean) : []);
const same = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);
// Same bullets in a different order. Anything added, dropped or reworded is a rewrite.
const reorderedOnly = (a: string[], b: string[]) => a.length === b.length && [...a].sort().join("\n") === [...b].sort().join("\n");
const skillsOf = (c: Partial<ResumeContent>) => [...list(c.skills?.technical), ...list(c.skills?.additional)];

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * Compares the base resume with its tailored copy and says, in plain words, what
 * moved. Derived from the two documents, never from the model, so every note is true.
 */
export function describeResumeChanges(
  base: Partial<ResumeContent>,
  tailored: Partial<ResumeContent>,
  target: { role: string },
): { changes: ResumeChange[]; marks: ResumeMarks } {
  const changes: ResumeChange[] = [];
  const marks: ResumeMarks = { summary: false, skills: false, experience: [], projects: [] };

  const baseSummary = norm(base.personalInfo?.summary);
  const newSummary = norm(tailored.personalInfo?.summary);
  if (newSummary && newSummary !== baseSummary) {
    marks.summary = true;
    changes.push({ section: "summary", title: "Summary", note: baseSummary ? `Rewritten for ${target.role}` : `Written for ${target.role}` });
  }

  const baseSkills = skillsOf(base);
  const newSkills = skillsOf(tailored);
  if (newSkills.length && !same(baseSkills, newSkills)) {
    marks.skills = true;
    const lead = newSkills.filter((s, i) => baseSkills.indexOf(s) !== i).slice(0, 2);
    changes.push({ section: "skills", title: "Skills", note: lead.length ? `${joinNames(lead)} moved first` : "Reordered for this role" });
  }

  const baseExp = base.experience ?? [];
  let expRewritten = false;
  (tailored.experience ?? []).forEach((job, i) => {
    const before = baseExp[i];
    if (!before) return;
    const was = list(before.details);
    const now = list(job.details);
    if (same(was, now)) return;
    marks.experience.push(i);
    if (!reorderedOnly(was, now)) expRewritten = true;
  });
  if (marks.experience.length) {
    const companies = marks.experience.map((i) => norm(tailored.experience?.[i]?.company)).filter(Boolean).slice(0, 2);
    const note = expRewritten
      ? companies.length ? `${joinNames(companies)} bullets rewritten for ${target.role}` : `Bullets rewritten for ${target.role}`
      : companies.length ? `The most relevant ${joinNames(companies)} work on top` : "The most relevant work on top";
    changes.push({ section: "experience", title: "Experience", note });
  }

  const baseProjects = base.projects ?? [];
  let projRewritten = false;
  (tailored.projects ?? []).forEach((p, i) => {
    const before = baseProjects[i];
    if (!before) return;
    const descChanged = norm(before.description) !== norm(p.description);
    const was = list(before.details);
    const now = list(p.details);
    if (!descChanged && same(was, now)) return;
    marks.projects.push(i);
    if (descChanged || !reorderedOnly(was, now)) projRewritten = true;
  });
  if (marks.projects.length) {
    changes.push({ section: "projects", title: "Projects", note: projRewritten ? "Described for this role" : "The most relevant work on top" });
  }

  return { changes, marks };
}
