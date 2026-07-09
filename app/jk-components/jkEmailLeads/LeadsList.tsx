// app/jk-components/jkEmailLeads/LeadsList.tsx
"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

export function LeadsList() {
  const leads = useQuery(api.jobLeads.list, {});
  const promote = useMutation(api.jobLeads.promoteToJob);

  if (leads === undefined) return <div>Loading...</div>;

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left border-b">
          <th className="py-2">Company</th>
          <th>Role</th>
          <th>Source</th>
          <th>Status</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {leads.map((lead) => (
          <tr key={lead._id} className="border-b">
            <td className="py-2">{lead.company}</td>
            <td>{lead.role}</td>
            <td>{lead.sourceType === "digest_listing" ? "Digest" : "Direct outreach"}</td>
            <td>{lead.status}</td>
            <td>
              {lead.status !== "promoted" && (
                <button
                  className="text-xs px-2 py-1 rounded border"
                  onClick={() => promote({ leadId: lead._id })}
                >
                  Promote to Jobs
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
