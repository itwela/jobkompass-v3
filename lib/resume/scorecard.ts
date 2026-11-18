/**
 * A quick, honest read on a resume's bullets: how many state a number and how many
 * still read like a job description. Pure: no network, no model.
 */
import { bulletHasNumber } from "./bulletQuestions";

export interface ResumeScorecard {
  bullets: number;
  quantified: number;
  dutyStyle: number;
  /** 0 to 100, rounded. 0 when there are no bullets. */
  quantifiedPct: number;
  /** matched: each met must-have with the resume evidence for it, when the scorer gave it. */
  mustHaves?: { met: number; total: number; missing: string[]; matched?: { term: string; evidence: string }[] };
}

export interface ScorecardDelta {
  bullets: number;
  quantified: number;
  dutyStyle: number;
  quantifiedPct: number;
  mustHavesMet?: number;
}

// Openers that describe a duty instead of a result.
const DUTY_OPENERS = [
  "responsible for", "was responsible", "worked on", "worked with", "helped", "assisted",
  "handled", "maintained", "tasked with", "duties included", "participated in",
  "involved in", "in charge of", "contributed to", "supported",
];

export function isDutyStyle(bullet: string): boolean {
  const text = bullet.replace(/^[\s\-*•·]+/, "").toLowerCase();
  return DUTY_OPENERS.some((p) => text === p || text.startsWith(p + " ") || text.startsWith(p + ","));
}

function bulletsOf(resume: Record<string, any> | null | undefined): string[] {
  const out: string[] = [];
  for (const section of ["experience", "projects"]) {
    const items = Array.isArray(resume?.[section]) ? resume![section] : [];
    for (const item of items) {
      const details = Array.isArray(item?.details) ? item.details : [];
      for (const d of details) if (typeof d === "string" && d.trim()) out.push(d.trim());
    }
  }
  return out;
}

export function scoreResume(
  resume: Record<string, any> | null | undefined,
  opts?: { mustHaves?: { met: string[]; missing: string[]; matched?: { term: string; evidence: string }[] } },
): ResumeScorecard {
  const bullets = bulletsOf(resume);
  const quantified = bullets.filter(bulletHasNumber).length;
  const dutyStyle = bullets.filter(isDutyStyle).length;
  const card: ResumeScorecard = {
    bullets: bullets.length,
    quantified,
    dutyStyle,
    quantifiedPct: bullets.length ? Math.round((quantified / bullets.length) * 100) : 0,
  };
  if (opts?.mustHaves) {
    const met = opts.mustHaves.met ?? [];
    const missing = opts.mustHaves.missing ?? [];
    card.mustHaves = { met: met.length, total: met.length + missing.length, missing: [...missing] };
    if (opts.mustHaves.matched) card.mustHaves.matched = opts.mustHaves.matched.map((m) => ({ ...m }));
  }
  return card;
}

/** after minus before, field by field. mustHavesMet only when both sides have it. */
export function compareScorecards(before: ResumeScorecard, after: ResumeScorecard): ScorecardDelta {
  const delta: ScorecardDelta = {
    bullets: after.bullets - before.bullets,
    quantified: after.quantified - before.quantified,
    dutyStyle: after.dutyStyle - before.dutyStyle,
    quantifiedPct: after.quantifiedPct - before.quantifiedPct,
  };
  if (before.mustHaves && after.mustHaves) delta.mustHavesMet = after.mustHaves.met - before.mustHaves.met;
  return delta;
}
