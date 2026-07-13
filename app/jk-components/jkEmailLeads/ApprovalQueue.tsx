// app/jk-components/jkEmailLeads/ApprovalQueue.tsx
"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useState } from "react";
import { leadLink } from "./LeadsList";

export function ApprovalQueue() {
  // Query both statuses: `pending_approval` is the normal queue, and `sending` is the brief
  // (or, if stuck, not-so-brief) window while `sendApprovedLead` runs. Including `sending`
  // leads means a lead reverted by `markSendError` (back to `pending_approval`) or by the
  // `reconcileStuckSends` cron reappears with a real, server-driven "Sending..." state in
  // between, instead of vanishing from the list entirely while the local component still
  // thinks it's in flight.
  const pendingLeads = useQuery(api.jobLeads.list, { status: "pending_approval" });
  const sendingLeads = useQuery(api.jobLeads.list, { status: "sending" });
  const accounts = useQuery(api.emailAccounts.list, {});
  const resumes = useQuery(api.documents.listResumes);
  const approve = useMutation(api.jobLeads.approve);
  const reject = useMutation(api.jobLeads.reject);
  const editDraft = useMutation(api.jobLeads.editDraft);
  const markSeen = useMutation(api.jobLeads.markSeen);
  const requestTailoredResume = useMutation(api.jobLeads.requestTailoredResume);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftText, setDraftText] = useState("");
  // Only tracks the brief window between click and the `approve` mutation call resolving or
  // rejecting. Once `approve` resolves, the server's own `lead.status === "sending"` (from
  // `sendingLeads` above) is the source of truth for "is this lead currently sending" — so
  // this set is always cleared right after the mutation settles, on both success and failure,
  // and never persists across a later `markSendError` revert.
  const [approvingIds, setApprovingIds] = useState<Set<Id<"jobLeads">>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set());

  const handleApprove = async (leadId: Id<"jobLeads">) => {
    setApprovingIds((prev) => new Set(prev).add(leadId));
    try {
      await approve({ leadId });
    } finally {
      setApprovingIds((prev) => {
        if (!prev.has(leadId)) return prev;
        const next = new Set(prev);
        next.delete(leadId);
        return next;
      });
    }
  };

  const handleGenerateResume = async (leadId: Id<"jobLeads">) => {
    const key = String(leadId);
    setGeneratingIds((prev) => new Set(prev).add(key));
    try {
      await requestTailoredResume({ leadId });
    } catch {
      setGeneratingIds((prev) => { const next = new Set(prev); next.delete(key); return next; });
      return;
    }
    // The PDF is generated + attached asynchronously (a scheduled action); the card flips to
    // the "📎 attached" view reactively when it lands. Clear the spinner after a fallback window.
    setTimeout(() => {
      setGeneratingIds((prev) => { const next = new Set(prev); next.delete(key); return next; });
    }, 20000);
  };

  if (pendingLeads === undefined || sendingLeads === undefined) return <div>Loading...</div>;
  const leads = [...pendingLeads, ...sendingLeads].sort(
    (a, b) => (b.emailReceivedAt ?? b.createdAt) - (a.emailReceivedAt ?? a.createdAt)
  );
  if (leads.length === 0) return <div className="text-sm text-muted-foreground">No drafts waiting for approval.</div>;

  const accountEmailById = new Map((accounts ?? []).map((a) => [a._id, a.email]));
  const resumeNameById = new Map((resumes ?? []).map((r: any) => [String(r._id), r.name]));

  return (
    <div className="space-y-4">
      {leads.map((lead) => (
        <div
          key={lead._id}
          className="border rounded-lg p-4 space-y-2"
          onClick={() => { if (!lead.seenAt) markSeen({ leadId: lead._id }); }}
        >
          <div className="flex items-baseline justify-between gap-3">
            <div className="font-medium flex items-center gap-2">
              {!lead.seenAt && (
                <span className="shrink-0 inline-block px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-primary text-primary-foreground" title="New — you haven't opened this yet">
                  New
                </span>
              )}
              <span>{lead.company} — {lead.role} {lead.isFollowUp && <span className="text-xs text-muted-foreground">(follow-up)</span>}</span>
            </div>
            <div className="text-xs text-muted-foreground whitespace-nowrap">
              {new Date(lead.emailReceivedAt ?? lead.createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            {lead.senderEmail || "Job-board listing (no sender)"}
            {accountEmailById.get(lead.sourceAccountId) && (
              <> · to {accountEmailById.get(lead.sourceAccountId)}</>
            )}
            {leadLink(lead, accountEmailById.get(lead.sourceAccountId)) && (
              <>
                {" · "}
                <a
                  href={leadLink(lead, accountEmailById.get(lead.sourceAccountId))!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-foreground"
                >
                  {lead.sourceType === "digest_listing" ? "open listing ↗" : "view email ↗"}
                </a>
              </>
            )}
          </div>
          {lead.draftResumeId ? (
            <div className="text-xs text-muted-foreground">
              📎 {resumeNameById.get(String(lead.draftResumeId)) ?? "Tailored resume"}{" "}
              <span className="opacity-70">(attached as PDF — view it in My Documents)</span>
            </div>
          ) : (
            <div className="text-xs text-amber-600 flex items-center gap-2 flex-wrap">
              <span>⚠ No resume attached — this reply will send as text only.</span>
              <button
                className="px-2 py-0.5 rounded border border-amber-600/50 text-amber-700 hover:bg-amber-50 disabled:opacity-60 disabled:cursor-not-allowed"
                disabled={generatingIds.has(String(lead._id))}
                onClick={() => handleGenerateResume(lead._id)}
              >
                {generatingIds.has(String(lead._id)) ? "Generating…" : "Generate résumé"}
              </button>
            </div>
          )}
          {editingId === lead._id ? (
            <textarea
              className="w-full border rounded p-2 text-sm"
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              rows={4}
            />
          ) : (
            <p className="text-sm whitespace-pre-wrap">{lead.draftMessage}</p>
          )}
          <div className="flex gap-2">
            {editingId === lead._id ? (
              <button
                className="text-sm px-3 py-1 rounded bg-primary text-primary-foreground"
                onClick={async () => {
                  await editDraft({ leadId: lead._id, draftMessage: draftText });
                  setEditingId(null);
                }}
              >
                Save
              </button>
            ) : (
              <button
                className="text-sm px-3 py-1 rounded border"
                onClick={() => {
                  setEditingId(lead._id);
                  setDraftText(lead.draftMessage || "");
                }}
              >
                Edit
              </button>
            )}
            {lead.senderEmail ? (
              <button
                className="text-sm px-3 py-1 rounded bg-green-600 text-white disabled:cursor-not-allowed disabled:opacity-70"
                disabled={lead.status === "sending" || approvingIds.has(lead._id)}
                onClick={() => handleApprove(lead._id)}
              >
                {lead.status === "sending" || approvingIds.has(lead._id) ? "Sending..." : "Approve & Send"}
              </button>
            ) : (
              // Job-board listing: nothing to send a reply to — the draft is for
              // pasting into the application (open listing link is in the header).
              <button
                className="text-sm px-3 py-1 rounded bg-green-600 text-white"
                onClick={async () => {
                  await navigator.clipboard.writeText(lead.draftMessage || "");
                  setCopiedId(lead._id);
                  setTimeout(() => setCopiedId((prev) => (prev === lead._id ? null : prev)), 1500);
                }}
              >
                {copiedId === lead._id ? "Copied ✓" : "Copy Draft"}
              </button>
            )}
            <button
              className="text-sm px-3 py-1 rounded bg-red-600 text-white"
              onClick={() => reject({ leadId: lead._id })}
            >
              Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
