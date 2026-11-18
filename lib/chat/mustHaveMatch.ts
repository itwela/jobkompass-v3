/**
 * Must-have matching shared by every scorecard (in-app tailor, agent tailor, agent
 * baseScorecard). Pure: no model and no node APIs, so the Convex V8 runtime can import it.
 */

/** Every string in a resume document, flattened to one lower-case haystack. */
export function resumeText(resume: unknown): string {
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

/**
 * Names that mean the same thing. Every spelling is still matched as a whole word or
 * phrase, so an alias never matches inside a longer word.
 */
export const MUST_HAVE_ALIASES: string[][] = [
  ["llm", "llms", "large language model", "large language models"],
  ["agentic", "agentic ai", "ai agent", "ai agents", "agentic workflows", "autonomous agents"],
  ["genai", "gen ai", "generative ai"],
  ["rag", "retrieval-augmented generation", "retrieval augmented generation"],
  ["ml", "machine learning"],
  ["nlp", "natural language processing"],
  ["node.js", "nodejs", "node"],
  ["kubernetes", "k8s"],
  ["postgresql", "postgres"],
  ["gcp", "google cloud", "google cloud platform"],
  ["aws", "amazon web services"],
];

/** Vendor names a posting puts in front of a product ("AWS Lambda", "Amazon S3"). */
const VENDOR_PREFIX = /^(?:amazon web services|aws|amazon|microsoft|google cloud|google|azure|apache)\s+(?=\S)/i;

/** The phrase without a leading vendor name, or null when it has none. */
export function stripVendor(term: string): string | null {
  const t = term.trim();
  const out = t.replace(VENDOR_PREFIX, "").trim();
  return out !== t && out ? out : null;
}

/**
 * Generic trailing words a posting tacks onto a skill ("MCP Integration", "REST API
 * Development"). Dropped for matching only when a distinguishing core term remains.
 */
export const GENERIC_SUFFIXES = [
  "integration", "integrations", "development", "experience", "skills", "frameworks",
  "framework", "expertise", "proficiency", "knowledge",
];

/** Cores too vague to stand for a requirement on their own ("Web Development" is not "web"). */
const VAGUE_CORES = new Set([
  "web", "software", "app", "apps", "application", "applications", "product", "systems", "system",
  "data", "cloud", "backend", "frontend", "full stack", "technical", "team", "industry", "work",
]);

/** The phrase without a generic trailing word, or null when it has none or no core would remain. */
export function stripGenericSuffix(term: string): string | null {
  const words = term.trim().split(/\s+/);
  if (words.length < 2 || !GENERIC_SUFFIXES.includes(words[words.length - 1].toLowerCase())) return null;
  const core = words.slice(0, -1).join(" ").trim();
  const k = core.toLowerCase();
  if (!/[a-z0-9]/i.test(core) || GENERIC_SUFFIXES.includes(k) || VAGUE_CORES.has(k)) return null;
  return core;
}

/**
 * The singular or plural of the phrase's last word ("claude apis" ↔ "claude api"), or null.
 * An acronym plural ("APIs", "LLMs", "KPIs") always loses its s; otherwise short words and
 * -ss/-is/-us endings are left alone so "AWS", "iOS", "Redis" never lose an s.
 */
function numberVariant(term: string): string | null {
  const acronym = /^(.*?[^A-Za-z0-9]|)([A-Z0-9]{2,})s$/.exec(term.trim());
  if (acronym) return (acronym[1] + acronym[2]).toLowerCase();
  const m = /^(.*?)([a-z0-9]+)$/.exec(term.toLowerCase().trim());
  if (!m) return null;
  const [, head, last] = m;
  if (last.length > 3 && /[^siu]s$/.test(last)) return head + last.slice(0, -1);
  if (/[a-z]$/.test(last) && !last.endsWith("s") && last.length >= 2) return head + last + "s";
  return null;
}

/**
 * Every equivalent spelling of one requirement: as written, without a vendor, without a
 * generic trailing word, singular/plural, aliases. Each is still matched as a whole word.
 */
function spellings(term: string): string[] {
  const out = new Set<string>();
  const add = (t: string, inflect = true) => {
    const k = t.toLowerCase().trim();
    if (!k || out.has(k)) return;
    out.add(k);
    for (const group of MUST_HAVE_ALIASES) if (group.includes(k)) group.forEach((g) => add(g));
    const bare = stripVendor(k);
    if (bare) add(bare);
    const core = stripGenericSuffix(t);
    if (core) add(core);
    const other = inflect ? numberVariant(t) : null;
    if (other) add(other, false);
  };
  add(term);
  return [...out];
}

/**
 * Where the phrase appears as a whole word or phrase ("Java" never inside "JavaScript"):
 * its index, -1 when found only with dots dropped, null when absent.
 */
function phraseAt(haystack: string, term: string): number | null {
  const needle = term.toLowerCase().trim();
  if (!needle) return null;
  const variants = new Set([needle, needle.replace(/\./g, ""), needle.replace(/-/g, " "), needle.replace(/\s+/g, "")]);
  // Also against the text with dots dropped, so "nextjs" finds "Next.js".
  const dotless = haystack.replace(/(\w)\.(\w)/g, "$1$2");
  for (const v of variants) {
    if (!v) continue;
    const re = new RegExp(`(^|[^a-z0-9+#])${escape(v)}($|[^a-z0-9+#])`, "i");
    const m = re.exec(haystack);
    if (m) return m.index + m[1].length;
    if (re.test(dotless)) return -1;
  }
  return null;
}

/**
 * Concepts and role phrases a posting names ("chatbot/copilot", "enterprise knowledge
 * assistants") that a resume shows by describing the work rather than with the same
 * words. `names` are the posting's spellings (lower case, singular). Each `evidence`
 * pattern runs on one resume string at a time and needs a specific signal: a bare "AI",
 * "search", "agent" or "team" never satisfies a concept on its own.
 */
export interface MustHaveConcept {
  names: string[];
  evidence: RegExp[];
}

export const MUST_HAVE_CONCEPTS: MustHaveConcept[] = [
  {
    names: [
      "generative ai rag/search", "genai rag/search", "gen ai rag/search", "generative ai rag",
      "rag/search", "rag and search", "rag/vector search", "rag and vector search",
    ],
    evidence: [
      /\b(?:rag|retrieval[- ]augmented generation)\b/,
      /\b(?:vector|semantic|embeddings?)[- ](?:search|retrieval)\b/,
    ],
  },
  {
    names: [
      "chatbot/copilot", "copilot/chatbot", "ai copilot/chatbot", "ai chatbot/copilot", "chatbot", "ai chatbot",
      "ai copilot", "ai assistant", "conversational ai",
    ],
    evidence: [
      /\b(?:chat ?bots?|copilots?|ai assistants?|virtual assistants?|chat assistants?|conversational ai)\b/,
      /\b(?:quer\w*|ask\w*|answer\w*|search\w*|chat\w*)\b[^\n]{0,60}\bconversational(?:ly)?\b/,
      /\bconversational(?:ly)?\b[^\n]{0,60}\b(?:quer\w*|ask\w*|answer\w*|search\w*|interface)\b/,
      /\bnatural[- ]language (?:quer\w*|questions?|interface)\b/,
      /\b(?:llm|ai|bedrock|gpt|rag)[- ](?:powered |based )?assistants?\b/,
    ],
  },
  {
    names: ["enterprise knowledge assistant", "knowledge assistant", "internal knowledge assistant", "enterprise ai assistant"],
    evidence: [
      /\b(?:enterprise|internal) (?:knowledge|ai) assistants?\b/,
      /\b(?:internal|enterprise|company[- ]wide)\b[^\n]{0,60}\b(?:ai|llm|rag|gpt|chat\w*|copilot)\b[^\n]{0,100}\b(?:quer\w*|search\w*|ask\w*|answer\w*)\b[^\n]{0,40}\b(?:company|internal|enterprise|knowledge|documents?|data)\b/,
    ],
  },
];

/** The concept a must-have names, by its exact spelling (plural or singular), or null. */
export function conceptFor(term: string): MustHaveConcept | null {
  const k = term.toLowerCase().replace(/\s*\/\s*/g, "/").replace(/\s+/g, " ").trim();
  const keys = [k, k.replace(/s$/, "")];
  return MUST_HAVE_CONCEPTS.find((c) => keys.some((key) => c.names.includes(key))) ?? null;
}

/** Every non-empty string in a resume document, in order. */
export function resumeStrings(resume: unknown): string[] {
  const parts: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === "string") {
      if (v.trim()) parts.push(v.trim());
    } else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(resume);
  return parts;
}

