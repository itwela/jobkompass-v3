/**
 * Bullet questions for the agent API (the `jk` CLI). Pure functions, no network:
 * safe to import from both the default and the Node Convex runtimes.
 *
 * The rule the whole flow serves: the server never invents a number. It asks a
 * question about a bullet; the human answers; the answer is saved on the base
 * resume (`bulletAnswers`) and reused by every later generation.
 */
import {
  MAX_QUESTIONS,
  bulletSimilarity,
  questionId,
  sanitizeAnswers,
  unquantifiedBullets,
  type BulletAnswer,
  type BulletQuestion,
  type QuestionSection,
} from "../../lib/resume/bulletQuestions";
import { scoreResume, type ResumeScorecard } from "../../lib/resume/scorecard";
import { mentions, resumeText } from "../../lib/chat/mustHaveMatch";

type AnyResume = Record<string, any>;

const clean = (v: unknown) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "");
const bulletsOf = (item: any): string[] =>
  Array.isArray(item?.details) ? item.details.filter((d: unknown) => typeof d === "string") : [];
const itemsOf = (resume: AnyResume | null | undefined, section: QuestionSection): any[] =>
  Array.isArray(resume?.[section]) ? resume![section] : [];

/** True when the candidate already answered a question about this bullet. */
export function isAnswered(answers: BulletAnswer[], section: QuestionSection, index: number, bullet: string): boolean {
  return answers.some((a) => a.section === section && a.index === index && bulletSimilarity(a.bullet, bullet) >= 0.5);
}

const TEMPLATES: Array<{ test: RegExp; question: string; example: string }> = [
  {
    test: /\b(reduc|cut|lower|decreas|sav|shorten|speed|faster|automat|streamlin)/i,
    question: "By how much: what was it before, and what was it after?",
    example: "cut weekly report time from 6 hours to 1",
  },
  {
    test: /\b(increas|grow|grew|improv|boost|rais|expand|scal)/i,
    question: "How much did it go up, and over what period?",
    example: "signups up 30% in one quarter",
  },
  {
    test: /\b(led|lead|manag|mentor|supervis|train|coach|coordinat|direct)/i,
    question: "How many people, and how big was the budget or scope?",
    example: "a team of 4 engineers",
  },
  {
    test: /\b(customer|client|user|patient|student|guest|member|account|ticket|call)/i,
    question: "How many of them, per day, week or month?",
    example: "about 40 customers a day",
  },
  {
    test: /\b(sold|sell|sales|revenue|deal|quota|close|closed|pipeline)/i,
    question: "What was the dollar amount or the percent of target?",
    example: "$120K in new sales, 115% of quota",
  },
  {
    test: /\b(built|build|develop|design|creat|launch|ship|implement|wrote|write)/i,
    question: "How many people used it, or how much time or money did it save?",
    example: "used by 200 staff, saved 5 hours a week",
  },
];

/** A plain question for one bullet, chosen from its verbs. Never contains a number of its own. */
export function templatedQuestionText(bullet: string): { question: string; example: string } {
  for (const t of TEMPLATES) if (t.test.test(bullet)) return { question: t.question, example: t.example };
  return {
    question: "What number shows the result here: how many, how much, how often, or how fast?",
    example: "about 15 a week",
  };
}

/**
 * Deterministic questions: one per bullet with no number, skipping bullets the
 * candidate already answered, capped at MAX_QUESTIONS. Free, instant, always available.
 */
