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

const BULK_DELETE_CHUNK_SIZE = 25

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
    if (selectedLeadIds.length === 0) {
      setShowBulkDeleteConfirm(false)
      return
    }

    const total = selectedLeadIds.length
    setIsBulkDeleting(true)
    setBulkDeleteError(null)
    try {
      let deletedCount = 0
      const failedIds: Id<"jobLeads">[] = []

      for (let i = 0; i < selectedLeadIds.length; i += BULK_DELETE_CHUNK_SIZE) {
        const chunk = selectedLeadIds.slice(i, i + BULK_DELETE_CHUNK_SIZE)
        const results = await Promise.allSettled(
          chunk.map((leadId) => deleteLead({ leadId }))
        )
        results.forEach((result, idx) => {
          const leadId = chunk[idx]
          if (result.status === "fulfilled") {
            deletedCount += 1
          } else {
            console.error("Failed to delete lead", leadId, result.reason)
            failedIds.push(leadId)
          }
        })
      }

      if (failedIds.length > 0) {
        // Only re-select the leads that actually failed — leave the successfully
        // deleted ones off the selection so a retry only re-attempts what's left.
        setSelectedLeadIds(failedIds)
        setBulkDeleteError(
          `Deleted ${deletedCount} of ${total} leads. ${failedIds.length} failed — please try again.`
        )
        setShowBulkDeleteConfirm(false)
      } else {
        setSelectedLeadIds([])
        setSelectionMode(false)
        setShowBulkDeleteConfirm(false)
      }
    } catch (err) {
      // Genuinely unexpected error outside the per-lead mutation handling above.
      console.error("Unexpected error during bulk delete", err)
      setBulkDeleteError("Something went wrong deleting the selected leads. Please try again.")
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
                    disabled={isBulkDeleting || leadIds.length === 0 || selectedLeadIds.length === leadIds.length}
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
                    disabled={isBulkDeleting || selectedLeadIds.length === 0}
                  >
                    Delete Selected
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleExitSelectionMode} disabled={isBulkDeleting}>
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
