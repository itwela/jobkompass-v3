'use client'

import { useState, useEffect, useMemo } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { useAuth } from '@/providers/jkAuthProvider'
import { useJobs } from '@/providers/jkJobsProvider'
import { useJobKompassResume } from '@/providers/jkResumeProvider'
import { useJobKompassChatWindow } from '@/providers/jkChatWindowProvider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { BlurFade } from '@/components/ui/blur-fade'
import { toast } from '@/lib/toast'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles,
  BookOpen,
  Layers,
  Target,
  CheckCircle2,
  Circle,
  HelpCircle,
  AlertTriangle,
  ExternalLink,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Star,
  Plus,
  Loader2,
  Calendar,
  User,
  Phone,
  Video,
  DollarSign,
  FileText,
  Shuffle,
  MessageSquare,
  Award,
  ShieldAlert,
  Trash2,
  LogIn,
} from 'lucide-react'

const FLASHCARD_CATEGORIES: Record<
  string,
  { label: string; bg: string; text: string; border: string }
> = {
  role: {
    label: 'Role & Fit',
    bg: 'bg-blue-500/10',
    text: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-500/20',
  },
  technical: {
    label: 'Technical & Stack',
    bg: 'bg-purple-500/10',
    text: 'text-purple-600 dark:text-purple-400',
    border: 'border-purple-500/20',
  },
  experience: {
    label: 'Proof & Experience',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-500/20',
  },
  objection: {
    label: 'Pivot / Guardrail',
    bg: 'bg-amber-500/10',
    text: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-500/20',
  },
  behavioral: {
    label: 'Behavioral',
    bg: 'bg-cyan-500/10',
    text: 'text-cyan-600 dark:text-cyan-400',
    border: 'border-cyan-500/20',
  },
  logistics: {
    label: 'Rate & Logistics',
    bg: 'bg-rose-500/10',
    text: 'text-rose-600 dark:text-rose-400',
    border: 'border-rose-500/20',
  },
}

type PrepTab = 'brief' | 'flashcards' | 'stories' | 'alignment' | 'questions'

