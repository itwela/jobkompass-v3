'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { useAuth } from "@/providers/jkAuthProvider"
import { useSubscription } from "@/providers/jkSubscriptionProvider"
import { useJobKompassChatWindow } from "@/providers/jkChatWindowProvider"
import { useJobKompassDocuments } from "@/providers/jkDocumentsProvider"
import { useJobs } from "@/providers/jkJobsProvider"
import { useResources } from "@/providers/jkResourcesProvider"
import { Search, MessageSquare, FileText, Briefcase, Link2, X, CornerDownLeft } from "lucide-react"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence } from "framer-motion"
import { Id } from "@/convex/_generated/dataModel"
import Link from "next/link"
import { trackUpgradeClicked } from "@/lib/analytics/client"

interface SearchResult {
  id: string
  type: 'chat' | 'document' | 'resource' | 'job'
  title: string
  subtitle?: string
  company?: string // For jobs
  status?: string // For jobs
  statusColorClass?: string // For jobs
  icon: typeof MessageSquare
}

interface JkSearchModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function JkSearchModal({ isOpen, onClose }: JkSearchModalProps) {
  const { isAuthenticated } = useAuth()
  const { isFree } = useSubscription()
  const markResumeAsSeen = useMutation(api.documents.markResumeAsSeen)
  const markCoverLetterAsSeen = useMutation(api.documents.markCoverLetterAsSeen)
  const markJobAsSeen = useMutation(api.jobs.markJobAsSeen)
  const { currentThreadId, setCurrentThreadId, setCurrentMode, allModes } = useJobKompassChatWindow()
  const { documents, selectDocument } = useJobKompassDocuments()
  const { allJobs, setSelectedJobId, statusOptions } = useJobs()
  const { allResources, setEditingId } = useResources()
  
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const threads = useQuery(api.threads.list, isAuthenticated ? {} : "skip")

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  // Reset search when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('')
      setDateFrom('')
      setDateTo('')
      setShowFilters(false)
    }
  }, [isOpen])

  // Helper function to check if a date is within range
  const isDateInRange = (timestamp: number): boolean => {
    if (!dateFrom && !dateTo) return true
    
    const itemDate = new Date(timestamp)
    const fromDate = dateFrom ? new Date(dateFrom) : null
    const toDate = dateTo ? new Date(dateTo + 'T23:59:59') : null // Include full day
    
    if (fromDate && itemDate < fromDate) return false
    if (toDate && itemDate > toDate) return false
    return true
  }

  // Search results
  const searchResults = useMemo<SearchResult[]>(() => {
    if (!searchQuery.trim() || !isAuthenticated) return []

    const query = searchQuery.toLowerCase().trim()
    const results: SearchResult[] = []

    // Search chats (threads)
    if (threads && Array.isArray(threads)) {
      threads.forEach((thread) => {
        if (thread.title.toLowerCase().includes(query) && isDateInRange(thread.updatedAt)) {
          results.push({
            id: thread._id,
            type: 'chat',
            title: thread.title,
            subtitle: `Chat · ${new Date(thread.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
            icon: MessageSquare,
          })
        }
      })
    }

    // Search documents (resumes and cover letters)
    if (documents && Array.isArray(documents)) {
      documents.forEach((doc) => {
        const name = doc.name || 'Untitled Document'
        const docDate = doc.updatedAt ?? doc.createdAt ?? Date.now()
        if (name.toLowerCase().includes(query) && isDateInRange(docDate)) {
          results.push({
            id: doc._id,
            type: 'document',
            title: name,
            subtitle: doc.documentType === 'resume'
              ? `Resume · ${(doc as any).template ? `${String((doc as any).template).replace(/^./, (c: string) => c.toUpperCase())} template` : `written ${new Date(docDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}`
              : 'Cover letter',
            icon: FileText,
          })
        }
      })
    }

    // Search resources
    if (allResources && Array.isArray(allResources)) {
      allResources.forEach((resource) => {
        const searchableText = [
          resource.title,
          resource.url,
          resource.description,
          resource.notes,
          resource.category,
          ...(resource.tags || []),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()

        if (searchableText.includes(query) && isDateInRange(resource.updatedAt)) {
          results.push({
            id: resource._id,
            type: 'resource',
            title: resource.title,
            subtitle: resource.url || resource.description || 'Note',
            icon: Link2,
          })
        }
      })
    }

    // Search jobs
    if (allJobs && Array.isArray(allJobs)) {
      allJobs.forEach((job) => {
        const searchableText = [
          job.title,
          job.company,
          job.description,
          job.notes,
          ...(job.skills || []),
          ...(job.keywords || []),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()

        const jobDate = job.updatedAt ?? job.createdAt ?? Date.now()
        if (searchableText.includes(query) && isDateInRange(jobDate)) {
          const statusOption = statusOptions.find(opt => opt.value === job.status)
          results.push({
            id: job._id,
            type: 'job',
            title: job.title,
            subtitle: [job.company, job.status].filter(Boolean).join(' · '),
            company: job.company,
            status: job.status,
            statusColorClass: statusOption?.colorClass || 'bg-muted text-foreground border-border',
            icon: Briefcase,
          })
        }
      })
    }

    return results
  }, [searchQuery, threads, documents, allResources, allJobs, isAuthenticated, dateFrom, dateTo, statusOptions])

  const handleResultClick = async (result: SearchResult) => {
    onClose()

    // Navigate based on result type
    if (result.type === 'chat') {
      setCurrentThreadId(result.id as Id<"threads">)
      const chatMode = allModes.find(mode => mode.id === '/chat')
      if (chatMode) {
        setCurrentMode(chatMode)
      }
    } else if (result.type === 'document') {
      const doc = documents?.find(d => d._id === result.id)
      if (doc) {
        const docType = doc.documentType === 'resume' ? 'resume' : 'cover-letter'
        selectDocument(result.id, docType)
        const documentsMode = allModes.find(mode => mode.id === '/documents')
        if (documentsMode) {
          setCurrentMode(documentsMode)
          // Dispatch event to open edit panel after a short delay to ensure component is mounted
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('jk:openDocumentEdit', {
              detail: { documentId: result.id, documentType: docType }
            }))
          }, 100)
        }
        // Mark document as seen when clicked from search
        try {
          if (docType === 'resume') {
            await markResumeAsSeen({ resumeId: result.id as Id<"resumes"> })
          } else {
            await markCoverLetterAsSeen({ coverLetterId: result.id as Id<"coverLetters"> })
          }
        } catch (error) {
          // Silently fail
        }
      }
    } else if (result.type === 'resource') {
      setEditingId(result.id as Id<"resources">)
      const resourcesMode = allModes.find(mode => mode.id === '/resources')
      if (resourcesMode) {
        setCurrentMode(resourcesMode)
      }
    } else if (result.type === 'job') {
      setSelectedJobId(result.id as Id<"jobs">)
      const jobsMode = allModes.find(mode => mode.id === '/my-jobs')
      if (jobsMode) {
        setCurrentMode(jobsMode)
      }
      // Mark job as seen when clicked from search
      try {
        await markJobAsSeen({ jobId: result.id as Id<"jobs"> })
      } catch (error) {
        // Silently fail
      }
    }
  }

  // Grouped as the frame shows them; one flat order for arrow keys.
  const groups = useMemo(() => {
    const order: { type: SearchResult['type']; label: string; tag: string; tick: string }[] = [
      { type: 'job', label: 'Jobs', tag: 'JOB', tick: 'var(--bar-4)' },
      { type: 'document', label: 'Documents', tag: 'PDF', tick: 'var(--bar-2)' },
      { type: 'resource', label: 'Links', tag: 'LINK', tick: 'var(--bar-3)' },
      { type: 'chat', label: 'Conversations', tag: 'CHAT', tick: 'var(--bar-1)' },
    ]
    return order.map((g) => ({ ...g, items: searchResults.filter((r) => r.type === g.type).slice(0, 6) })).filter((g) => g.items.length)
  }, [searchResults])
  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups])
  const [active, setActive] = useState(0)
  useEffect(() => { setActive(0) }, [searchQuery])
  useEffect(() => {
    document.getElementById(`jk-search-opt-${active}`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (flat.length ? (a + 1) % flat.length : 0)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (flat.length ? (a - 1 + flat.length) % flat.length : 0)) }
    else if (e.key === 'Enter' && flat[active]) { e.preventDefault(); void handleResultClick(flat[active]) }
  }

  let n = -1
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-background/70"
            onClick={onClose}
          />
          <div className="pointer-events-none fixed inset-0 z-50 flex items-start justify-center sm:px-6 sm:pt-[120px]">
            <motion.div
              role="dialog" aria-modal="true" aria-label="Search"
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="pointer-events-auto flex h-dvh w-full flex-col overflow-hidden bg-card sm:h-auto sm:max-h-[560px] sm:min-h-[400px] sm:max-w-[700px] sm:rounded-[28px] sm:border sm:border-input"
            >
              <div className="flex h-[68px] shrink-0 items-center gap-4 border-b border-border px-6">
                <Search className="size-[18px] shrink-0 text-plan" strokeWidth={2} />
                <input
                  ref={inputRef}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search jobs, documents, links, chats"
                  role="combobox" aria-expanded={flat.length > 0} aria-controls="jk-search-list"
                  aria-activedescendant={flat.length ? `jk-search-opt-${active}` : undefined}
                  className="min-w-0 flex-1 bg-transparent text-[19px] text-foreground caret-plan outline-none placeholder:text-subtle-foreground max-sm:text-[17px]"
                />
                <button type="button" onClick={onClose} className="rounded-md bg-accent px-2 py-1 font-mono text-[9.5px] font-medium tracking-[0.8px] text-muted-foreground hover:text-foreground">
                  <span className="max-sm:hidden">ESC</span><X className="size-4 sm:hidden" />
                </button>
              </div>

              <div id="jk-search-list" role="listbox" className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 pt-3">
                {isFree ? (
                  <div className="px-3 py-10 text-center">
                    <p className="text-[15px] text-foreground">Search is part of Plus</p>
                    <Link href="/pricing" onClick={() => { trackUpgradeClicked({ surface: 'search', authenticated: true }); onClose() }} className="mt-2 inline-block text-[13.5px] text-muted-foreground underline underline-offset-4">See plans</Link>
                  </div>
                ) : !searchQuery.trim() ? (
                  <p className="px-3 py-10 text-center text-[13.5px] text-subtle-foreground">Type to search. Use ↑ ↓ to move, Enter to open.</p>
                ) : flat.length === 0 ? (
                  <p className="px-3 py-10 text-center text-[13.5px] text-subtle-foreground">Nothing matches &ldquo;{searchQuery}&rdquo;</p>
                ) : groups.map((g) => (
                  <div key={g.type} className="mb-1">
                    <p className="px-3.5 pb-2 pt-3 font-mono text-[9.5px] font-medium tracking-[2px] text-subtle-foreground">{g.label.toUpperCase()}</p>
                    {g.items.map((r) => {
                      n += 1
                      const i = n
                      const on = i === active
                      return (
                        <button
                          key={`${r.type}-${r.id}`} id={`jk-search-opt-${i}`} type="button" role="option" aria-selected={on}
                          onMouseMove={() => setActive(i)} onClick={() => handleResultClick(r)}
                          className={cn("flex h-[52px] w-full items-center gap-3.5 rounded-[14px] px-3.5 text-left transition-colors", on && "bg-accent")}
                        >
                          <span aria-hidden className="h-3.5 w-[3px] shrink-0 rounded-full" style={{ background: g.tick }} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[15px] leading-[18px] text-foreground">{r.title || 'Untitled'}</span>
                            {r.subtitle && <span className="mt-0.5 block truncate text-[12px] leading-4 text-muted-foreground">{r.subtitle}</span>}
                          </span>
                          <span className="font-mono text-[9.5px] tracking-[1.2px] text-subtle-foreground">{g.tag}</span>
                          <CornerDownLeft aria-hidden className={cn("size-3.5 shrink-0 text-plan", !on && "invisible")} />
                        </button>
                      )
                    })}
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
