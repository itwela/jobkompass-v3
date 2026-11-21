/**
 * Where a job came from, for the My Jobs "Source" column.
 *
 * Stored on the job as `source` when it is added (convex/jobs.ts, convex/agent/fns.ts,
 * the extension and email leads all call `buildJobSource`). Jobs saved before that have
 * no stored source, so `jobSource` falls back to reading it from the link and notes.
 */
export type JobSourceKind = "gmail" | "outlook" | "email" | "web" | "extension" | "none"

export type JobSource = {
  kind: JobSourceKind
  /** Host of the posting (web / extension). */
  host?: string
  /** Readable site name (Greenhouse, Amazon Jobs...). */
  site?: string
  /** Inbox the email arrived in. */
  inbox?: string
  /** "Name <address>" of the sender. */
  sender?: string
  /** Received date, as given. */
  received?: string
  /** Link to open (the email or the posting). */
  url?: string
}

/** What a caller may say about the source when adding a job. All optional. */
export type JobSourceInput = {
  kind?: JobSourceKind
  inbox?: string
  sender?: string
  received?: string
}

const SITES: Record<string, string> = {
  "amazon.jobs": "Amazon Jobs",
  "job-boards.greenhouse.io": "Greenhouse",
  "boards.greenhouse.io": "Greenhouse",
  "jobs.ashbyhq.com": "Ashby",
  "jobs.lever.co": "Lever",
  "ycombinator.com": "Y Combinator",
  "workatastartup.com": "Work at a Startup",
  "wellfound.com": "Wellfound",
  "indeed.com": "Indeed",
  "linkedin.com": "LinkedIn",
  "simplyhired.com": "SimplyHired",
  "dice.com": "Dice",
  "glassdoor.com": "Glassdoor",
  "ziprecruiter.com": "ZipRecruiter",
}

function hostOf(link?: string | null): string | null {
  if (!link) return null
  try {
    return new URL(link.trim()).hostname.toLowerCase().replace(/^www\./, "")
  } catch {
    return null
  }
}

function siteName(host: string): string {
  if (SITES[host]) return SITES[host]
  if (host.endsWith(".joinhandshake.com")) return "Handshake"
  if (host.includes("myworkdayjobs.com")) return "Workday"
  return host
}

const INBOX = /[\w.+-]+@(?:gmail\.com|outlook\.com|hotmail\.com|[\w-]+\.edu)/i
const SENDER = /([A-Z][a-z]+(?: [A-Z][a-z]+)?)\s*<([^<>@\s]+@[^<>\s]+)>/
const RECEIVED =
  /(\d{4}-\d{2}-\d{2}(?: \d{1,2}:\d{2} ?[AP]M(?: ET)?)?|(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\w*,? [A-Z][a-z]+ \d{1,2},? \d{4}(?:,? \d{1,2}:\d{2} ?[AP]M(?: ET)?)?|[A-Z][a-z]{2} \d{1,2}, \d{4}(?: at \d{1,2}:\d{2} ?[AP]M(?: ET)?)?)/

function emailDetails(notes: string) {
  const sender = notes.match(SENDER)
  return {
    inbox: notes.match(INBOX)?.[0],
    sender: sender ? `${sender[1]} <${sender[2]}>` : undefined,
    received: notes.match(RECEIVED)?.[0]?.trim(),
  }
}

const isOutlook = (host: string) => host.startsWith("outlook.") || host.endsWith(".outlook.com") || host === "outlook.cloud.microsoft"
const isMeeting = (host: string) => host === "meet.google.com" || host.endsWith("zoom.us") || host === "teams.microsoft.com"

/** Read the source from the link and notes alone (jobs saved before `source` was stored). */
export function deriveJobSource(job: { link?: string | null; notes?: string | null }): JobSource {
  const host = hostOf(job.link)
  const notes = job.notes ?? ""
  if (host === "mail.google.com") return { kind: "gmail", url: job.link!.trim(), ...emailDetails(notes) }
  if (host && isOutlook(host)) return { kind: "outlook", url: job.link!.trim(), ...emailDetails(notes) }
  // A meeting link is where an interview happens, not where the job came from.
  if (!host || isMeeting(host)) return { kind: "none" }
  return { kind: "web", host, site: siteName(host), url: job.link!.trim() }
}

const clean = (s?: string) => {
  const t = s?.trim()
  return t ? t.slice(0, 200) : undefined
}

/**
 * The source to store on a new job: what the caller said wins, the link and notes fill
 * the gaps. Never returns undefined fields (Convex rejects them in nested objects).
 */
export function buildJobSource(job: { link?: string | null; notes?: string | null }, given?: JobSourceInput): JobSource {
  const derived = deriveJobSource(job)
  let kind = given?.kind ?? derived.kind
  // An email the caller flagged with a Gmail/Outlook link: name the app.
  if (kind === "email" && (derived.kind === "gmail" || derived.kind === "outlook")) kind = derived.kind
  const out: JobSource = { kind }
  const host = hostOf(job.link)
  const fields: Partial<JobSource> = {
    inbox: clean(given?.inbox) ?? (kind === derived.kind ? derived.inbox : undefined),
    sender: clean(given?.sender) ?? (kind === derived.kind ? derived.sender : undefined),
    received: clean(given?.received) ?? (kind === derived.kind ? derived.received : undefined),
    url: host && !isMeeting(host) ? job.link!.trim() : undefined,
    host: (kind === "web" || kind === "extension") && host ? host : undefined,
    site: (kind === "web" || kind === "extension") && host ? siteName(host) : undefined,
  }
  for (const [k, v] of Object.entries(fields)) if (v !== undefined) (out as Record<string, unknown>)[k] = v
  return out
}

/** The source to show: the stored one when the job has it, else read from link and notes. */
export function jobSource(job: { link?: string | null; notes?: string | null; source?: JobSource | null }): JobSource {
  return job.source ?? deriveJobSource(job)
}
