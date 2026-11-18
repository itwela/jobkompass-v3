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

/** Every equivalent spelling of one requirement: as written, without a vendor, aliases. */
function spellings(term: string): string[] {
  const out = new Set<string>();
  const add = (t: string) => {
    const k = t.toLowerCase().trim();
    if (!k || out.has(k)) return;
    out.add(k);
    for (const group of MUST_HAVE_ALIASES) if (group.includes(k)) group.forEach(add);
    const bare = stripVendor(k);
    if (bare) add(bare);
  };
  add(term);
  return [...out];
}

/** True when the exact phrase appears as a whole word or phrase ("Java" never inside "JavaScript"). */
function phraseIn(haystack: string, term: string): boolean {
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
 * True when the resume text shows the requirement: as written, without a vendor prefix
 * ("AWS Lambda" is met by "Lambda"), through an alias ("LLM" by "large language
 * models"), or, for a combined term such as "Node.js/TypeScript", when every part is shown.
 * `haystack` is resumeText() output (lower case).
 */
export function mentions(haystack: string, term: string): boolean {
  const one = (t: string) => spellings(t).some((s) => phraseIn(haystack, s));
  if (one(term)) return true;
  const parts = term.split(/\s*[\/,]\s*/).map((p) => p.trim()).filter(Boolean);
  return parts.length > 1 && parts.every(one);
}
