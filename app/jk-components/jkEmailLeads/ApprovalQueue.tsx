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
  // Bridges only the click → mutation-resolve gap; after that the server's
  // lead.resumeStatus ("generating"/"error") drives the button, so there's no
  // fake timer and the spinner lasts exactly as long as the real work.
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [expandedErrorId, setExpandedErrorId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"initial" | "followup">("initial");

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
    setExpandedErrorId((prev) => (prev === key ? null : prev)); // collapse any old error
    setPendingIds((prev) => new Set(prev).add(key));
    try {
      // The mutation flips the lead to resumeStatus="generating" and schedules the
      // async action, which sets "error" (with a message) or attaches the PDF.
      // Server state takes over from here — no local timer.
      await requestTailoredResume({ leadId });
    } finally {
      setPendingIds((prev) => { const next = new Set(prev); next.delete(key); return next; });
    }
  };

  if (pendingLeads === undefined || sendingLeads === undefined) return <div>Loading...</div>;
  const leads = [...pendingLeads, ...sendingLeads].sort(
    (a, b) => (b.emailReceivedAt ?? b.createdAt) - (a.emailReceivedAt ?? a.createdAt)
  );
  if (leads.length === 0) return <div className="text-sm text-muted-foreground">No drafts waiting for approval.</div>;

  const accountEmailById = new Map((accounts ?? []).map((a) => [a._id, a.email]));
  const resumeNameById = new Map((resumes ?? []).map((r: any) => [String(r._id), r.name]));

  // Split into two tabs: fresh replies/applications vs. week-later nudges. They read
  // and behave differently, so keeping them apart makes the queue easier to work.
  const initialLeads = leads.filter((l) => !l.isFollowUp);
  const followUpLeads = leads.filter((l) => l.isFollowUp);
  const visibleLeads = activeTab === "followup" ? followUpLeads : initialLeads;

  const tab = (id: "initial" | "followup", label: string, count: number) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
        activeTab === id
          ? "bg-primary text-primary-foreground font-medium"
          : "text-muted-foreground hover:bg-muted"
      }`}
    >
      {label}
      <span className={`ml-1.5 text-xs ${activeTab === id ? "opacity-80" : "opacity-60"}`}>{count}</span>
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 border-b pb-2">
        {tab("initial", "Initial messages", initialLeads.length)}
        {tab("followup", "Follow-ups", followUpLeads.length)}
      </div>
      {visibleLeads.length === 0 ? (
        <div className="text-sm text-muted-foreground">
          {activeTab === "followup" ? "No follow-ups waiting for approval." : "No initial messages waiting for approval."}
        </div>
      ) : (
      visibleLeads.map((lead) => (
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
          ) : (() => {
            const key = String(lead._id);
            const isGenerating = lead.resumeStatus === "generating" || pendingIds.has(key);
            const isError = lead.resumeStatus === "error" && !pendingIds.has(key);
            return (
              <div className="text-xs flex flex-col gap-1">
                <div className="text-amber-600 flex items-center gap-2 flex-wrap">
                  <span>⚠ No resume attached — this reply will send as text only.</span>
                  {isError ? (
                    <>
                      <button
                        className="px-2 py-0.5 rounded border border-red-500/60 bg-red-50 text-red-700 hover:bg-red-100 font-medium"
                        onClick={() => setExpandedErrorId((prev) => (prev === key ? null : key))}
                        title="Click to see what went wrong"
                      >
                        ⚠ Error — {expandedErrorId === key ? "hide" : "details"}
                      </button>
                      <button
                        className="px-2 py-0.5 rounded border border-amber-600/50 text-amber-700 hover:bg-amber-50"
                        onClick={() => handleGenerateResume(lead._id)}
                      >
                        Try again
                      </button>
                    </>
                  ) : (
                    <button
                      className="px-2 py-0.5 rounded border border-amber-600/50 text-amber-700 hover:bg-amber-50 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-1"
                      disabled={isGenerating}
                      onClick={() => handleGenerateResume(lead._id)}
                    >
                      {isGenerating && (
                        <span className="inline-block h-3 w-3 rounded-full border-2 border-amber-600/40 border-t-amber-700 animate-spin" />
                      )}
                      {isGenerating ? "Generating…" : "Generate résumé"}
                    </button>
                  )}
                </div>
                {isError && expandedErrorId === key && (
                  <div className="rounded border border-red-500/40 bg-red-50 text-red-800 p-2 whitespace-pre-wrap break-words">
                    {lead.resumeError || "No error detail was recorded."}
                  </div>
                )}
              </div>
            );
          })()}
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
      )))}
    </div>
  );
}
