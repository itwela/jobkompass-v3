/**
 * Small pure helpers behind the v4 My Documents grid and resume editor (D07 / D08).
 * No React, no Convex, so each rule is tested on its own.
 */

type JobLike = { company?: string | null; resumeUsed?: string | null; coverLetterUsed?: string | null; updatedAt?: number; _creationTime?: number };
type DocLike = { _id?: unknown; name?: string | null; documentType?: string };

const norm = (s?: string | null) => (s ?? "").trim().toLowerCase();

/**
 * The company a document was used for: the most recent job whose `resumeUsed`
 * (or `coverLetterUsed`) names this document. Jobs store the document's name
 * (the chat tool writes the name), and some store the id, so both match.
 * Returns null when no job links to it — the card then shows the edited date.
 */
export function linkedCompanyFor(doc: DocLike, jobs: JobLike[] | undefined | null): string | null {
  if (!jobs?.length) return null;
  const name = norm(doc.name);
  const id = norm(String(doc._id ?? ""));
  const field = doc.documentType === "cover-letter" ? "coverLetterUsed" : "resumeUsed";
  let best: JobLike | null = null;
  for (const job of jobs) {
    const used = norm(job[field]);
    if (!used || !job.company?.trim()) continue;
    if (used !== name && used !== id) continue;
    if (!best || (job.updatedAt ?? job._creationTime ?? 0) > (best.updatedAt ?? best._creationTime ?? 0)) best = job;
  }
  return best?.company?.trim() || null;
}

/** "Mar" from "mar" / "JobKompass Mar". */
export function templateShortName(templateName?: string | null): string | null {
  if (!templateName) return null;
  return templateName.replace(/^JobKompass\s+/i, "").trim() || null;
}

/** "Nov 5", or "Nov 5, 2025" when it is not this year. */
export function shortDate(ms: number, now = Date.now()): string {
  const d = new Date(ms);
  const sameYear = d.getFullYear() === new Date(now).getFullYear();
  return d.toLocaleDateString("en-US", sameYear ? { month: "short", day: "numeric" } : { month: "short", day: "numeric", year: "numeric" });
}

/** "edited just now" / "edited 3 hours ago" / "edited 2 days ago" / "edited Oct 2". */
export function editedAgo(ms: number, now = Date.now()): string {
  const diff = Math.max(0, now - ms);
  const min = Math.floor(diff / 60000);
  if (min < 1) return "edited just now";
  if (min < 60) return `edited ${min} minute${min === 1 ? "" : "s"} ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `edited ${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `edited ${d} day${d === 1 ? "" : "s"} ago`;
  return `edited ${shortDate(ms, now)}`;
}

/** Pages in a PDF, counted from its page objects. Null when it can't tell. */
export function countPdfPages(bytes: Uint8Array): number | null {
  // latin1 keeps every byte as one char, so the regex sees the raw object syntax.
  let text = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) text += String.fromCharCode(...bytes.subarray(i, i + chunk));
  const count = text.match(/\/Type\s*\/Page(?![a-zA-Z])/g)?.length ?? 0;
  return count > 0 ? count : null;
}

/** Move one item in a list (drag-reorder). Out-of-range indexes return the list unchanged. */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/**
 * Read the assistant's answer to a "rewrite this bullet" request: a short reason
 * line, then the rewritten bullet in quotes. Any `updates` block is ignored.
 * Returns null when no usable rewrite came back.
 */
export function parseRewrite(text: string, original: string): { reason: string; suggestion: string } | null {
  const body = text.replace(/```[\s\S]*?```/g, "").trim();
  if (!body) return null;
  const quoted = [...body.matchAll(/[“"]([^”"]{8,})[”"]/g)].map((m) => m[1].trim());
  let suggestion = quoted[quoted.length - 1] ?? "";
  let reason = "";
  if (suggestion) {
    const at = body.lastIndexOf(suggestion);
    reason = body.slice(0, Math.max(0, at - 1)).replace(/[“"]\s*$/, "").trim();
  } else {
    const lines = body.split(/\n+/).map((l) => l.trim()).filter(Boolean);
    suggestion = (lines.length > 1 ? lines[lines.length - 1] : lines[0] ?? "").replace(/^[-•*]\s*/, "");
    reason = lines.length > 1 ? lines.slice(0, -1).join(" ") : "";
  }
  suggestion = suggestion.replace(/^[-•*]\s*/, "").trim();
  if (!suggestion || norm(suggestion) === norm(original)) return null;
  return { reason: reason.replace(/\s+/g, " "), suggestion };
}

/**
 * Drop the blank bullets / skill lines an editor leaves while someone types,
 * so the PDF never renders an empty "•". Returns a new object.
 */
export function cleanResumeContent<T>(content: T): T {
  const c = JSON.parse(JSON.stringify(content ?? {}));
  const strip = (a: unknown) => (Array.isArray(a) ? a.filter((s) => typeof s !== "string" || s.trim().length > 0).map((s) => (typeof s === "string" ? s.trim() : s)) : a);
  if (c.skills) {
    if (c.skills.technical) c.skills.technical = strip(c.skills.technical);
    if (c.skills.additional) c.skills.additional = strip(c.skills.additional);
  }
  for (const key of ["experience", "internships", "projects", "education"]) {
    if (Array.isArray(c[key])) for (const item of c[key]) if (item && Array.isArray(item.details)) item.details = strip(item.details);
  }
  return c;
}
