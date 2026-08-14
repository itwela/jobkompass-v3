'use client'

import { useState } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { Button } from "@/components/ui/button"
import { ApprovalQueue } from "@/app/jk-components/jkEmailLeads/ApprovalQueue"
import { LeadsList } from "@/app/jk-components/jkEmailLeads/LeadsList"
import { ScanNowButton } from "@/app/jk-components/jkEmailLeads/ScanNowButton"
import { AddLeadFromEmail } from "@/app/jk-components/jkEmailLeads/AddLeadFromEmail"
import JkConfirmDelete from "../jkConfirmDelete"

export default function JkCW_LeadsMode() {
  // Same subscription the child components use — Convex dedupes it, and having the
  // full list here lets the section headers show live totals so it's obvious whether
  // leads/drafts generated at all.
  const leads = useQuery(api.jobLeads.list, {})
  const totalCount = leads?.length
  const pendingCount = leads?.filter(
    (l) => l.status === "pending_approval" || l.status === "sending"
  ).length
  const leadIds = (leads ?? []).map((l) => l._id)

  const deleteLead = useMutation(api.jobLeads.deleteLead)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedLeadIds, setSelectedLeadIds] = useState<Id<"jobLeads">[]>([])
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false)
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)
  const [bulkDeleteError, setBulkDeleteError] = useState<string | null>(null)

  const handleEnterSelectionMode = () => {
    setSelectionMode(true)
    setBulkDeleteError(null)
  }

  const handleExitSelectionMode = () => {
    setSelectionMode(false)
    setSelectedLeadIds([])
    setShowBulkDeleteConfirm(false)
    setBulkDeleteError(null)
  }

  const toggleLeadSelection = (id: Id<"jobLeads">) => {
    setSelectedLeadIds((prev) =>
      prev.includes(id) ? prev.filter((leadId) => leadId !== id) : [...prev, id]
    )
  }

  const handleSelectAllVisible = () => {
    setSelectedLeadIds(leadIds)
  }

  const handleConfirmBulkDelete = async () => {
    setIsBulkDeleting(true)
    setBulkDeleteError(null)
    try {
      await Promise.all(selectedLeadIds.map((leadId) => deleteLead({ leadId })))
      setSelectedLeadIds([])
      setSelectionMode(false)
      setShowBulkDeleteConfirm(false)
    } catch (err) {
      // Some deletes may have succeeded and some failed — leave selectedLeadIds and
      // selectionMode as-is so the user can see what's left and retry, rather than
      // losing track of which leads did or didn't delete.
      setBulkDeleteError(
        err instanceof Error ? err.message : "Failed to delete selected leads. Please try again."
      )
      setShowBulkDeleteConfirm(false)
    } finally {
      setIsBulkDeleting(false)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto chat-scroll bg-gradient-to-br from-background via-background to-muted/20">
      <div className="max-w-7xl mx-auto w-full px-6 py-8 space-y-8">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Job Leads</h1>
          <p className="text-sm text-muted-foreground">
            Recruiter outreach and job-board digests picked up by the email agent.
          </p>
        </div>

        <AddLeadFromEmail />

        <section>
          <h2 className="text-lg font-semibold mb-4">
            Pending Approval{pendingCount !== undefined && ` (${pendingCount})`}
          </h2>
          <ApprovalQueue />
        </section>

        <section>
          <div className="flex items-center justify-between mb-4 gap-3">
            <h2 className="text-lg font-semibold">
              All Leads{totalCount !== undefined && ` (${totalCount})`}
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              {!selectionMode ? (
                <>
                  <Button variant="outline" onClick={handleEnterSelectionMode}>
                    Multi-select
                  </Button>
                  <ScanNowButton />
                </>
              ) : (
                <>
                  <span className="text-sm text-muted-foreground">
                    {selectedLeadIds.length} selected
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAllVisible}
                    disabled={leadIds.length === 0 || selectedLeadIds.length === leadIds.length}
                  >
                    Select All
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      if (selectedLeadIds.length === 0) return
                      setShowBulkDeleteConfirm(true)
                    }}
                    disabled={selectedLeadIds.length === 0}
                  >
                    Delete Selected
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleExitSelectionMode}>
                    Cancel
                  </Button>
                </>
              )}
            </div>
          </div>
          {selectionMode && showBulkDeleteConfirm && (
            <div className="mb-4 max-w-xl">
              <JkConfirmDelete
                message={`Delete ${selectedLeadIds.length} selected lead${selectedLeadIds.length === 1 ? '' : 's'}?`}
                onConfirm={handleConfirmBulkDelete}
                onCancel={() => setShowBulkDeleteConfirm(false)}
                isLoading={isBulkDeleting}
              />
            </div>
          )}
          {selectionMode && bulkDeleteError && (
            <p className="mb-4 text-sm text-red-600">{bulkDeleteError}</p>
          )}
          <LeadsList
            selectionMode={selectionMode}
            selectedLeadIds={selectedLeadIds}
            onToggleLeadSelection={toggleLeadSelection}
          />
        </section>
      </div>
    </div>
  )
}
