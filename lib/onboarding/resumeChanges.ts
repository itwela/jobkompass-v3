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
  (tailored.experience ?? []).forEach((job, i) => {
    const before = baseExp[i];
    if (!before) return;
    if (!same(list(before.details), list(job.details))) marks.experience.push(i);
  });
  if (marks.experience.length) {
    const companies = marks.experience.map((i) => norm(tailored.experience?.[i]?.company)).filter(Boolean).slice(0, 2);
    changes.push({
      section: "experience",
      title: "Experience",
      note: companies.length ? `The most relevant ${joinNames(companies)} work on top` : "The most relevant work on top",
    });
  }

  const baseProjects = base.projects ?? [];
  (tailored.projects ?? []).forEach((p, i) => {
    const before = baseProjects[i];
    if (!before) return;
    if (norm(before.description) !== norm(p.description) || !same(list(before.details), list(p.details))) marks.projects.push(i);
  });
  if (marks.projects.length) changes.push({ section: "projects", title: "Projects", note: "Described for this role" });

  return { changes, marks };
}
