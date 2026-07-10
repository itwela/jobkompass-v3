'use client'

import { ApprovalQueue } from "@/app/jk-components/jkEmailLeads/ApprovalQueue"
import { LeadsList } from "@/app/jk-components/jkEmailLeads/LeadsList"

export default function JkCW_LeadsMode() {
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
          <h2 className="text-lg font-semibold mb-4">Pending Approval</h2>
          <ApprovalQueue />
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-4">All Leads</h2>
          <LeadsList />
        </section>
      </div>
    </div>
  )
}
