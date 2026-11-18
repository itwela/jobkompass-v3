/**
 * Questions that ask the candidate for the number or result a bullet is missing, and
 * the answers that come back. Pure functions: no network, no model.
 */

export type QuestionSection = "experience" | "projects";

/** One question about one bullet, shown as a card in chat or returned by the CLI. */
export interface BulletQuestion {
  id: string;
  section: QuestionSection;
  /** Index of the experience item or project the bullet belongs to. */
  index: number;
  bullet: string;
  question: string;
  /** A made-up answer in the right unit, shown as a placeholder only. */
  example?: string;
}

/** What the candidate said about one bullet. A fact with the standing of the resume. */
export interface BulletAnswer {
  section: QuestionSection;
  index: number;
  bullet: string;
  answer: string;
}

type AnyResume = Record<string, any>;

export const MAX_QUESTIONS = 5;

const clean = (v: unknown) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "");
const itemsOf = (resume: AnyResume | null | undefined, section: QuestionSection): any[] =>
  Array.isArray(resume?.[section]) ? resume![section] : [];
const bulletsOf = (item: any): string[] => (Array.isArray(item?.details) ? item.details.filter((d: unknown) => typeof d === "string") : []);

const words = (text: string) => new Set(text.toLowerCase().match(/[a-z0-9+#.]{3,}/g) ?? []);

/** Share of words two bullets have in common, 0 to 1. */
export function bulletSimilarity(a: string, b: string): number {
  const wa = words(a);
  const wb = words(b);
  if (!wa.size || !wb.size) return 0;
  let shared = 0;
  for (const w of wa) if (wb.has(w)) shared++;
  return shared / Math.min(wa.size, wb.size);
}

/** True when the bullet already states a quantity (a count, percentage, amount or duration). */
export function bulletHasNumber(bullet: string): boolean {
  if (/\d/.test(bullet)) return true;
  return /\b(one|two|three|four|five|six|seven|eight|nine|ten|dozen|hundred|thousand|million|billion|half|double|doubled|tripled)\b/i.test(bullet);
}

function hash(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

export function questionId(section: QuestionSection, index: number, bullet: string): string {
  return `${section}-${index}-${hash(clean(bullet).toLowerCase())}`;
}

/** The bullet in this item that best matches the text, or null when nothing is close. */
function matchBullet(item: any, text: string): string | null {
  const bullets = bulletsOf(item);
  const wanted = clean(text);
  const exact = bullets.find((b) => clean(b) === wanted);
  if (exact) return exact;
  let best: string | null = null;
  let score = 0;
  for (const b of bullets) {
    const s = bulletSimilarity(b, wanted);
    if (s > score) {
      best = b;
      score = s;
    }
  }
  return score >= 0.6 ? best : null;
}

/**
 * Keeps only the model's questions that point at a real bullet in the finished resume,
 * drops ones the candidate already answered, and caps the list.
 */
export function sanitizeQuestions(raw: unknown, resume: AnyResume, answers: BulletAnswer[] = []): BulletQuestion[] {
  if (!Array.isArray(raw)) return [];
  const out: BulletQuestion[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const q = entry as Record<string, unknown>;
    const section: QuestionSection | null = q.section === "experience" || q.section === "projects" ? q.section : null;
    const index = typeof q.index === "number" ? q.index : Number.parseInt(String(q.index), 10);
    const question = clean(q.question);
    if (!section || !Number.isInteger(index) || !question || question.length > 220) continue;
    const item = itemsOf(resume, section)[index];
    if (!item) continue;
    const bullet = matchBullet(item, clean(q.bullet));
    if (!bullet) continue;
    const answered = answers.some((a) => a.section === section && a.index === index && bulletSimilarity(a.bullet, bullet) >= 0.5);
    if (answered) continue;
    const id = questionId(section, index, bullet);
    if (seen.has(id)) continue;
    seen.add(id);
    const example = clean(q.example).slice(0, 80);
    out.push({ id, section, index, bullet, question: question.endsWith("?") ? question : `${question}?`, ...(example ? { example } : {}) });
    if (out.length >= MAX_QUESTIONS) break;
  }
  return out;
}

/** Trims and drops empty or oversized answers so nothing but a short fact gets through. */
export function sanitizeAnswers(raw: unknown): BulletAnswer[] {
  if (!Array.isArray(raw)) return [];
  const out: BulletAnswer[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const a = entry as Record<string, unknown>;
    const section: QuestionSection | null = a.section === "experience" || a.section === "projects" ? a.section : null;
    const index = typeof a.index === "number" ? a.index : Number.parseInt(String(a.index), 10);
    const bullet = clean(a.bullet);
    const answer = clean(a.answer).slice(0, 400);
    if (!section || !Number.isInteger(index) || index < 0 || !bullet || !answer) continue;
    out.push({ section, index, bullet, answer });
  }
  return out.slice(0, 20);
}

/**
 * The fact source for a run that includes answers: the base resume with each answer
 * added as a line under the item it is about. The fact guard reads this, so a number
 * the candidate supplied counts as theirs and anything else is still stripped.
 */
export function sourceWithAnswers<T extends AnyResume>(base: T, answers: BulletAnswer[]): T {
  if (!answers.length) return base;
  const source = structuredClone(base) as AnyResume;
  for (const a of answers) {
    const item = itemsOf(source, a.section)[a.index];
    if (!item) continue;
    item.details = [...bulletsOf(item), a.answer];
  }
  return source as T;
}

/**
 * sourceWithAnswers lists each answer as a line under its item so the guard can ground
 * it. The guard can copy such a line back into the output as if it were a bullet.
 * Removes any bullet that is just an answer's raw text.
 */
export function stripAnswerLines<T extends AnyResume>(resume: T, answers: BulletAnswer[]): T {
  if (!answers.length) return resume;
  const out = structuredClone(resume) as AnyResume;
  for (const section of ["experience", "projects"] as const) {
    itemsOf(out, section).forEach((item, index) => {
      const raw = new Set(answers.filter((a) => a.section === section && a.index === index).map((a) => clean(a.answer).toLowerCase()));
      if (!raw.size || !Array.isArray(item.details)) return;
      item.details = item.details.filter((d: unknown) => typeof d !== "string" || !raw.has(clean(d).toLowerCase()));
    });
  }
  return out as T;
}

/**
 * The fact guard removes a bullet it cannot ground, which would silently shorten a job.
 * Puts back the candidate's own wording for every bullet that went missing, so each item
 * keeps as many bullets as the base resume had.
 */
export function restoreDroppedBullets<T extends AnyResume>(base: AnyResume, tailored: T): T {
  const out = structuredClone(tailored) as AnyResume;
  for (const section of ["experience", "projects"] as const) {
    const baseItems = itemsOf(base, section);
    const items = itemsOf(out, section);
    items.forEach((item, i) => {
      const original = bulletsOf(baseItems[i]);
      if (!original.length) return;
      const kept = bulletsOf(item);
      const missing = original.length - kept.length;
      if (missing <= 0) return;
      // The base bullets least represented among the survivors are the ones that were dropped.
      const ranked = original
        .map((b) => ({ b, score: Math.max(0, ...kept.map((k) => bulletSimilarity(k, b))) }))
        .sort((x, y) => x.score - y.score)
        .slice(0, missing)
        .map((x) => x.b);
      item.details = [...kept, ...original.filter((b) => ranked.includes(b))];
    });
  }
  return out as T;
}

const itemKey = (item: any) =>
  `${clean(item?.company ?? item?.name)}|${clean(item?.title)}`.toLowerCase().replace(/[^a-z0-9|]/g, "");

/**
 * True when the tailored resume still has the base resume's jobs and projects, in order.
 * Punctuation and spacing are ignored; a renamed, reordered or dropped item is not trusted.
 */
export function sameStructure(base: AnyResume, tailored: AnyResume): boolean {
  for (const section of ["experience", "projects"] as const) {
    const a = itemsOf(base, section).map(itemKey);
    const b = itemsOf(tailored, section).map(itemKey);
    if (a.length !== b.length || a.some((k, i) => k !== b[i])) return false;
  }
  return true;
}

const IDENTITY_FIELDS: Record<QuestionSection, string[]> = {
  experience: ["company", "title", "date", "location"],
  projects: ["name", "date"],
};

/**
 * The fact guard can remove a whole job or project it cannot ground. Rebuilds each
 * section in the base resume's order: a surviving item keeps its rewritten text but
 * takes its name, title and dates from the base; a missing item comes back as the
 * candidate wrote it.
 */
export function restoreStructure<T extends AnyResume>(base: AnyResume, tailored: T): T {
  const out = structuredClone(tailored) as AnyResume;
  for (const section of ["experience", "projects"] as const) {
    const baseItems = itemsOf(base, section);
    if (!baseItems.length) continue;
    const kept = itemsOf(out, section);
    const used = new Set<number>();
    out[section] = baseItems.map((original) => {
      const i = kept.findIndex((item, j) => !used.has(j) && itemKey(item) === itemKey(original));
      if (i < 0) return structuredClone(original);
      used.add(i);
      const item = { ...kept[i] };
      for (const field of IDENTITY_FIELDS[section]) if (original[field] !== undefined) item[field] = original[field];
      return item;
    });
  }
  return out as T;
}

/** Bullets with no number, for a quick count of what is still unquantified. */
export function unquantifiedBullets(resume: AnyResume): Array<{ section: QuestionSection; index: number; bullet: string }> {
  const out: Array<{ section: QuestionSection; index: number; bullet: string }> = [];
  for (const section of ["experience", "projects"] as const) {
    itemsOf(resume, section).forEach((item, index) => {
      for (const bullet of bulletsOf(item)) if (!bulletHasNumber(bullet)) out.push({ section, index, bullet });
    });
  }
  return out;
}
