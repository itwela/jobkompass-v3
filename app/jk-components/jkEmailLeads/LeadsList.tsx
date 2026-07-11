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

export function LeadsList() {
  const leads = useQuery(api.jobLeads.list, {});
  const accounts = useQuery(api.emailAccounts.list, {});
  const promote = useMutation(api.jobLeads.promoteToJob);
  const deleteLead = useMutation(api.jobLeads.deleteLead);

  if (leads === undefined) return <div>Loading...</div>;

  const accountEmailById = new Map((accounts ?? []).map((a) => [a._id, a.email]));

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left border-b">
          <th className="py-2">Company</th>
          <th>Role</th>
          <th>From</th>
          <th>Inbox</th>
          <th>Source</th>
          <th>Status</th>
          <th>Date</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {leads.map((lead) => (
          <tr key={lead._id} className="border-b">
            <td className="py-2">{lead.company}</td>
            <td>{lead.role}</td>
            <td className="text-muted-foreground max-w-48 truncate">{lead.senderEmail || "—"}</td>
            <td className="text-muted-foreground whitespace-nowrap">
              {accountEmailById.get(lead.sourceAccountId) || "—"}
            </td>
            <td>{lead.sourceType === "digest_listing" ? "Digest" : "Direct outreach"}</td>
            <td>{lead.status}</td>
            <td className="whitespace-nowrap">{formatLeadDate(lead)}</td>
            <td>
              <div className="flex gap-2 justify-end">
                {lead.status !== "promoted" && (
                  <button
                    className="text-xs px-2 py-1 rounded border"
                    onClick={() => promote({ leadId: lead._id })}
                  >
                    Promote to Jobs
                  </button>
                )}
                <button
                  className="text-xs px-2 py-1 rounded border border-red-300 text-red-600"
                  onClick={() => deleteLead({ leadId: lead._id })}
                >
                  Delete
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
