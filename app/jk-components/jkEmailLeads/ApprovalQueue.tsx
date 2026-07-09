// app/jk-components/jkEmailLeads/ApprovalQueue.tsx
"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";

export function ApprovalQueue() {
  const leads = useQuery(api.jobLeads.list, { status: "pending_approval" });
  const approve = useMutation(api.jobLeads.approve);
  const reject = useMutation(api.jobLeads.reject);
  const editDraft = useMutation(api.jobLeads.editDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftText, setDraftText] = useState("");

  if (leads === undefined) return <div>Loading...</div>;
  if (leads.length === 0) return <div className="text-sm text-muted-foreground">No drafts waiting for approval.</div>;

  return (
    <div className="space-y-4">
      {leads.map((lead) => (
        <div key={lead._id} className="border rounded-lg p-4 space-y-2">
          <div className="font-medium">
            {lead.company} — {lead.role} {lead.isFollowUp && <span className="text-xs text-muted-foreground">(follow-up)</span>}
          </div>
          <div className="text-xs text-muted-foreground">{lead.senderEmail}</div>
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
              className="text-sm px-3 py-1 rounded bg-green-600 text-white"
              onClick={() => approve({ leadId: lead._id })}
            >
              Approve & Send
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
