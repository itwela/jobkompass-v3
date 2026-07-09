const FOLLOW_UP_DELAY_MS = 6 * 24 * 60 * 60 * 1000;

export function isEligibleForFollowUp(
  lead: { status: string; sentAt?: number; followUpSentAt?: number },
  now: number
): boolean {
  if (lead.status !== "sent") return false;
  if (lead.followUpSentAt) return false;
  if (!lead.sentAt) return false;
  return now - lead.sentAt >= FOLLOW_UP_DELAY_MS;
}