export default function JkCW_InterviewPrepMode() {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const { allJobs } = useJobs()
  const { resumes } = useJobKompassResume()
  const { selectedInterviewPrepJobId, setSelectedInterviewPrepJobId } =
    useJobKompassChatWindow()

  const preps = useQuery(api.interviewPreps.list, isAuthenticated ? {} : 'skip')
  const createPrep = useMutation(api.interviewPreps.create)
  const updatePrep = useMutation(api.interviewPreps.update)
  const removePrep = useMutation(api.interviewPreps.remove)
  const updateCardConfidence = useMutation(
    api.interviewPreps.updateFlashcardConfidence
  )
  const toggleChecklist = useMutation(api.interviewPreps.toggleChecklistItem)
  const toggleQuestion = useMutation(api.interviewPreps.toggleQuestionAsked)

  const [selectedPrepId, setSelectedPrepId] =
    useState<Id<'interviewPreps'> | null>(null)
  const [activeTab, setActiveTab] = useState<PrepTab>('brief')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Flashcard state
  const [cardCategoryFilter, setCardCategoryFilter] = useState<string>('all')
  const [starredOnly, setStarredOnly] = useState(false)
  const [currentCardIndex, setCurrentCardIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [showHint, setShowHint] = useState(false)
  const [shuffledOrder, setShuffledOrder] = useState<string[] | null>(null)

  // New / AI generate modal state
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [selectedJobForNew, setSelectedJobForNew] = useState<string>('')
  const [customCompany, setCustomCompany] = useState('')
  const [customRole, setCustomRole] = useState('')
  const [customDescription, setCustomDescription] = useState('')
  const [customNotes, setCustomNotes] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)

  // Live notes state
  const [localCallNotes, setLocalCallNotes] = useState('')
  const [isSavingNotes, setIsSavingNotes] = useState(false)

  // Select first prep or match selectedInterviewPrepJobId
  useEffect(() => {
    if (!preps || preps.length === 0) return

    if (selectedInterviewPrepJobId) {
      const matched = preps.find((p) => p.jobId === selectedInterviewPrepJobId)
      if (matched) {
        setSelectedPrepId(matched._id)
        setSelectedInterviewPrepJobId(null)
        return
      } else {
        setSelectedJobForNew(selectedInterviewPrepJobId)
        setShowCreateForm(true)
        setSelectedInterviewPrepJobId(null)
      }
    }

    if (!selectedPrepId || !preps.some((p) => p._id === selectedPrepId)) {
      setSelectedPrepId(preps[0]._id)
    }
  }, [preps, selectedPrepId, selectedInterviewPrepJobId, setSelectedInterviewPrepJobId])

  const activePrep = useMemo(() => {
    if (!preps || !selectedPrepId) return null
    return preps.find((p) => p._id === selectedPrepId) ?? preps[0] ?? null
  }, [preps, selectedPrepId])

  useEffect(() => {
    if (activePrep) {
      setLocalCallNotes(activePrep.callNotes ?? '')
      setCurrentCardIndex(0)
      setIsFlipped(false)
      setShowHint(false)
      setShuffledOrder(null)
    }
  }, [activePrep?._id])

  const filteredCards = useMemo(() => {
    if (!activePrep) return []
    let list = activePrep.flashcards || []
    if (cardCategoryFilter !== 'all') {
      list = list.filter((c) => c.category === cardCategoryFilter)
    }
    if (starredOnly) {
      list = list.filter((c) => c.starred)
    }
    if (shuffledOrder) {
      const orderMap = new Map(shuffledOrder.map((id, idx) => [id, idx]))
      list = [...list].sort(
        (a, b) => (orderMap.get(a.id) ?? 999) - (orderMap.get(b.id) ?? 999)
      )
    }
    return list
  }, [activePrep, cardCategoryFilter, starredOnly, shuffledOrder])

  const currentCard = filteredCards[currentCardIndex] ?? filteredCards[0] ?? null

  // Keyboard navigation for flashcards
  useEffect(() => {
    if (activeTab !== 'flashcards') return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return
      }
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        setIsFlipped((prev) => !prev)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        setIsFlipped(false)
        setShowHint(false)
        setCurrentCardIndex((prev) =>
          filteredCards.length > 0 ? (prev + 1) % filteredCards.length : 0
        )
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setIsFlipped(false)
        setShowHint(false)
        setCurrentCardIndex((prev) =>
          filteredCards.length > 0
            ? (prev - 1 + filteredCards.length) % filteredCards.length
            : 0
        )
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeTab, filteredCards.length])

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    toast.success('Copied to clipboard')
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleShuffleCards = () => {
    if (!activePrep) return
    const ids = activePrep.flashcards.map((c) => c.id)
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[ids[i], ids[j]] = [ids[j], ids[i]]
    }
    setShuffledOrder(ids)
    setCurrentCardIndex(0)
    setIsFlipped(false)
  }

  const handleSaveCallNotes = async () => {
    if (!activePrep) return
    setIsSavingNotes(true)
    try {
      await updatePrep({
        id: activePrep._id,
        callNotes: localCallNotes,
      })
      toast.success('Call notes saved')
    } catch (err) {
      console.error(err)
      toast.error('Failed to save notes')
    } finally {
      setIsSavingNotes(false)
    }
  }

  const handleGeneratePrep = async () => {
    const selectedJob = allJobs?.find((j) => j._id === selectedJobForNew)
    const company = selectedJob ? selectedJob.company : customCompany.trim()
    const role = selectedJob ? selectedJob.title : customRole.trim()
    const description = selectedJob
      ? selectedJob.description || ''
      : customDescription.trim()
    const notes = selectedJob ? selectedJob.notes || '' : customNotes.trim()

    if (!company || !role) {
      toast.error('Missing info', 'Select a job or enter company and role.')
      return
    }

    setIsGenerating(true)
    try {
      const baseResume =
        resumes?.find((r: any) => r.isActive) || resumes?.[0] || null

      const res = await fetch('/api/interview-prep/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company,
          role,
          description,
          notes,
          resumeContent: baseResume?.content ?? null,
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.prep) {
        throw new Error(data.error || 'Failed to generate prep')
      }

      const p = data.prep
      const newId = await createPrep({
        jobId: selectedJob ? (selectedJob._id as Id<'jobs'>) : undefined,
        company,
        role,
        compensationTarget: selectedJob?.compensation,
        resumeUsed: selectedJob?.resumeUsed || baseResume?.name,
        status: 'upcoming',
        elevatorPitch: p.elevatorPitch,
        roleSummary: p.roleSummary,
        flashcards: Array.isArray(p.flashcards) ? p.flashcards : [],
        stories: Array.isArray(p.stories) ? p.stories : [],
        requirementMatches: Array.isArray(p.requirementMatches)
          ? p.requirementMatches
          : [],
        questionsToAsk: Array.isArray(p.questionsToAsk) ? p.questionsToAsk : [],
        trapsAndGuardrails: Array.isArray(p.trapsAndGuardrails)
          ? p.trapsAndGuardrails
          : [],
        checklist: Array.isArray(p.checklist) ? p.checklist : [],
      })

      setSelectedPrepId(newId)
      setShowCreateForm(false)
      setSelectedJobForNew('')
      setCustomCompany('')
      setCustomRole('')
      setCustomDescription('')
      setCustomNotes('')
      toast.success('Interview Prep ready!', `Built deck for ${company}.`)
    } catch (err: any) {
      console.error(err)
      toast.error('Generation failed', err?.message || 'Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }

  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 py-12 text-center">
        <Target className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold mb-2">Sign in to use Interview Prep</h2>
        <p className="text-muted-foreground mb-6 max-w-md">
          Drill flashcards, rehearse STAR stories, and keep your live call
          briefing in one command center.
        </p>
        <Button
          onClick={() =>
            window.dispatchEvent(new CustomEvent('jk:openSignIn'))
          }
          className="gap-2"
        >
          <LogIn className="h-4 w-4" />
          Sign In
        </Button>
      </div>
    )
  }

  const masteredCount =
    activePrep?.flashcards.filter((c) => c.confidence === 'mastered').length ??
    0
  const totalCards = activePrep?.flashcards.length ?? 0
  const checklistDoneCount =
    activePrep?.checklist.filter((c) => c.done).length ?? 0
  const totalChecklist = activePrep?.checklist.length ?? 0

  return (
    <div className="flex flex-col h-full overflow-y-auto chat-scroll bg-gradient-to-br from-background via-background to-muted/20">
      <div className="max-w-7xl mx-auto w-full px-6 py-8 space-y-6 pb-24">
        {/* Top Header + Prep Switcher */}
        <BlurFade delay={0.05}>
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-3xl font-bold tracking-tight">
                  Interview Prep
                </h1>
                <span className="text-xs font-semibold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">
                  Command Center
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Interactive flashcards, outcome-first story bank, requirement
                mapping, and live call briefing.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {preps && preps.length > 0 && (
                <div className="flex items-center gap-1.5 bg-card border border-border rounded-xl p-1">
                  {preps.map((p) => {
                    const isSelected = activePrep?._id === p._id
                    return (
                      <button
                        key={p._id}
                        onClick={() => setSelectedPrepId(p._id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          isSelected
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                        }`}
                      >
                        {p.company}
                      </button>
                    )
                  })}
                </div>
              )}

              <Button
                onClick={() => setShowCreateForm((prev) => !prev)}
                size="sm"
                variant={showCreateForm ? 'secondary' : 'default'}
                className="gap-1.5 rounded-xl"
              >
                <Plus className="h-4 w-4" />
                New Prep Deck
              </Button>
            </div>
          </div>
        </BlurFade>

        {/* Create / AI Generate Form */}
        <AnimatePresence>
          {showCreateForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="rounded-xl border border-primary/30 bg-card p-6 space-y-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold text-base">
                      Generate AI Interview Prep Deck
                    </h3>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowCreateForm(false)}
                  >
                    Cancel
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      Pick from My Jobs (or leave blank to enter manually)
                    </label>
                    <select
                      value={selectedJobForNew}
                      onChange={(e) => setSelectedJobForNew(e.target.value)}
                      className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm"
                    >
                      <option value="">-- Custom Role / Manual Entry --</option>
                      {(allJobs ?? []).map((j) => (
                        <option key={j._id} value={j._id}>
                          {j.company} — {j.title} ({j.status})
                        </option>
                      ))}
                    </select>
                  </div>

                  {!selectedJobForNew && (
                    <>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">
                          Company
                        </label>
                        <Input
                          value={customCompany}
                          onChange={(e) => setCustomCompany(e.target.value)}
                          placeholder="e.g. PTC (via Mondo)"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">
                          Role Title
                        </label>
                        <Input
                          value={customRole}
                          onChange={(e) => setCustomRole(e.target.value)}
                          placeholder="e.g. GTM AI Solutions Engineer"
                        />
                      </div>
                      <div className="space-y-1.5 md:col-span-2">
                        <label className="text-xs font-medium text-muted-foreground">
                          Job Description
                        </label>
                        <textarea
                          value={customDescription}
                          onChange={(e) => setCustomDescription(e.target.value)}
                          placeholder="Paste the job description..."
                          className="w-full min-h-[90px] rounded-lg border border-input bg-background px-3 py-2 text-sm"
                        />
                      </div>
                      <div className="space-y-1.5 md:col-span-2">
                        <label className="text-xs font-medium text-muted-foreground">
                          Recruiter / Interview Notes (optional)
                        </label>
                        <Input
                          value={customNotes}
                          onChange={(e) => setCustomNotes(e.target.value)}
                          placeholder="Interviewer name, call format, rate target..."
                        />
                      </div>
                    </>
                  )}
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={handleGeneratePrep}
                    disabled={isGenerating}
                    className="gap-2"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Generating Deck from Your Resume & Job...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Generate Tailored Prep Deck
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!activePrep ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center space-y-4">
            <Target className="h-10 w-10 text-muted-foreground mx-auto" />
            <h3 className="text-lg font-semibold">No Interview Prep Decks Yet</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Click &ldquo;New Prep Deck&rdquo; above to generate flashcards,
              STAR stories, and a live call sheet for any job in your tracker.
            </p>
          </div>
        ) : (
          <>
            {/* Hero Call Briefing Banner */}
            <BlurFade delay={0.1}>
              <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-5">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                        {activePrep.status === 'upcoming'
                          ? '● Upcoming Interview'
                          : activePrep.status}
                      </span>
                      {activePrep.interviewDate && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                          <Calendar className="h-3.5 w-3.5" />
                          {activePrep.interviewDate}
                        </span>
                      )}
                      {activePrep.compensationTarget && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                          <DollarSign className="h-3.5 w-3.5" />
                          {activePrep.compensationTarget}
                        </span>
                      )}
                    </div>
                    <h2 className="text-2xl font-bold tracking-tight">
                      {activePrep.role}{' '}
                      <span className="text-muted-foreground font-normal">
                        @ {activePrep.company}
                      </span>
                    </h2>
                    {activePrep.roleSummary && (
                      <p className="text-sm text-muted-foreground max-w-3xl leading-relaxed">
                        {activePrep.roleSummary}
                      </p>
                    )}
                  </div>

                  {/* Quick Call Links & Readiness */}
                  <div className="flex flex-wrap items-center gap-2.5 flex-shrink-0">
                    {activePrep.meetingLink && (
                      <a
                        href={activePrep.meetingLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold shadow-sm hover:opacity-90 transition"
                      >
                        <Video className="h-4 w-4" />
                        Join Google Meet
                        <ExternalLink className="h-3.5 w-3.5 opacity-80" />
                      </a>
                    )}
                    <div className="flex items-center gap-3 px-3.5 py-2 rounded-xl bg-muted/60 border border-border text-xs">
                      <div>
                        <span className="text-muted-foreground">Cards Mastered: </span>
                        <span className="font-bold text-foreground">
                          {masteredCount}/{totalCards}
                        </span>
                      </div>
                      <span className="text-border">|</span>
                      <div>
                        <span className="text-muted-foreground">Checklist: </span>
                        <span className="font-bold text-foreground">
                          {checklistDoneCount}/{totalChecklist}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Interviewer / Logistics Strip */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-4 border-t border-border/60 text-xs">
                  {activePrep.interviewerName && (
                    <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-muted/30">
                      <User className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="font-semibold text-foreground truncate">
                          {activePrep.interviewerName}
                        </div>
                        <div className="text-muted-foreground truncate">
                          {activePrep.interviewerRole}
                        </div>
                        {activePrep.interviewerEmail && (
                          <div className="text-muted-foreground truncate">
                            {activePrep.interviewerEmail}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {activePrep.phoneBackup && (
                    <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-muted/30">
                      <Phone className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="font-semibold text-foreground">
                          Phone Backup
                        </div>
                        <div className="text-muted-foreground">
                          {activePrep.phoneBackup}
                        </div>
                      </div>
                    </div>
                  )}

                  {activePrep.resumeUsed && (
                    <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-muted/30 sm:col-span-2">
                      <FileText className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="font-semibold text-foreground">
                          Resume Sent to Interviewer
                        </div>
                        <div className="text-muted-foreground truncate">
                          {activePrep.resumeUsed}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </BlurFade>

            {/* Sub-navigation Tabs */}
            <BlurFade delay={0.15}>
              <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
                {[
                  {
                    id: 'brief' as PrepTab,
                    label: 'Call Cheat Sheet & Pitch',
                    icon: BookOpen,
                  },
                  {
                    id: 'flashcards' as PrepTab,
                    label: `Flashcards (${totalCards})`,
                    icon: Layers,
                  },
                  {
                    id: 'stories' as PrepTab,
                    label: `Story Bank (${activePrep.stories.length})`,
                    icon: Award,
                  },
                  {
                    id: 'alignment' as PrepTab,
                    label: `Role Alignment & Guardrails (${
                      activePrep.requirementMatches?.length ?? 0
                    })`,
                    icon: Target,
                  },
                  {
                    id: 'questions' as PrepTab,
                    label: `Questions & Live Notes (${activePrep.questionsToAsk.length})`,
                    icon: HelpCircle,
                  },
                ].map((tab) => {
                  const Icon = tab.icon
                  const isActive = activeTab === tab.id
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                        isActive
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {tab.label}
                    </button>
                  )
                })}
              </div>
            </BlurFade>

            {/* TAB 1: CALL CHEAT SHEET & PITCH */}
            {activeTab === 'brief' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  {/* 90-Second Opener */}
                  {activePrep.elevatorPitch && (
                    <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/5 via-card to-card p-6 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-5 w-5 text-primary" />
                          <h3 className="font-semibold text-base">
                            Your 60-Second Spoken Opener (&ldquo;Tell me about
                            yourself&rdquo;)
                          </h3>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            handleCopy(activePrep.elevatorPitch!, 'pitch')
                          }
                          className="gap-1.5 h-8 text-xs"
                        >
                          {copiedId === 'pitch' ? (
                            <Check className="h-3.5 w-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                          Copy
                        </Button>
                      </div>
                      <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line font-medium bg-background/60 p-4 rounded-lg border border-border/60">
                        &ldquo;{activePrep.elevatorPitch}&rdquo;
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Read this once out loud before 9:00 AM. Land the final
                        sentence and stop talking so Jared can steer.
                      </p>
                    </div>
                  )}

                  {/* Top 3 Stories Quick Glance */}
                  <div className="rounded-xl border border-border bg-card p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-base flex items-center gap-2">
                        <Award className="h-5 w-5 text-primary" />
                        Core Proof Stories to Lead With
                      </h3>
                      <button
                        onClick={() => setActiveTab('stories')}
                        className="text-xs text-primary font-medium hover:underline"
                      >
                        Open full STAR breakdowns →
                      </button>
                    </div>
                    <div className="space-y-3">
                      {activePrep.stories.map((story, idx) => (
                        <div
                          key={story.id}
                          className="p-4 rounded-xl border border-border bg-muted/20 space-y-1.5"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-semibold text-sm">
                              {idx + 1}. {story.title}
                            </span>
                            <span className="text-xs px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                              {story.tag}
                            </span>
                          </div>
                          {story.hook && (
                            <p className="text-xs font-medium text-foreground/90 italic">
                              &ldquo;{story.hook}&rdquo;
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            <strong className="text-foreground">Outcome:</strong>{' '}
                            {story.outcome}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Critical Traps & Guardrails */}
                  {activePrep.trapsAndGuardrails &&
                    activePrep.trapsAndGuardrails.length > 0 && (
                      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-6 space-y-4">
                        <h3 className="font-semibold text-base flex items-center gap-2 text-amber-700 dark:text-amber-300">
                          <ShieldAlert className="h-5 w-5" />
                          Call Guardrails & Pivot Rules (Do Not Trip Here)
                        </h3>
                        <div className="space-y-3">
                          {activePrep.trapsAndGuardrails.map((t) => (
                            <div
                              key={t.id}
                              className="p-3.5 rounded-lg bg-background/80 border border-amber-500/20 space-y-1"
                            >
                              <div className="text-xs font-bold text-amber-700 dark:text-amber-300">
                                ⚠️ {t.trap}
                              </div>
                              <div className="text-xs text-foreground/90 leading-relaxed">
                                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                  Play:{' '}
                                </span>
                                {t.howToHandle}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                </div>

                {/* Right Column: Pre-Call Checklist + Top Questions */}
                <div className="space-y-6">
                  <div className="rounded-xl border border-border bg-card p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-base flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                        Pre-Call Readiness Checklist
                      </h3>
                      <span className="text-xs text-muted-foreground">
                        {checklistDoneCount}/{totalChecklist}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {activePrep.checklist.map((item) => (
                        <button
                          key={item.id}
                          onClick={() =>
                            toggleChecklist({
                              id: activePrep._id,
                              itemId: item.id,
                            })
                          }
                          className={`w-full flex items-start gap-2.5 p-2.5 rounded-lg text-left text-xs transition ${
                            item.done
                              ? 'bg-emerald-500/10 text-muted-foreground line-through'
                              : 'bg-muted/40 hover:bg-muted text-foreground'
                          }`}
                        >
                          {item.done ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                          ) : (
                            <Circle className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                          )}
                          <span className="leading-snug">{item.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Must-Ask Questions Quick Box */}
                  <div className="rounded-xl border border-border bg-card p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-base flex items-center gap-2">
                        <HelpCircle className="h-5 w-5 text-primary" />
                        Questions for Jared
                      </h3>
                      <button
                        onClick={() => setActiveTab('questions')}
                        className="text-xs text-primary font-medium hover:underline"
                      >
                        Take live notes →
                      </button>
                    </div>
                    <div className="space-y-2.5">
                      {activePrep.questionsToAsk.map((q) => (
                        <button
                          key={q.id}
                          onClick={() =>
                            toggleQuestion({
                              id: activePrep._id,
                              questionId: q.id,
                            })
                          }
                          className={`w-full flex items-start gap-2.5 p-2.5 rounded-lg text-left text-xs border transition ${
                            q.asked
                              ? 'bg-emerald-500/10 border-emerald-500/20 text-muted-foreground line-through'
                              : 'bg-background border-border hover:border-primary/40 text-foreground'
                          }`}
                        >
                          {q.asked ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                          ) : (
                            <Circle className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                          )}
                          <div className="space-y-0.5">
                            <div className="font-medium leading-snug">
                              {q.question}
                            </div>
                            {q.whyItMatters && (
                              <div className="text-[11px] text-muted-foreground">
                                {q.whyItMatters}
                              </div>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: INTERACTIVE FLASHCARDS */}
            {activeTab === 'flashcards' && (
              <div className="space-y-6">
                {/* Category Filter Pills & Controls */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      onClick={() => {
                        setCardCategoryFilter('all')
                        setCurrentCardIndex(0)
                        setIsFlipped(false)
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                        cardCategoryFilter === 'all'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-card border border-border text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      All ({activePrep.flashcards.length})
                    </button>
                    {Object.entries(FLASHCARD_CATEGORIES).map(([key, cfg]) => {
                      const count = activePrep.flashcards.filter(
                        (c) => c.category === key
                      ).length
                      if (count === 0) return null
                      return (
                        <button
                          key={key}
                          onClick={() => {
                            setCardCategoryFilter(key)
                            setCurrentCardIndex(0)
                            setIsFlipped(false)
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                            cardCategoryFilter === key
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-card border border-border text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {cfg.label} ({count})
                        </button>
                      )
                    })}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant={starredOnly ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        setStarredOnly((prev) => !prev)
                        setCurrentCardIndex(0)
                        setIsFlipped(false)
                      }}
                      className="gap-1.5 text-xs h-8"
                    >
                      <Star className="h-3.5 w-3.5" />
                      Starred Only
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleShuffleCards}
                      className="gap-1.5 text-xs h-8"
                    >
                      <Shuffle className="h-3.5 w-3.5" />
                      Shuffle
                    </Button>
                    {shuffledOrder && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setShuffledOrder(null)
                          setCurrentCardIndex(0)
                        }}
                        className="gap-1 text-xs h-8"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Reset Order
                      </Button>
                    )}
                  </div>
                </div>

                {/* Active Flashcard Deck */}
                {currentCard ? (
                  <div className="max-w-3xl mx-auto space-y-4">
                    <div
                      onClick={() => setIsFlipped((prev) => !prev)}
                      className="cursor-pointer select-none rounded-2xl border-2 border-border hover:border-primary/50 bg-card p-8 min-h-[300px] flex flex-col justify-between shadow-md transition-all"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                              FLASHCARD_CATEGORIES[currentCard.category]?.bg ??
                              'bg-muted'
                            } ${
                              FLASHCARD_CATEGORIES[currentCard.category]?.text ??
                              'text-foreground'
                            } ${
                              FLASHCARD_CATEGORIES[currentCard.category]
                                ?.border ?? 'border-border'
                            }`}
                          >
                            {FLASHCARD_CATEGORIES[currentCard.category]?.label ??
                              currentCard.category}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Card {currentCardIndex + 1} of {filteredCards.length}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                            {isFlipped ? 'Answer / Talking Points' : 'Prompt'}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              updateCardConfidence({
                                id: activePrep._id,
                                cardId: currentCard.id,
                                starred: !currentCard.starred,
                              })
                            }}
                            className="p-1.5 rounded-lg hover:bg-accent transition"
                            title="Star card"
                          >
                            <Star
                              className={`h-4 w-4 ${
                                currentCard.starred
                                  ? 'fill-amber-400 text-amber-400'
                                  : 'text-muted-foreground'
                              }`}
                            />
                          </button>
                        </div>
                      </div>

                      <div className="my-auto py-6">
                        {!isFlipped ? (
                          <div className="space-y-4 text-center">
                            <h3 className="text-xl md:text-2xl font-bold leading-snug text-foreground">
                              {currentCard.front}
                            </h3>
                            {currentCard.hint && (
                              <div>
                                {showHint ? (
                                  <p className="text-xs text-amber-600 dark:text-amber-400 font-medium bg-amber-500/10 inline-block px-3 py-1 rounded-full">
                                    💡 Cue: {currentCard.hint}
                                  </p>
                                ) : (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setShowHint(true)
                                    }}
                                    className="text-xs text-muted-foreground hover:text-foreground underline"
                                  >
                                    Show memory cue
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="text-xs font-medium text-muted-foreground">
                              Q: {currentCard.front}
                            </div>
                            <div className="text-base md:text-lg leading-relaxed text-foreground whitespace-pre-line font-medium bg-muted/30 p-5 rounded-xl border border-border/60">
                              {currentCard.back}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-border/50 text-xs text-muted-foreground">
                        <span>
                          Click card or press <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border">Space</kbd> to flip · <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border">←</kbd> <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border">→</kbd> to navigate
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleCopy(currentCard.back, currentCard.id)
                          }}
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          {copiedId === currentCard.id ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                          Copy answer
                        </button>
                      </div>
                    </div>

                    {/* Navigation & Confidence Rating */}
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setIsFlipped(false)
                            setShowHint(false)
                            setCurrentCardIndex((prev) =>
                              (prev - 1 + filteredCards.length) %
                              filteredCards.length
                            )
                          }}
                          className="gap-1"
                        >
                          <ChevronLeft className="h-4 w-4" />
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setIsFlipped(false)
                            setShowHint(false)
                            setCurrentCardIndex(
                              (prev) => (prev + 1) % filteredCards.length
                            )
                          }}
                          className="gap-1"
                        >
                          Next
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          Confidence:
                        </span>
                        {[
                          {
                            id: 'new',
                            label: 'Needs Reps',
                            activeClass:
                              'bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/40',
                          },
                          {
                            id: 'learning',
                            label: 'Getting There',
                            activeClass:
                              'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/40',
                          },
                          {
                            id: 'mastered',
                            label: 'Locked In ✓',
                            activeClass:
                              'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/40',
                          },
                        ].map((lvl) => {
                          const isCurrent =
                            (currentCard.confidence || 'new') === lvl.id
                          return (
                            <button
                              key={lvl.id}
                              onClick={() =>
                                updateCardConfidence({
                                  id: activePrep._id,
                                  cardId: currentCard.id,
                                  confidence: lvl.id,
                                })
                              }
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                                isCurrent
                                  ? lvl.activeClass
                                  : 'bg-card border-border text-muted-foreground hover:text-foreground'
                              }`}
                            >
                              {lvl.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
                    No flashcards match the current filter.
                  </div>
                )}

                {/* All Cards Grid Below for Quick Scanning */}
                <div className="pt-6 border-t border-border space-y-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    All Cards in View ({filteredCards.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredCards.map((card, idx) => {
                      const cat = FLASHCARD_CATEGORIES[card.category]
                      return (
                        <div
                          key={card.id}
                          onClick={() => {
                            setCurrentCardIndex(idx)
                            setIsFlipped(true)
                            window.scrollTo({ top: 0, behavior: 'smooth' })
                          }}
                          className={`p-4 rounded-xl border bg-card hover:border-primary/40 cursor-pointer transition space-y-2 ${
                            currentCard?.id === card.id
                              ? 'border-primary ring-1 ring-primary/30'
                              : 'border-border'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                                cat?.bg ?? 'bg-muted'
                              } ${cat?.text ?? 'text-foreground'} ${
                                cat?.border ?? 'border-border'
                              }`}
                            >
                              {cat?.label ?? card.category}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {card.confidence === 'mastered' && (
                                <span className="text-[11px] font-medium text-emerald-500">
                                  ✓ Locked In
                                </span>
                              )}
                              {card.starred && (
                                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                              )}
                            </div>
                          </div>
                          <div className="font-semibold text-sm text-foreground">
                            {card.front}
                          </div>
                          <div className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                            {card.back}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: STORY BANK (STAR + OUTCOME FIRST) */}
            {activeTab === 'stories' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {activePrep.stories.map((story, idx) => (
                  <div
                    key={story.id}
                    className="rounded-xl border border-border bg-card p-6 space-y-4 shadow-sm flex flex-col justify-between"
                  >
                    <div className="space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary">
                            Story #{idx + 1} · {story.tag}
                          </span>
                          <h3 className="text-lg font-bold mt-2">
                            {story.title}
                          </h3>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            handleCopy(
                              `${story.title}\nHook: ${story.hook ?? ''}\nSituation: ${story.situation}\nAction: ${story.action}\nOutcome: ${story.outcome}\nTakeaway: ${story.takeaway}`,
                              story.id
                            )
                          }
                          className="h-8 gap-1 text-xs"
                        >
                          {copiedId === story.id ? (
                            <Check className="h-3.5 w-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                          Copy
                        </Button>
                      </div>

                      {story.hook && (
                        <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-xs font-medium text-foreground">
                          <span className="text-primary font-bold uppercase tracking-wider block mb-1">
                            Spoken Lead-In (Outcome-First Hook)
                          </span>
                          &ldquo;{story.hook}&rdquo;
                        </div>
                      )}

                      <div className="space-y-3 text-xs leading-relaxed">
                        <div>
                          <span className="font-bold text-muted-foreground uppercase tracking-wider block mb-0.5">
                            Situation / Bottleneck
                          </span>
                          <p className="text-foreground/90">{story.situation}</p>
                        </div>
                        <div>
                          <span className="font-bold text-muted-foreground uppercase tracking-wider block mb-0.5">
                            What You Built (Action)
                          </span>
                          <p className="text-foreground/90">{story.action}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                          <span className="font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block mb-0.5">
                            Measurable Outcome
                          </span>
                          <p className="text-foreground font-medium">
                            {story.outcome}
                          </p>
                        </div>
                        <div>
                          <span className="font-bold text-muted-foreground uppercase tracking-wider block mb-0.5">
                            Why It Matters for {activePrep.company}
                          </span>
                          <p className="text-foreground/90">{story.takeaway}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* TAB 4: ROLE ALIGNMENT & GUARDRAILS */}
            {activeTab === 'alignment' && (
              <div className="space-y-6">
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                  <div className="p-5 border-b border-border flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-base">
                        Requirement-by-Requirement Proof Matrix
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Every requirement from the job description mapped to
                        your real shipped work or an honest pivot.
                      </p>
                    </div>
                  </div>
                  <div className="divide-y divide-border">
                    {(activePrep.requirementMatches ?? []).map((rm) => (
                      <div
                        key={rm.id}
                        className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-muted/20 transition"
                      >
                        <div className="space-y-1 md:w-2/5">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                                rm.priority === 'must-have'
                                  ? 'bg-primary/15 text-primary'
                                  : 'bg-muted text-muted-foreground'
                              }`}
                            >
                              {rm.priority}
                            </span>
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                rm.strength === 'strong'
                                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                  : rm.strength === 'pivot'
                                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                                  : 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                              }`}
                            >
                              {rm.strength === 'strong'
                                ? '✓ Direct Proof'
                                : rm.strength === 'pivot'
                                ? '⚡ Honest Pivot'
                                : 'Solid Fit'}
                            </span>
                          </div>
                          <div className="text-sm font-semibold text-foreground">
                            {rm.requirement}
                          </div>
                        </div>
                        <div className="md:w-3/5 text-xs text-foreground/90 leading-relaxed bg-muted/30 p-3 rounded-lg border border-border/50">
                          {rm.yourProof}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: QUESTIONS TO ASK & LIVE CALL NOTES */}
            {activeTab === 'questions' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="rounded-xl border border-border bg-card p-6 space-y-4">
                  <div>
                    <h3 className="font-semibold text-base">
                      Questions to Ask on the Call
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Click any question to check it off as you ask it during
                      the call.
                    </p>
                  </div>
                  <div className="space-y-3">
                    {activePrep.questionsToAsk.map((q) => (
                      <div
                        key={q.id}
                        onClick={() =>
                          toggleQuestion({
                            id: activePrep._id,
                            questionId: q.id,
                          })
                        }
                        className={`p-4 rounded-xl border cursor-pointer transition space-y-1.5 ${
                          q.asked
                            ? 'bg-emerald-500/10 border-emerald-500/30 opacity-75'
                            : 'bg-background border-border hover:border-primary/40'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2.5">
                            {q.asked ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                            ) : (
                              <Circle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                            )}
                            <span
                              className={`text-sm font-semibold ${
                                q.asked ? 'line-through text-muted-foreground' : ''
                              }`}
                            >
                              {q.question}
                            </span>
                          </div>
                          {q.category && (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-muted text-muted-foreground flex-shrink-0">
                              {q.category}
                            </span>
                          )}
                        </div>
                        {q.whyItMatters && (
                          <p className="text-xs text-muted-foreground pl-6">
                            {q.whyItMatters}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Live Call Scratchpad */}
                <div className="rounded-xl border border-border bg-card p-6 space-y-4 flex flex-col">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-base flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-primary" />
                        Live Call Scratchpad
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Jot down rate confirmation, next steps, team structure,
                        and what the first GTM workflow is.
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={handleSaveCallNotes}
                      disabled={isSavingNotes}
                      className="h-8 text-xs"
                    >
                      {isSavingNotes ? 'Saving...' : 'Save Notes'}
                    </Button>
                  </div>
                  <textarea
                    value={localCallNotes}
                    onChange={(e) => setLocalCallNotes(e.target.value)}
                    placeholder="Type live notes during your call with Jared here... (e.g. confirmed $55/hr W2, 40 hrs/wk, next round with PTC hiring manager...)"
                    className="flex-1 min-h-[280px] w-full rounded-xl border border-input bg-background p-4 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
