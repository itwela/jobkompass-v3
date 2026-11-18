// Relative imports: this module is also bundled into Convex node actions (agent tailoring).
import { DEFAULT_RESUME_EXTRACTION_MODEL_IDS } from "../aiModels";
import { parseTailoredResumeResponse } from "../emailAgent/draftMessage";

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

/**
 * The posting's must-haves, read by the extraction model. The posting is the only
 * input: it says what the job needs, never what the candidate has. Falls back to the
 * skills already extracted when the job was saved.
 */
export async function extractMustHaves(job: { title?: string; description?: string; skills?: string[]; keywords?: string[] }): Promise<string[]> {
  const fallback = clean([...(job.keywords ?? []), ...(job.skills ?? [])]);
  const key = process.env.OPENROUTER_API_KEY;
  const text = (job.description ?? "").trim();
  if (!key || text.length < 80) return fallback;
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
        temperature: 0.1,
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
  return fallback;
}

/** Every string in a resume document, flattened to one lower-case haystack. */
function resumeText(resume: unknown): string {
  const parts: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === "string") parts.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(resume);
  return ` ${parts.join(" \n ").toLowerCase().replace(/[‐-―]/g, "-")} `;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** True when the term appears in the text as a whole word or phrase. */
function mentions(haystack: string, term: string): boolean {
  const needle = term.toLowerCase().trim();
  if (!needle) return false;
  const variants = new Set([needle, needle.replace(/\./g, ""), needle.replace(/-/g, " "), needle.replace(/\s+/g, "")]);
  // Also against the text with dots dropped, so "nextjs" finds "Next.js".
  const hays = [haystack, haystack.replace(/(\w)\.(\w)/g, "$1$2")];
  for (const v of variants) {
    if (!v) continue;
    const re = new RegExp(`(^|[^a-z0-9+#])${escape(v)}($|[^a-z0-9+#])`, "i");
    if (hays.some((h) => re.test(h))) return true;
  }
  return false;
}

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
