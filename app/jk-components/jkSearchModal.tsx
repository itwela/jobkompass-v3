'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { useAuth } from "@/providers/jkAuthProvider"
import { useJobKompassChatWindow } from "@/providers/jkChatWindowProvider"
import { useJobKompassDocuments } from "@/providers/jkDocumentsProvider"
import { useJobs } from "@/providers/jkJobsProvider"
import { useResources } from "@/providers/jkResourcesProvider"
import { Search, MessageSquare, FileText, Briefcase, Link2, X, Calendar, Filter } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { Id } from "@/convex/_generated/dataModel"

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
            subtitle: `Chat conversation`,
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
            subtitle: doc.documentType === 'resume' ? 'Resume' : 'Cover Letter',
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
            subtitle: resource.url,
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
            subtitle: job.company,
            company: job.company,
            status: job.status,
            statusColorClass: statusOption?.colorClass || 'bg-gray-100 text-gray-800 border-gray-200',
            icon: Briefcase,
          })
        }
      })
    }

    return results
  }, [searchQuery, threads, documents, allResources, allJobs, isAuthenticated, dateFrom, dateTo, statusOptions])

  const handleResultClick = (result: SearchResult) => {
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
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-background/0 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-2xl px-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center gap-3 px-6 py-4 border-b border-border">
                <div className="flex items-center gap-3 flex-1">
                  <Search className="h-5 w-5 text-muted-foreground" />
                  <input
                    ref={inputRef}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Search chats, documents, resources, or jobs..."
                    className="flex-1 border-0 bg-transparent focus-visible:ring-0 focus-visible:outline-none outline-none text-base px-0 placeholder:text-muted-foreground"
                  />
                </div>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                    showFilters || dateFrom || dateTo
                      ? 'bg-accent text-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}
                  title="Filters"
                >
                  <Filter className="h-4 w-4" />
                </button>
                <button
                  onClick={onClose}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Filters */}
              {showFilters && (
                <div className="px-6 py-4 border-b border-border bg-muted/30">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 flex-1">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Date Range</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col gap-1">
                        <label className="text-xs text-muted-foreground">From</label>
                        <input
                          type="date"
                          value={dateFrom}
                          onChange={(e) => setDateFrom(e.target.value)}
                          className="px-2 py-1 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs text-muted-foreground">To</label>
                        <input
                          type="date"
                          value={dateTo}
                          onChange={(e) => setDateTo(e.target.value)}
                          className="px-2 py-1 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                      {(dateFrom || dateTo) && (
                        <button
                          onClick={() => {
                            setDateFrom('')
                            setDateTo('')
                          }}
                          className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Results */}
              <div className="max-h-[60vh] overflow-y-auto">
                {!isAuthenticated ? (
                  <div className="px-6 py-8 text-center text-muted-foreground">
                    Sign in to search
                  </div>
                ) : searchQuery.trim() === '' ? (
                  <div className="px-6 py-8 text-center text-muted-foreground">
                    Start typing to search...
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="px-6 py-8 text-center text-muted-foreground">
                    No results found
                  </div>
                ) : (
                  <div className="py-2">
                    {searchResults.map((result, index) => {
                      const Icon = result.icon
                      return (
                        <motion.button
                          key={`${result.type}-${result.id}`}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.02 }}
                          onClick={() => handleResultClick(result)}
                          className="w-full flex items-center gap-3 px-6 py-3 hover:bg-accent transition-colors text-left"
                        >
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                            <Icon className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{result.title}</div>
                            {result.subtitle && (
                              <div className="text-sm text-muted-foreground truncate">
                                {result.subtitle}
                              </div>
                            )}
                            {result.type === 'job' && result.status && (
                              <div className="mt-1.5">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${result.statusColorClass || 'bg-gray-100 text-gray-800 border-gray-200'}`}>
                                  {result.status}
                                </span>
                              </div>
                            )}
                          </div>
                        </motion.button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

