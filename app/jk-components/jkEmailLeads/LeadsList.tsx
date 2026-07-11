// app/jk-components/jkEmailLeads/LeadsList.tsx
"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

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

  if (leads === undefined) return <div>Loading...</div>;
  if (leads.length === 0) {
    return <div className="text-sm text-muted-foreground">No leads yet.</div>;
  }

  const accountEmailById = new Map((accounts ?? []).map((a) => [a._id, a.email]));

  return (
    <div className="border rounded-lg overflow-x-auto">
      <table className="w-full text-sm table-fixed min-w-[860px]">
        <colgroup>
          <col className="w-[17%]" />
          <col className="w-[27%]" />
          <col className="w-[15%]" />
          <col className="w-[13%]" />
          <col className="w-[10%]" />
          <col className="w-[6%]" />
          <col className="w-[12%]" />
        </colgroup>
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
            return (
              <tr key={lead._id} className="border-b last:border-b-0 hover:bg-muted/30 transition-colors">
                <td className="px-3 py-2.5 font-medium truncate" title={lead.company}>
                  {lead.company}
                </td>
                <td className="px-3 py-2.5 truncate" title={lead.role}>
                  {lead.role}
                </td>
                <td className="px-3 py-2.5 text-muted-foreground truncate" title={lead.senderEmail || undefined}>
                  {sender ?? <span className="opacity-50">—</span>}
                </td>
                <td className="px-3 py-2.5 text-muted-foreground truncate" title={inbox}>
                  {inbox || <span className="opacity-50">—</span>}
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
                  <div className="flex gap-1.5 justify-end whitespace-nowrap">
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
                      onClick={() => deleteLead({ leadId: lead._id })}
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
    </div>
  );
}
