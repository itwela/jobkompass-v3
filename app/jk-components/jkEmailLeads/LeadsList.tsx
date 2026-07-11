// app/jk-components/jkEmailLeads/LeadsList.tsx
"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function formatLeadDate(lead: { emailReceivedAt?: number; createdAt: number }) {
  return new Date(lead.emailReceivedAt ?? lead.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

// "Dhruv Edgeglobal <dhruv@edgeglobal.net>" -> "Dhruv Edgeglobal" (full value in tooltip)
function senderDisplayName(senderEmail?: string) {
  if (!senderEmail) return null;
  const name = senderEmail.split("<")[0].trim().replace(/^"|"$/g, "");
  return name || senderEmail;
}

// Where clicking a lead should take you: the job posting itself for digest listings
// (poll stores the listing link in rawSnippet), otherwise the original email in Gmail.
export function leadLink(
  lead: { sourceType: string; rawSnippet: string; originalMessageId?: string },
  inboxEmail?: string
): string | null {
  if (lead.sourceType === "digest_listing" && /^https?:\/\//i.test(lead.rawSnippet.trim())) {
    return lead.rawSnippet.trim();
  }
  if (lead.originalMessageId && inboxEmail) {
    return `https://mail.google.com/mail/?authuser=${encodeURIComponent(inboxEmail)}#all/${lead.originalMessageId}`;
  }
  return null;
}

const STATUS_STYLES: Record<string, string> = {
  pending_approval: "bg-amber-500/15 text-amber-600",
  sending: "bg-blue-500/15 text-blue-600",
  sent: "bg-green-500/15 text-green-600",
  followed_up: "bg-green-500/15 text-green-600",
  replied: "bg-violet-500/15 text-violet-600",
  promoted: "bg-primary/10 text-primary",
  extracted: "bg-muted text-muted-foreground",
  new: "bg-muted text-muted-foreground",
};

export function LeadsList() {
  const leads = useQuery(api.jobLeads.list, {});
  const accounts = useQuery(api.emailAccounts.list, {});
  const promote = useMutation(api.jobLeads.promoteToJob);
  const deleteLead = useMutation(api.jobLeads.deleteLead);
  const requestDraft = useMutation(api.jobLeads.requestDraft);
  const [leadToDelete, setLeadToDelete] = useState<Doc<"jobLeads"> | null>(null);
  const [deleting, setDeleting] = useState(false);
  // Leads whose tailored resume was requested this session; cleared implicitly when
  // the lead's draftResumeId appears via the reactive query.
  const [tailoringIds, setTailoringIds] = useState<Set<string>>(new Set());

  const confirmDelete = async () => {
    if (!leadToDelete) return;
    setDeleting(true);
    try {
      await deleteLead({ leadId: leadToDelete._id });
      setLeadToDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  if (leads === undefined) return <div>Loading...</div>;
  if (leads.length === 0) {
    return <div className="text-sm text-muted-foreground">No leads yet.</div>;
  }

  const accountEmailById = new Map((accounts ?? []).map((a) => [a._id, a.email]));

  return (
    // Natural column widths + nowrap cells: the table grows to fit its content and the
    // wrapper scrolls horizontally, so cells can never overlap at any window width.
    <div className="border rounded-lg overflow-x-auto">
      <table className="w-full min-w-max text-sm">
        <thead>
          <tr className="text-left border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-3 py-2.5 font-medium">Company</th>
            <th className="px-3 py-2.5 font-medium">Role</th>
            <th className="px-3 py-2.5 font-medium">From</th>
            <th className="px-3 py-2.5 font-medium">Inbox</th>
            <th className="px-3 py-2.5 font-medium">Status</th>
            <th className="px-3 py-2.5 font-medium">Date</th>
            <th className="px-3 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => {
            const sender = senderDisplayName(lead.senderEmail);
            const inbox = accountEmailById.get(lead.sourceAccountId);
            const link = leadLink(lead, inbox);
            return (
              <tr key={lead._id} className="border-b last:border-b-0 hover:bg-muted/30 transition-colors">
                <td className="px-3 py-2.5 font-medium whitespace-nowrap" title={lead.company}>
                  {link ? (
                    <a
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block max-w-56 truncate hover:underline"
                      title={lead.sourceType === "digest_listing" ? "Open the job listing" : "Open the email in Gmail"}
                    >
                      {lead.company} <span className="text-muted-foreground">↗</span>
                    </a>
                  ) : (
                    <span className="block max-w-56 truncate">{lead.company}</span>
                  )}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap" title={lead.role}>
                  <span className="block max-w-80 truncate">{lead.role}</span>
                </td>
                <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap" title={lead.senderEmail || undefined}>
                  <span className="block max-w-48 truncate">{sender ?? <span className="opacity-50">—</span>}</span>
                </td>
                <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap" title={inbox}>
                  <span className="block max-w-56 truncate">{inbox || <span className="opacity-50">—</span>}</span>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                      STATUS_STYLES[lead.status] ?? "bg-muted text-muted-foreground"
                    }`}
                  >
                    {lead.status.replace(/_/g, " ")}
                  </span>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">{formatLeadDate(lead)}</td>
                <td className="px-3 py-2.5">
                  <div className="flex gap-1.5 justify-end items-center whitespace-nowrap">
                    {lead.draftResumeId && (
                      <span className="text-xs text-muted-foreground" title="Tailored resume PDF generated — find it in My Documents">
                        📎
                      </span>
                    )}
                    {lead.sourceType === "digest_listing" && !lead.draftMessage && (
                      <button
                        className="text-xs px-2 py-1 rounded border hover:bg-accent transition-colors disabled:opacity-60"
                        disabled={tailoringIds.has(lead._id)}
                        title="Tailor a resume + write an application draft; lands in Pending Approval"
                        onClick={() => {
                          setTailoringIds((prev) => new Set(prev).add(lead._id));
                          requestDraft({ leadId: lead._id });
                        }}
                      >
                        {tailoringIds.has(lead._id) ? "Drafting…" : "Make Draft"}
                      </button>
                    )}
                    {lead.status !== "promoted" && (
                      <button
                        className="text-xs px-2 py-1 rounded border hover:bg-accent transition-colors"
                        onClick={() => promote({ leadId: lead._id })}
                      >
                        Promote
                      </button>
                    )}
                    <button
                      className="text-xs px-2 py-1 rounded border border-red-500/30 text-red-500 hover:bg-red-500/10 transition-colors"
                      onClick={() => setLeadToDelete(lead)}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <Dialog open={leadToDelete !== null} onOpenChange={(open) => { if (!open) setLeadToDelete(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this lead?</DialogTitle>
            <DialogDescription>
              {leadToDelete && (
                <>
                  <span className="font-medium text-foreground">{leadToDelete.company}</span>
                  {" — "}{leadToDelete.role}. This removes it from JobKompass and the Life
                  Dashboard. It can&apos;t be undone.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <button
              className="text-sm px-3 py-1.5 rounded border hover:bg-accent transition-colors"
              onClick={() => setLeadToDelete(null)}
              disabled={deleting}
            >
              Cancel
            </button>
            <button
              className="text-sm px-3 py-1.5 rounded bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-70"
              onClick={confirmDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Yes, delete"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