export function templatedQuestions(content: AnyResume, answers: BulletAnswer[] = [], limit = MAX_QUESTIONS): BulletQuestion[] {
  const out: BulletQuestion[] = [];
  for (const { section, index, bullet } of unquantifiedBullets(content ?? {})) {
    if (isAnswered(answers, section, index, bullet)) continue;
    const { question, example } = templatedQuestionText(bullet);
    out.push({ id: questionId(section, index, bullet), section, index, bullet: clean(bullet), question, example });
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Re-points model questions (asked about the model's rewritten bullets) at the
 * bullets the caller actually submitted. Same structure is guaranteed by
 * tailorResume, so section + index carry over; the bullet is the closest one in
 * that item. Drops questions about answered bullets or with no matching item.
 */
export function pointQuestionsAt(content: AnyResume, questions: BulletQuestion[], answers: BulletAnswer[] = []): BulletQuestion[] {
  const out: BulletQuestion[] = [];
  const seen = new Set<string>();
  for (const q of questions) {
    const bullets = bulletsOf(itemsOf(content, q.section)[q.index]);
    if (!bullets.length) continue;
    let best = bullets[0];
    let score = -1;
    for (const b of bullets) {
      const s = bulletSimilarity(b, q.bullet);
      if (s > score) {
        best = b;
        score = s;
      }
    }
    if (isAnswered(answers, q.section, q.index, best)) continue;
    const id = questionId(q.section, q.index, best);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ ...q, id, bullet: clean(best) });
    if (out.length >= MAX_QUESTIONS) break;
  }
  return out;
}

export type AnswerInput = {
  id?: unknown;
  section?: unknown;
  index?: unknown;
  bullet?: unknown;
  answer?: unknown;
};

/**
 * Turns what the agent sent into clean answers. Each entry is either
 * `{id, answer}` (the id from a question this API returned, resolved against the
 * resume's own bullets) or `{section, index, bullet, answer}`.
 */
export function resolveAnswers(content: AnyResume, raw: unknown): { answers: BulletAnswer[]; unresolved: string[] } {
  if (!Array.isArray(raw)) return { answers: [], unresolved: [] };
  const byId = new Map<string, { section: QuestionSection; index: number; bullet: string }>();
  for (const section of ["experience", "projects"] as const) {
    itemsOf(content, section).forEach((item, index) => {
      for (const bullet of bulletsOf(item)) byId.set(questionId(section, index, bullet), { section, index, bullet: clean(bullet) });
    });
  }
  const expanded: AnswerInput[] = [];
  const unresolved: string[] = [];
  for (const entry of raw as AnswerInput[]) {
    if (!entry || typeof entry !== "object") continue;
    if (typeof entry.id === "string" && entry.id && entry.bullet === undefined) {
      const hit = byId.get(entry.id);
      if (!hit) {
        unresolved.push(entry.id);
        continue;
      }
      expanded.push({ ...hit, answer: entry.answer });
    } else {
      expanded.push(entry);
    }
  }
  return { answers: sanitizeAnswers(expanded), unresolved };
}

/** Stored answers (with answeredAt) to the plain BulletAnswer shape. */
export function storedToAnswers(stored: unknown): BulletAnswer[] {
  return sanitizeAnswers(stored);
}

/** Must-haves for the scorecard, from a saved job's skills then keywords. */
export function mustHavesFromJob(job: { skills?: string[]; keywords?: string[] } | null | undefined): string[] | undefined {
  if (!job) return undefined;
  const list = [...(job.skills ?? []), ...(job.keywords ?? [])].map(clean).filter(Boolean);
  const unique = [...new Set(list.map((s) => s.toLowerCase()))].map((k) => list.find((s) => s.toLowerCase() === k)!);
  return unique.length ? unique.slice(0, 20) : undefined;
}

/**
 * Which must-haves the resume text mentions, with the shared matcher (whole-phrase,
 * vendor prefixes, aliases, "A/B" parts). Not a judgment of fit; undefined when there is no job.
 */
export function mustHavesCoverage(
  content: AnyResume,
  job: { skills?: string[]; keywords?: string[] } | null | undefined
): { met: string[]; missing: string[] } | undefined {
  const wanted = mustHavesFromJob(job);
  if (!wanted) return undefined;
  const text = resumeText(content ?? {});
  const met: string[] = [];
  const missing: string[] = [];
  for (const m of wanted) (mentions(text, m) ? met : missing).push(m);
  return { met, missing };
}

export function scorecardFor(content: AnyResume, job?: { skills?: string[]; keywords?: string[] } | null): ResumeScorecard {
  const mustHaves = mustHavesCoverage(content, job);
  return scoreResume(content, mustHaves ? { mustHaves } : undefined);
}

export const QUESTIONS_RULE =
  "Never invent a number. Relay each question to your human, then save their answers with 'jk resumes answer'. Answers are reused by every later generation.";
