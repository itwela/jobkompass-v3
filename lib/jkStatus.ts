// Job status vocabulary shared by the status bar, chips and tables.
// Colours live in app/globals.css as --status-<key>.

export const JOB_STATUSES = [
  "Interested",
  "Applied",
  "Callback",
  "Interviewing",
  "Offered",
  "Rejected",
  "Ghosted",
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];
export type StatusKey = Lowercase<JobStatus>;

const ALIASES: Record<string, StatusKey> = { offer: "offered", interview: "interviewing" };

/** Token key for a status string. Unknown values read as the neutral "ghosted". */
export function statusKey(status: string | null | undefined): StatusKey {
  const s = (status ?? "").trim().toLowerCase();
  if (ALIASES[s]) return ALIASES[s];
  return (JOB_STATUSES.map((x) => x.toLowerCase()) as string[]).includes(s) ? (s as StatusKey) : "ghosted";
}

export interface StatusCount {
  status: string;
  count: number;
}

/** Width of each segment as a percentage of the bar. Bad counts are treated as zero. */
export function segmentWidths(counts: StatusCount[]): (StatusCount & { width: number })[] {
  const clean = counts.map((c) => ({ ...c, count: Number.isFinite(c.count) && c.count > 0 ? c.count : 0 }));
  const total = clean.reduce((a, c) => a + c.count, 0);
  return clean.map((c) => ({ ...c, width: total === 0 ? 0 : (c.count / total) * 100 }));
}

// Static class names so Tailwind can see them.
export const STATUS_BG: Record<StatusKey, string> = {
  interested: "bg-status-interested",
  applied: "bg-status-applied",
  callback: "bg-status-callback",
  interviewing: "bg-status-interviewing",
  offered: "bg-status-offered",
  rejected: "bg-status-rejected",
  ghosted: "bg-status-ghosted",
};
export const STATUS_TEXT: Record<StatusKey, string> = {
  interested: "text-status-interested",
  applied: "text-warn-ink",
  callback: "text-status-callback",
  interviewing: "text-status-interviewing",
  offered: "text-status-offered",
  rejected: "text-status-rejected",
  ghosted: "text-status-ghosted",
};
