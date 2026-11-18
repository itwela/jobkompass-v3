import type { BulletAnswer, BulletQuestion } from "@/lib/resume/bulletQuestions";

export type { BulletAnswer, BulletQuestion };

import type { ResumeScorecard } from "@/lib/resume/scorecard";

export type { ResumeScorecard };

/** What POST /api/resume/answers returns. */
export interface ResumeAnswersResult {
  resumeId: string;
  content: unknown;
  questions: BulletQuestion[];
  scorecard?: ResumeScorecard | null;
}

/** Questions as they come off the wire: drop anything the card cannot show. */
export function usableQuestions(raw: unknown): BulletQuestion[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (q): q is BulletQuestion =>
      !!q && typeof q === "object" && typeof (q as any).question === "string" && typeof (q as any).bullet === "string" &&
      ((q as any).section === "experience" || (q as any).section === "projects") && Number.isInteger((q as any).index),
  );
}

export function usableScorecard(raw: unknown): ResumeScorecard | null {
  const s = raw as ResumeScorecard | null | undefined;
  return s && typeof s === "object" && Number.isFinite(s.bullets) && Number.isFinite(s.quantified) ? s : null;
}
