'use client'

import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { ApprovalQueue } from "@/app/jk-components/jkEmailLeads/ApprovalQueue"
import { LeadsList } from "@/app/jk-components/jkEmailLeads/LeadsList"

export default function JkCW_LeadsMode() {
  // Same subscription the child components use — Convex dedupes it, and having the
  // full list here lets the section headers show live totals so it's obvious whether
  // leads/drafts generated at all.
  const leads = useQuery(api.jobLeads.list, {})
  const totalCount = leads?.length
  const pendingCount = leads?.filter(
    (l) => l.status === "pending_approval" || l.status === "sending"
  ).length

  return (
    <div className="flex flex-col h-full overflow-y-auto chat-scroll bg-gradient-to-br from-background via-background to-muted/20">
      <div className="max-w-7xl mx-auto w-full px-6 py-8 space-y-8">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Job Leads</h1>
          <p className="text-sm text-muted-foreground">
            Recruiter outreach and job-board digests picked up by the email agent.
          </p>
        </div>

        <section>
          <h2 className="text-lg font-semibold mb-4">
            Pending Approval{pendingCount !== undefined && ` (${pendingCount})`}
          </h2>
          <ApprovalQueue />
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-4">
            All Leads{totalCount !== undefined && ` (${totalCount})`}
          </h2>
          <LeadsList />
        </section>
      </div>
    </div>
  )
}
