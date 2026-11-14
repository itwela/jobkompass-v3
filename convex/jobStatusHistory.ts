// Pure helper for jobs.statusHistory: one entry per status change, oldest first.
// Kept free of Convex imports so it can be unit tested and used by every insert/patch path.

export interface StatusEvent {
  status: string;
  at: number;
}

/**
 * Returns the history with `status` appended when it differs from the current status.
 * `current` is the job's status before the change (undefined for a new job).
 * Returns null when nothing changed, so callers can skip the patch field.
 */
export function nextStatusHistory(
  history: StatusEvent[] | undefined,
  current: string | undefined,
  status: string | undefined,
  at: number,
): StatusEvent[] | null {
  const next = (status ?? "").trim();
  if (!next) return null;
  if (current !== undefined && current.trim() === next) return null;
  return [...(history ?? []), { status: next, at }];
}