const norm = (s: string) => s.toLowerCase().replace(/[‐-―]/g, "-");

/** A short piece of the resume string around a match; the whole string when it is short. */
function snippet(text: string, at: number, len: number): string {
  const max = 140;
  if (text.length <= max) return text;
  const from = Math.max(0, at);
  let start = Math.max(0, from - 40);
  let end = Math.min(text.length, Math.max(from + len + 40, start + 80), start + max);
  while (start > 0 && /\S/.test(text[start - 1])) start--;
  while (end < text.length && /\S/.test(text[end])) end++;
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}

/** Evidence for one requirement as a whole (never split into parts). */
function evidenceOne(texts: string[], term: string): string | null {
  const names = spellings(term);
  for (const t of texts) {
    const n = norm(t);
    for (const s of names) {
      const at = phraseAt(n, s);
      if (at !== null) return snippet(t, at, s.length);
    }
  }
  const concept = conceptFor(term);
  if (concept) {
    for (const re of concept.evidence) {
      for (const t of texts) {
        const m = re.exec(norm(t));
        if (m) return snippet(t, m.index, m[0].length);
      }
    }
  }
  return null;
}

/**
 * The resume snippet that shows a requirement, or null. Met as written, without a vendor
 * prefix ("AWS Lambda" by "Lambda"), through an alias ("LLM" by "large language models"),
 * through a documented concept ("chatbot/copilot" by a platform people query
 * conversationally) or, for a combined term such as "Node.js/TypeScript", when every part
 * is shown. A concept term is never split, so "Generative AI RAG/search" is not met by
 * "search" alone.
 */
export function findEvidence(texts: string[], term: string): string | null {
  const whole = evidenceOne(texts, term);
  if (whole) return whole;
  if (conceptFor(term)) return null;
  const parts = term.split(/\s*[\/,]\s*/).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  const found: string[] = [];
  for (const p of parts) {
    const e = evidenceOne(texts, p);
    if (!e) return null;
    if (!found.includes(e)) found.push(e);
  }
  return found.join(" | ");
}

/** findEvidence over a whole resume document (or any JSON holding its strings). */
export function matchMustHave(resume: unknown, term: string): string | null {
  return findEvidence(resumeStrings(resume), term);
}

/**
 * True when the resume text shows the requirement (see findEvidence).
 * `haystack` is resumeText() output (lower case).
 */
export function mentions(haystack: string, term: string): boolean {
  return findEvidence([haystack], term) !== null;
}
