// Relative imports: this module is also bundled into Convex node actions (agent tailoring).
import { DEFAULT_RESUME_EXTRACTION_MODEL_IDS } from "../aiModels";
import { parseTailoredResumeResponse } from "../emailAgent/draftMessage";
import { mentions, resumeText } from "./mustHaveMatch";

/** How a tailored resume covers the posting's must-haves. */
export interface MustHaves {
  total: number;
  /** Must-haves the person's own resume already shows. */
  met: string[];
  /** Must-haves the resume does not show, so tailoring left them out. */
  missing: string[];
}

const SYSTEM = `You read one job posting and list its must-have requirements as JSON. Return ONLY:
{"mustHaves": string[]}
- Up to 10 items, most important first.
- Each item is a skill, tool, technology or practice the posting requires, written as the posting names it, 1-3 words (e.g. "Python", "MCP", "Azure", "RAG", "Copilot Studio").
- No years of experience, no degrees, no soft skills, no duplicates.`;

const clean = (items: unknown): string[] => {
  if (!Array.isArray(items)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    if (typeof raw !== "string") continue;
    const term = raw.replace(/\s+/g, " ").trim();
    const key = term.toLowerCase();
    if (!term || term.length > 40 || seen.has(key)) continue;
    seen.add(key);
    out.push(term);
  }
  return out.slice(0, 10);
};

/** Job fields the must-have list is read from, plus the list stored on the job (if any). */
export interface MustHaveJob {
  title?: string;
  description?: string;
  skills?: string[];
  keywords?: string[];
  /** Must-haves stored on the job by an earlier run. */
  mustHaves?: string[];
  /** mustHavesKey(description) at the time mustHaves was stored. */
  mustHavesKey?: string;
}

/**
 * Fingerprint of the posting text a stored list was read from (FNV-1a over the
 * whitespace-normalised description). A stored list is reused only while it matches,
 * so editing the description re-extracts.
 */
export function mustHavesKey(description: string | undefined): string {
  const text = (description ?? "").replace(/\s+/g, " ").trim();
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `v1:${text.length}:${h.toString(16)}`;
}

/** The list stored on the job, when it still belongs to the current description. */
export function storedMustHaves(job: MustHaveJob): string[] | null {
  if (!job.mustHaves?.length || job.mustHavesKey !== mustHavesKey(job.description)) return null;
  const terms = clean(job.mustHaves);
  return terms.length ? terms : null;
}

const fallbackTerms = (job: MustHaveJob) => clean([...(job.keywords ?? []), ...(job.skills ?? [])]);

/**
 * The posting's must-haves, read by the extraction model. The posting is the only
 * input: it says what the job needs, never what the candidate has. Falls back to the
 * skills already extracted when the job was saved.
 */
export async function extractMustHaves(job: MustHaveJob): Promise<string[]> {
  return (await extractFromModel(job)) ?? fallbackTerms(job);
}

/**
 * The must-have list for a job, stable across runs: reuses the list stored on the job
 * for the same description, otherwise extracts once and hands the model's list to
 * `save` so the next run reuses it. The keyword/skill fallback is never stored, so a
 * later run can still get the model's list.
 */
export async function mustHavesForJob(
  job: MustHaveJob,
  save?: (terms: string[], key: string) => Promise<unknown>
): Promise<string[]> {
  const stored = storedMustHaves(job);
  if (stored) return stored;
  const fromModel = await extractFromModel(job);
  if (!fromModel) return fallbackTerms(job);
  if (save) await save(fromModel, mustHavesKey(job.description)).catch(() => undefined);
  return fromModel;
}

/** The model's list, or null when the model is unavailable or returns nothing usable. */
async function extractFromModel(job: MustHaveJob): Promise<string[] | null> {
  const key = process.env.OPENROUTER_API_KEY;
  const text = (job.description ?? "").trim();
  if (!key || text.length < 80) return null;
  const models = [
    process.env.OPENROUTER_RESUME_MODEL_PRIMARY?.trim() || DEFAULT_RESUME_EXTRACTION_MODEL_IDS[0],
    process.env.OPENROUTER_RESUME_MODEL_FALLBACK?.trim() || DEFAULT_RESUME_EXTRACTION_MODEL_IDS[1],
  ];
  for (const model of models) {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "HTTP-Referer": "https://www.myjobkompass.com", "X-Title": "JobKompass Chat" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: `${job.title ? `Role: ${job.title}\n\n` : ""}Posting:\n${text.slice(0, 20000)}` },
        ],
        // Deterministic: the same posting should give the same list.
        temperature: 0,
        max_tokens: 800,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(45000),
    }).catch(() => null);
    if (!res?.ok) continue;
    const data = await res.json().catch(() => null);
    const parsed = parseTailoredResumeResponse(String(data?.choices?.[0]?.message?.content ?? "").replace(/<think>[\s\S]*?<\/think>/gi, ""));
    const terms = clean((parsed as { mustHaves?: unknown } | null)?.mustHaves);
    if (terms.length) return terms;
  }
  return null;
}

export { MUST_HAVE_ALIASES, mentions, resumeText, stripVendor } from "./mustHaveMatch";

/**
 * Scores must-haves against the person's own (base) resume, never the posting and never
 * the model's rewrite: a must-have counts only when the base resume already shows it.
 */
export function scoreMustHaves(terms: string[], baseResume: unknown): MustHaves {
  const haystack = resumeText(baseResume);
  const met: string[] = [];
  const missing: string[] = [];
  for (const term of clean(terms)) (mentions(haystack, term) ? met : missing).push(term);
  return { total: met.length + missing.length, met, missing };
}

/** Page count of a PDF. */
export async function countPdfPages(pdf: Uint8Array): Promise<number | undefined> {
  try {
    const { getDocumentProxy } = await import("unpdf");
    const doc = await getDocumentProxy(new Uint8Array(pdf));
    return doc.numPages;
  } catch {
    return undefined;
  }
}
