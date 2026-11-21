/**
 * Where a job came from, for the My Jobs "Source" column.
 * Jobs have no stored source yet, so this reads it from what agents already save:
 * the job link (a Gmail or Outlook message link means it came from email) and the notes
 * (inbox, sender and received date, written as "SOURCE: ..." / "Recruiter Name <email>").
 */
export type JobSourceKind = "gmail" | "outlook" | "web" | "none"

export type JobSource = {
  kind: JobSourceKind
  /** Host of the posting, "web" only. */
  host?: string
  /** Readable site name, "web" only (Greenhouse, Amazon Jobs...). */
  site?: string
  /** Inbox the email arrived in, email only. */
  inbox?: string
  /** "Name <address>" of the sender, email only. */
  sender?: string
  /** Received date as written in the notes, email only. */
  received?: string
  /** Link to open (the email or the posting). */
  url?: string
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

const INBOX = /[\w.+-]+@(?:gmail\.com|outlook\.com|hotmail\.com|wgu\.edu|[\w-]+\.edu)/i
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

export function jobSource(job: { link?: string | null; notes?: string | null }): JobSource {
  const host = hostOf(job.link)
  const notes = job.notes ?? ""
  if (host === "mail.google.com") return { kind: "gmail", url: job.link!.trim(), ...emailDetails(notes) }
  if (host && (host.startsWith("outlook.") || host.endsWith(".outlook.com") || host === "outlook.cloud.microsoft"))
    return { kind: "outlook", url: job.link!.trim(), ...emailDetails(notes) }
  // A meeting link is where an interview happens, not where the job came from.
  if (!host || host === "meet.google.com" || host.endsWith("zoom.us") || host === "teams.microsoft.com") return { kind: "none" }
  return { kind: "web", host, site: siteName(host), url: job.link!.trim() }
}
