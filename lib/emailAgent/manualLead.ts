import type { ClassificationResult } from "./classify";

export type SenderHit = {
  accountId: string;
  accountEmail: string;
  messageId: string;
  threadId: string;
  subject: string;
  snippet: string;
  receivedAt: number;
  rfcMessageId: string;
};

/**
 * Best-effort company name derived from a sender's email domain, used only as a
 * fallback when the classifier can't extract a real company. e.g.
 * "jane@acme-corp.com" -> "Acme-corp".
 */
export function companyFromEmail(senderEmail: string): string {
  const domain = senderEmail.split("@")[1];
  if (!domain || !domain.includes(".")) return "Unknown company";
  const label = domain.split(".").slice(-2, -1)[0];
  if (!label) return "Unknown company";
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/**
 * A manually-added email is always treated as a lead. Use the classifier's
 * company/role when it recognized personal outreach; otherwise fall back to the
 * sender's domain so the lead (and its tailored resume) is never dropped.
 */
export function resolveLeadFields(
  classification: ClassificationResult | null,
  senderEmail: string
): { company: string; role: string } {
  if (classification && classification.type === "personal_outreach") {
    return { company: classification.company, role: classification.role };
  }
  return { company: companyFromEmail(senderEmail), role: "Unknown role" };
}

/** Flatten per-account search hits, newest-first, capped at `max` (default 3). */
export function mergeTopMessages(perAccount: SenderHit[][], max = 3): SenderHit[] {
  return perAccount
    .flat()
    .sort((a, b) => b.receivedAt - a.receivedAt)
    .slice(0, max);
}
