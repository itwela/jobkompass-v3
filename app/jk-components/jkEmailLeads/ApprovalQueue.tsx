// app/jk-components/jkEmailLeads/ApprovalQueue.tsx
"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useState } from "react";

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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftText, setDraftText] = useState("");
  // Only tracks the brief window between click and the `approve` mutation call resolving or
  // rejecting. Once `approve` resolves, the server's own `lead.status === "sending"` (from
  // `sendingLeads` above) is the source of truth for "is this lead currently sending" — so
  // this set is always cleared right after the mutation settles, on both success and failure,
  // and never persists across a later `markSendError` revert.
  const [approvingIds, setApprovingIds] = useState<Set<Id<"jobLeads">>>(new Set());

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
        <div key={lead._id} className="border rounded-lg p-4 space-y-2">
          <div className="flex items-baseline justify-between gap-3">
            <div className="font-medium">
              {lead.company} — {lead.role} {lead.isFollowUp && <span className="text-xs text-muted-foreground">(follow-up)</span>}
            </div>
            <div className="text-xs text-muted-foreground whitespace-nowrap">
              {new Date(lead.emailReceivedAt ?? lead.createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            {lead.senderEmail}
            {accountEmailById.get(lead.sourceAccountId) && (
              <> · to {accountEmailById.get(lead.sourceAccountId)}</>
            )}
          </div>
          {lead.draftResumeId ? (
            <div className="text-xs text-muted-foreground">
              📎 {resumeNameById.get(String(lead.draftResumeId)) ?? "Tailored resume"}{" "}
              <span className="opacity-70">(attached as PDF — view it in My Documents)</span>
            </div>
          ) : (
            <div className="text-xs text-amber-600">
              ⚠ No resume attached — this reply will send as text only.
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
            <button
              className="text-sm px-3 py-1 rounded bg-green-600 text-white disabled:cursor-not-allowed disabled:opacity-70"
              disabled={lead.status === "sending" || approvingIds.has(lead._id)}
              onClick={() => handleApprove(lead._id)}
            >
              {lead.status === "sending" || approvingIds.has(lead._id) ? "Sending..." : "Approve & Send"}
            </button>
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
