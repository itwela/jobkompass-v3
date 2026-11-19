'use client'

/**
 * Interview Prep (D10 desktop, M08 phone).
 *
 * Desktop: header (job · company · call with X, day time) + tabs, then the tab body on the
 * left and the call panel on the right (60 second pitch, the big four, guardrails).
 * Phone: tabs Pitch / Flashcards / Stories / Questions; the call panel lives in Pitch.
 *
 * Data: convex/interviewPreps.ts. New optional fields (not deployed until the lead runs
 * convex deploy): `callAt` (ms, the call start) and `proofPoints` (the big four). Until a
 * deck has proofPoints, the big four falls back to its own stories (title + outcome).
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import type { Doc, Id } from '@/convex/_generated/dataModel'
import { useAuth } from '@/providers/jkAuthProvider'
import { useJobs } from '@/providers/jkJobsProvider'
import { useJobKompassResume } from '@/providers/jkResumeProvider'
import { useJobKompassChatWindow } from '@/providers/jkChatWindowProvider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { Check, ChevronLeft, ChevronRight, Copy, Loader2, LogIn, Star, X } from 'lucide-react'
import JkAppPageHeader from '../jk-app/jkAppPageHeader'
import JkSectionLabel from '../jk-app/jkSectionLabel'
import JkArt from '../jkArt'
import { JkField, jkFieldCls } from '../jkField'

type Prep = Doc<'interviewPreps'>
type Card = Prep['flashcards'][number]
type PrepTab = 'brief' | 'flashcards' | 'stories' | 'alignment' | 'questions'

const TABS: { id: PrepTab; label: string; short?: string; phone: boolean }[] = [
  { id: 'brief', label: 'Cheat sheet & pitch', short: 'Pitch', phone: true },
  { id: 'flashcards', label: 'Flashcards', phone: true },
  { id: 'stories', label: 'Story bank', short: 'Stories', phone: true },
  { id: 'alignment', label: 'Role alignment', phone: false },
  { id: 'questions', label: 'Questions & notes', short: 'Questions', phone: true },
]

/** Chip label (filter row) and card label ("CARD 7 OF 24 · PROOF & EXPERIENCE"). */
const CATEGORY: Record<string, { chip: string; card: string; short: string }> = {
  role: { chip: 'Role & fit', card: 'Role & fit', short: 'Role' },
  experience: { chip: 'Proof', card: 'Proof & experience', short: 'Proof' },
  technical: { chip: 'Technical', card: 'Technical', short: 'Technical' },
  behavioral: { chip: 'Behavioral', card: 'Behavioral', short: 'Behavioral' },
  logistics: { chip: 'Rate', card: 'Rate & logistics', short: 'Rate' },
  objection: { chip: 'Pivots', card: 'Pivot', short: 'Pivot' },
}
const CHIP_ORDER = ['role', 'experience', 'technical', 'behavioral', 'logistics', 'objection']

/** Confidence values stored on each card. */
const RATINGS = [
  { value: 'needs-reps', label: 'Needs reps', dot: 'bg-destructive' },
  { value: 'learning', label: 'Getting there', dot: 'bg-warn' },
  { value: 'mastered', label: 'Locked in', dot: 'bg-ok' },
] as const

const BIG_FOUR_TICKS = ['var(--bar-1)', 'var(--bar-2)', 'var(--bar-3)', 'var(--bar-4)']
const enter = (i: number) => ({ '--i': i }) as React.CSSProperties

/** "Fri 9:00 AM EST" from callAt, else the deck's free-text date. */
export function callWhen(prep: Pick<Prep, 'interviewDate'> & { callAt?: number }): string | null {
  if (prep.callAt) {
    return new Date(prep.callAt).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).replace(',', '')
  }
  return prep.interviewDate?.trim() || null
}

export default function JkCW_InterviewPrepMode() {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const { allJobs } = useJobs()
  const { resumes } = useJobKompassResume()
  const { selectedInterviewPrepJobId, setSelectedInterviewPrepJobId } = useJobKompassChatWindow()

  const preps = useQuery(api.interviewPreps.list, isAuthenticated ? {} : 'skip')
  const createPrep = useMutation(api.interviewPreps.create)
  const updatePrep = useMutation(api.interviewPreps.update)
  const rateCard = useMutation(api.interviewPreps.updateFlashcardConfidence)
  const toggleChecklist = useMutation(api.interviewPreps.toggleChecklistItem)
  const toggleQuestion = useMutation(api.interviewPreps.toggleQuestionAsked)

  const [selectedPrepId, setSelectedPrepId] = useState<Id<'interviewPreps'> | null>(null)
  const [tab, setTab] = useState<PrepTab>('flashcards')
  const [showCreate, setShowCreate] = useState(false)
  const [presetJob, setPresetJob] = useState('')

  useEffect(() => {
    if (!preps) return
    if (selectedInterviewPrepJobId) {
      const match = preps.find((p) => p.jobId === selectedInterviewPrepJobId)
      if (match) setSelectedPrepId(match._id)
      else { setPresetJob(selectedInterviewPrepJobId); setShowCreate(true) }
      setSelectedInterviewPrepJobId(null)
      return
    }
    if (preps.length === 0) return
    if (!selectedPrepId || !preps.some((p) => p._id === selectedPrepId)) setSelectedPrepId(preps[0]._id)
  }, [preps, selectedPrepId, selectedInterviewPrepJobId, setSelectedInterviewPrepJobId])

  const prep = useMemo(() => preps?.find((p) => p._id === selectedPrepId) ?? preps?.[0] ?? null, [preps, selectedPrepId])

  if (authLoading || (isAuthenticated && preps === undefined)) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
  }
  if (!isAuthenticated) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
        <h2 className="text-[22px] font-medium text-foreground">Sign in to prep for your next call</h2>
        <Button className="mt-5 gap-2" onClick={() => window.dispatchEvent(new CustomEvent('jk:openSignIn'))}>
          <LogIn className="h-4 w-4" /> Sign in
        </Button>
      </div>
    )
  }

  const p = prep as (Prep & { callAt?: number; proofPoints?: { id: string; title: string; detail: string }[] }) | null
  const when = p ? callWhen(p) : null
  const sub = p
    ? [p.role, p.company, p.interviewerName ? `call with ${p.interviewerName}${when ? `, ${when}` : ''}` : when].filter(Boolean).join(' · ')
    : 'Flashcards, stories and a call sheet for any job you track'

  const newDeckButton = (
    <Button variant="outline" onClick={() => setShowCreate((s) => !s)} className="h-10 rounded-full border-input bg-popover px-6 text-[13.5px] font-medium">
      {showCreate ? 'Close' : 'New deck'}
    </Button>
  )

  return (
    <div className="chat-scroll flex h-full flex-col overflow-y-auto pb-[calc(var(--jk-tabbar-h)+24px)] lg:pb-0">
      <JkAppPageHeader
        title="Interview Prep"
        sub={sub}
        art={p ? null : 'signal'}
        artHeight={p ? undefined : 260}
        artPosition="right 40%"
        divider={false}
        className="hidden lg:block"
        actions={
          <div className="hidden items-center gap-2.5 lg:flex">
            {preps && preps.length > 1 && (
              <select
                aria-label="Deck"
                value={p?._id ?? ''}
                onChange={(e) => setSelectedPrepId(e.target.value as Id<'interviewPreps'>)}
                className="h-10 max-w-[220px] truncate rounded-full border border-input bg-card px-4 text-[13.5px] text-foreground"
              >
                {preps.map((d) => <option key={d._id} value={d._id}>{d.company} · {d.role}</option>)}
              </select>
            )}
            {(p || showCreate) && newDeckButton}
          </div>
        }
      />

      {showCreate && (
        <CreateDeck
          jobs={allJobs ?? []}
          presetJob={presetJob}
          resume={(resumes as any[] | undefined)?.find((r) => r.isActive) ?? (resumes as any[] | undefined)?.[0] ?? null}
          onCancel={() => setShowCreate(false)}
          onCreate={async (args) => {
            const id = await createDeck(createPrep, args)
            setSelectedPrepId(id)
            setShowCreate(false)
            setPresetJob('')
            setTab('flashcards')
          }}
        />
      )}

      {!p ? (
        !showCreate && (
          <PrepEmpty
            jobs={allJobs ?? []}
            onNew={() => setShowCreate(true)}
            onPick={(id) => { setPresetJob(id); setShowCreate(true) }}
          />
        )
      ) : (
        <>
          {/* Tabs */}
          <nav aria-label="Prep sections" className="sticky top-0 z-10 shrink-0 border-b border-border bg-background">
            <div className="flex gap-7 overflow-x-auto px-5 [scrollbar-width:none] lg:gap-[31px] lg:px-8">
              {TABS.map((t) => {
                const on = tab === t.id
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    aria-current={on ? 'page' : undefined}
                    className={cn(
                      'relative whitespace-nowrap pb-[11px] pt-[14px] text-[14.5px] transition-colors lg:pb-[9px] lg:pt-0 lg:text-[14px]',
                      on ? 'font-semibold text-foreground lg:font-medium' : 'text-subtle-foreground hover:text-foreground',
                      !t.phone && 'hidden lg:block',
                    )}
                  >
                    <span className="lg:hidden">{t.short ?? t.label}</span>
                    <span className="hidden lg:inline">{t.label}</span>
                    {on && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-plan" />}
                  </button>
                )
              })}
            </div>
          </nav>

          <div key={`${p._id}-${tab}`} className="grid min-h-0 flex-1 xl:grid-cols-[minmax(0,748fr)_minmax(0,428fr)]">
            <div data-enter className="jk-stagger min-w-0 px-5 pb-10 pt-5 lg:px-8 lg:pt-[22px] xl:pr-4">
              {tab === 'flashcards' && (
                <Flashcards prep={p} onRate={(cardId, confidence) => rateCard({ id: p._id, cardId, confidence })} onStar={(cardId, starred) => rateCard({ id: p._id, cardId, starred })} />
              )}
              {tab === 'brief' && (
                <Brief prep={p} when={when} sub={sub} newDeck={newDeckButton} onCallAt={async (callAt) => {
                  try { await updatePrep({ id: p._id, callAt } as any); toast.success('Call time saved') }
                  catch { toast.error('Could not save the call time', 'This needs the latest backend. Try again after the next release.') }
                }} />
              )}
              {tab === 'stories' && <Stories prep={p} />}
              {tab === 'alignment' && <Alignment prep={p} />}
              {tab === 'questions' && (
                <Questions
                  prep={p}
                  onToggle={(questionId) => toggleQuestion({ id: p._id, questionId })}
                  onToggleChecklist={(itemId) => toggleChecklist({ id: p._id, itemId })}
                  onSaveNotes={async (callNotes) => { await updatePrep({ id: p._id, callNotes }); toast.success('Notes saved') }}
                />
              )}
            </div>
            <aside data-enter className="jk-stagger hidden border-l border-border px-4 pb-10 pt-[30px] xl:block xl:pr-8">
              <CallPanel prep={p} />
            </aside>
          </div>
        </>
      )}
    </div>
  )
}

/* ─── Flashcards ──────────────────────────────────────────────────────────── */

function Flashcards({ prep, onRate, onStar }: { prep: Prep; onRate: (id: string, c: string) => void; onStar: (id: string, s: boolean) => void }) {
  const cards = prep.flashcards
  const [filter, setFilter] = useState<string>('all')
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)

  const list = useMemo(() => {
    if (filter === 'all') return cards
    if (filter === 'starred') return cards.filter((c) => c.starred)
    return cards.filter((c) => c.category === filter)
  }, [cards, filter])
  const card: Card | undefined = list[Math.min(index, list.length - 1)]
  const pos = card ? cards.findIndex((c) => c.id === card.id) + 1 : 0
  const mastered = cards.filter((c) => c.confidence === 'mastered').length
  const starred = cards.filter((c) => c.starred).length

  const go = useCallback((d: number) => {
    setFlipped(false)
    setIndex((i) => (list.length ? (i + d + list.length) % list.length : 0))
  }, [list.length])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = document.activeElement?.tagName
      if (t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT') return
      if (e.key === ' ') { e.preventDefault(); setFlipped((f) => !f) }
      else if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go])

  const chips = [
    { id: 'all', label: `All ${cards.length}` },
    ...CHIP_ORDER.filter((k) => cards.some((c) => c.category === k)).map((k) => ({ id: k, label: CATEGORY[k].chip })),
    { id: 'starred', label: `Starred ${starred}` },
  ]

  return (
    <>
      <div className="hidden flex-wrap gap-1.5 lg:flex">
        {chips.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => { setFilter(c.id); setIndex(0); setFlipped(false) }}
            aria-pressed={filter === c.id}
            className={cn(
              'h-7 rounded-full border px-[15px] text-[12.5px] font-medium transition-colors',
              filter === c.id ? 'border-plan bg-accent text-foreground' : 'border-input text-muted-foreground hover:text-foreground',
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      {!card ? (
        <p className="mt-5 rounded-[28px] border border-input bg-card p-8 text-[14px] text-muted-foreground">
          {filter === 'starred' ? 'No starred cards yet. Star the ones you want to drill.' : 'No cards here.'}
        </p>
      ) : (
        <div
          role="button"
          tabIndex={0}
          aria-label={flipped ? 'Hide the answer' : 'Show the answer'}
          onClick={(e) => { if (!(e.target as HTMLElement).closest('[data-star]')) setFlipped((f) => !f) }}
          onKeyDown={(e) => { if (e.key === 'Enter') setFlipped((f) => !f) }}
          className="relative isolate mt-0 cursor-pointer overflow-hidden rounded-[28px] border border-input bg-card px-6 pb-12 pt-[29px] lg:mt-5 lg:min-h-[400px] lg:px-8 lg:pb-8 lg:pt-[33px]"
        >
          <div aria-hidden className="pointer-events-none absolute right-3 top-2 -z-10 hidden size-[236px] md:block">
            <JkArt name="step4" variant="spot" fade="all" />
          </div>
          <div className="flex items-start justify-between gap-4">
            <p className="font-mono text-[10px] font-medium uppercase tracking-[1.2px] text-plan-text">
              Card {pos} of {cards.length} · <span className="lg:hidden">{CATEGORY[card.category]?.short ?? card.category}</span><span className="hidden lg:inline">{CATEGORY[card.category]?.card ?? card.category}</span>
            </p>
            <button
              type="button"
              data-star
              onClick={() => onStar(card.id, !card.starred)}
              aria-label={card.starred ? 'Unstar card' : 'Star card'}
              aria-pressed={!!card.starred}
              className="-m-1 p-1 text-subtle-foreground hover:text-foreground md:mr-[236px] lg:mr-[220px]"
            >
              <Star className={cn('h-[17px] w-[17px] lg:h-[15px] lg:w-[15px]', card.starred && 'fill-plan text-plan')} strokeWidth={1.6} />
            </button>
          </div>
          <p className="mt-[29px] max-w-[400px] text-[27px] font-medium leading-[33px] text-foreground lg:mt-[37px] lg:max-w-[390px] lg:text-[30px] lg:leading-[36px]">
            {card.front}
          </p>
          <div className="mt-[66px] border-t border-dashed border-border pt-[25px] lg:mt-[73px] lg:border-solid lg:pt-[19px]">
            <p className="font-mono text-[9.5px] uppercase tracking-[1.2px] text-subtle-foreground lg:text-[10px] lg:font-medium">Answer, outcome first</p>
            {flipped ? (
              <p className="mt-2.5 text-[13.5px] leading-5 text-muted-foreground lg:text-[14.5px] lg:leading-[22px]">{card.back}</p>
            ) : (
              <p className="mt-2.5 text-[13.5px] leading-5 text-subtle-foreground lg:text-[14.5px] lg:leading-[22px]">
                Say it out loud first, then <span className="hidden lg:inline">press space or </span>tap the card to check.
                {card.hint && <span className="mt-1 block">Cue: {card.hint}</span>}
              </p>
            )}
          </div>
        </div>
      )}

      {card && (
        <div className="mt-5 lg:mt-6">
          <JkSectionLabel className="hidden tracking-[1.2px] lg:flex">How did that go?</JkSectionLabel>
          <div className="flex items-center justify-between gap-4 lg:mt-[11px]">
            <div className="grid flex-1 grid-cols-3 gap-[7px] lg:flex lg:flex-none lg:gap-2">
              {RATINGS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => { onRate(card.id, r.value); go(1) }}
                  aria-pressed={card.confidence === r.value}
                  className={cn(
                    'flex h-12 items-center justify-center gap-2 whitespace-nowrap rounded-full border bg-card px-3 text-[12.5px] font-medium text-foreground transition-colors lg:h-[42px] lg:justify-start lg:gap-2.5 lg:px-4 lg:text-[14px]',
                    card.confidence === r.value ? 'border-border-strong bg-accent' : 'border-input hover:border-border-strong',
                  )}
                >
                  <span className={cn('size-2 shrink-0 rounded-full', r.dot)} />
                  {r.label}
                </button>
              ))}
            </div>
            <div className="hidden items-center gap-[30px] lg:flex">
              <button type="button" onClick={() => go(-1)} aria-label="Previous card" className="-m-2 p-2 text-muted-foreground hover:text-foreground"><ChevronLeft className="h-4 w-4" /></button>
              <span className="font-mono text-[9.5px] uppercase tracking-[1.2px] text-subtle-foreground">Space to flip</span>
              <button type="button" onClick={() => go(1)} aria-label="Next card" className="-m-2 p-2 text-muted-foreground hover:text-foreground"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-[34px] lg:mt-[38px]">
        <div className="flex items-center justify-between">
          <JkSectionLabel className="font-normal tracking-[1.2px]">Cards mastered</JkSectionLabel>
          <p className="font-mono text-[12px] font-medium text-foreground">{mastered} / {cards.length}</p>
        </div>
        <div className="mt-2.5 flex gap-1" role="img" aria-label={`${mastered} of ${cards.length} cards locked in`}>
          {cards.map((c) => (
            <span
              key={c.id}
              className={cn(
                'h-[5px] min-w-0 flex-1 rounded-full',
                c.confidence === 'mastered' ? 'bg-ok' : c.confidence === 'learning' ? 'bg-warn' : c.confidence === 'needs-reps' ? 'bg-destructive' : 'bg-input',
              )}
            />
          ))}
        </div>
      </div>
    </>
  )
}

/* ─── Call panel (side panel on desktop, top of Pitch on phones) ────────── */

function CallPanel({ prep }: { prep: Prep & { proofPoints?: { id: string; title: string; detail: string }[] } }) {
  const bigFour = (prep.proofPoints?.length
    ? prep.proofPoints
    : prep.stories.map((s) => ({ id: s.id, title: s.title.split(/\s[—–-]\s/)[0], detail: s.outcome }))
  ).slice(0, 4)
  const guardrails = prep.trapsAndGuardrails ?? []
  return (
    <>
      {prep.elevatorPitch && (
        <section className="border-b border-border pb-[30px]">
          <JkSectionLabel as="h2">60 second pitch</JkSectionLabel>
          <p className="mt-3 whitespace-pre-line text-[14px] leading-[21.5px] text-foreground">{prep.elevatorPitch}</p>
        </section>
      )}
      {bigFour.length > 0 && (
        <section className="border-b border-border py-5">
          <JkSectionLabel as="h2">The big four</JkSectionLabel>
          <ul className="mt-[17px] space-y-[22px]">
            {bigFour.map((b, i) => (
              <li key={b.id} className="flex gap-[13px]">
                <span aria-hidden className="mt-0.5 h-[30px] w-[3px] shrink-0 rounded-full" style={{ background: BIG_FOUR_TICKS[i] }} />
                <div className="min-w-0">
                  <p className="text-[14.5px] font-medium leading-[17px] text-foreground">{b.title}</p>
                  <p className="mt-1 line-clamp-2 text-[12.5px] leading-[15px] text-muted-foreground">{b.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      {guardrails.length > 0 && (
        <section className="pt-5">
          <JkSectionLabel as="h2">Guardrails</JkSectionLabel>
          <ul className="mt-[13px] space-y-3">
            {guardrails.map((g) => (
              <li key={g.id} className="space-y-1.5 text-[13px] leading-[17px] text-muted-foreground">
                <p className="flex gap-3"><X className="mt-px h-3.5 w-3.5 shrink-0 text-destructive" strokeWidth={2} />{g.trap}</p>
                <p className="flex gap-3"><Check className="mt-px h-3.5 w-3.5 shrink-0 text-ok" strokeWidth={2} />{g.howToHandle}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

/* ─── Cheat sheet & pitch ─────────────────────────────────────────────────── */

function Brief({ prep, when, sub, newDeck, onCallAt }: { prep: Prep & { callAt?: number }; when: string | null; sub: string; newDeck: React.ReactNode; onCallAt: (ms: number) => void }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const [copied, setCopied] = useState(false)
  return (
    <>
      <div className="lg:hidden">
        <p className="text-[13.5px] leading-5 text-muted-foreground">{sub}</p>
      </div>
      <section className="mt-5 rounded-3xl border border-input bg-card p-5 lg:mt-0 lg:p-6">
        <JkSectionLabel as="h2">The call</JkSectionLabel>
        <p className="mt-2.5 text-[18px] font-medium text-foreground">{prep.role} at {prep.company}</p>
        <p className="mt-1 text-[13.5px] text-muted-foreground">{when ?? 'No call time yet.'}{prep.interviewerName && ` · ${prep.interviewerName}`}{prep.interviewerRole && `, ${prep.interviewerRole}`}</p>
        {prep.roleSummary && <p className="mt-3 text-[13.5px] leading-5 text-muted-foreground">{prep.roleSummary}</p>}
        <div className="mt-4 flex flex-wrap items-end gap-2.5">
          {editing ? (
            <>
              <JkField label="Call starts" id="callAt" className="w-[240px]">
                <Input id="callAt" type="datetime-local" value={value} onChange={(e) => setValue(e.target.value)} className={cn(jkFieldCls, 'h-10')} />
              </JkField>
              <Button size="sm" disabled={!value} onClick={() => { onCallAt(new Date(value).getTime()); setEditing(false) }}>Save</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
            </>
          ) : (
            <Button size="sm" variant="outline" className="rounded-full border-input" onClick={() => setEditing(true)}>{prep.callAt ? 'Change call time' : 'Set call time'}</Button>
          )}
          {prep.meetingLink && (
            <a href={prep.meetingLink} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center rounded-full bg-primary px-4 text-[13px] font-medium text-primary-foreground">Join the call</a>
          )}
        </div>
      </section>

      {prep.elevatorPitch && (
        <section className="mt-5 hidden xl:block">
          <div className="flex items-center justify-between">
            <JkSectionLabel as="h2">Copy your pitch</JkSectionLabel>
            <button type="button" onClick={() => { navigator.clipboard.writeText(prep.elevatorPitch!); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
              className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-foreground">
              {copied ? <Check className="h-3.5 w-3.5 text-ok" /> : <Copy className="h-3.5 w-3.5" />}{copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </section>
      )}

      <div className="mt-7 xl:hidden"><CallPanel prep={prep} /></div>

      <section className="mt-7 lg:hidden">
        <JkSectionLabel as="h2">Role alignment</JkSectionLabel>
        <div className="mt-3"><Alignment prep={prep} bare /></div>
      </section>

      <div className="mt-8 lg:hidden">{newDeck}</div>
    </>
  )
}

/* ─── Story bank ──────────────────────────────────────────────────────────── */

function Stories({ prep }: { prep: Prep }) {
  if (prep.stories.length === 0) return <p className="text-[14px] text-muted-foreground">No stories in this deck.</p>
  return (
    <>
      {prep.stories.map((s, i) => (
        <article key={s.id} className="mb-4 rounded-3xl border border-input bg-card p-5 lg:p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className="text-[17px] font-medium text-foreground">{s.title}</h2>
            <span className="font-mono text-[10px] uppercase tracking-[1.2px]" style={{ color: BIG_FOUR_TICKS[i % 4] === 'var(--bar-4)' ? 'var(--bar-4-ink)' : BIG_FOUR_TICKS[i % 4] }}>{s.tag}</span>
          </div>
          {s.hook && <p className="mt-2 text-[14px] leading-5 text-foreground">{s.hook}</p>}
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            {([['Outcome', s.outcome], ['Situation', s.situation], ['What I did', s.action], ['Why it matters here', s.takeaway]] as const).map(([k, v]) => (
              <div key={k}>
                <dt className="font-mono text-[10px] font-medium uppercase tracking-[1.2px] text-subtle-foreground">{k}</dt>
                <dd className="mt-1 text-[13.5px] leading-5 text-muted-foreground">{v}</dd>
              </div>
            ))}
          </dl>
        </article>
      ))}
    </>
  )
}

/* ─── Role alignment ──────────────────────────────────────────────────────── */

const STRENGTH: Record<string, { label: string; dot: string }> = {
  strong: { label: 'Strong', dot: 'bg-ok' },
  moderate: { label: 'Partial', dot: 'bg-warn' },
  pivot: { label: 'Pivot', dot: 'bg-destructive' },
}

function Alignment({ prep, bare }: { prep: Prep; bare?: boolean }) {
  const rows = prep.requirementMatches ?? []
  if (rows.length === 0) return <p className="text-[14px] text-muted-foreground">No requirements mapped in this deck.</p>
  return (
    <ul className={cn('divide-y divide-border', !bare && 'rounded-3xl border border-input bg-card px-5 lg:px-6')}>
      {rows.map((r) => (
        <li key={r.id} className="py-4">
          <div className="flex items-start justify-between gap-4">
            <p className="text-[14px] font-medium leading-5 text-foreground">{r.requirement}</p>
            <span className="flex shrink-0 items-center gap-1.5 text-[12px] text-muted-foreground">
              <span className={cn('size-2 rounded-full', STRENGTH[r.strength]?.dot ?? 'bg-input')} />{STRENGTH[r.strength]?.label ?? r.strength}
            </span>
          </div>
          <p className="mt-1 text-[13px] leading-5 text-muted-foreground">{r.yourProof}</p>
          {r.priority === 'must-have' && <p className="mt-1 font-mono text-[9.5px] uppercase tracking-[1.2px] text-subtle-foreground">Must have</p>}
        </li>
      ))}
    </ul>
  )
}

/* ─── Questions & notes ───────────────────────────────────────────────────── */

function Questions({ prep, onToggle, onToggleChecklist, onSaveNotes }: {
  prep: Prep; onToggle: (id: string) => void; onToggleChecklist: (id: string) => void; onSaveNotes: (n: string) => Promise<void>
}) {
  const [notes, setNotes] = useState(prep.callNotes ?? '')
  const [saving, setSaving] = useState(false)
  const asked = prep.questionsToAsk.filter((q) => q.asked).length
  return (
    <>
      <div className="flex items-center justify-between">
        <JkSectionLabel as="h2">Questions to ask</JkSectionLabel>
        <p className="font-mono text-[12px] text-foreground">{asked} / {prep.questionsToAsk.length}</p>
      </div>
      <ul className="mt-3 space-y-2">
        {prep.questionsToAsk.map((q) => (
          <li key={q.id}>
            <button type="button" onClick={() => onToggle(q.id)} aria-pressed={!!q.asked}
              className="flex w-full items-start gap-3 rounded-2xl border border-input bg-card px-4 py-3 text-left hover:border-border-strong">
              <span className={cn('mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border', q.asked ? 'border-ok bg-ok text-background' : 'border-border-strong')}>
                {q.asked && <Check className="h-3 w-3" strokeWidth={3} />}
              </span>
              <span className="min-w-0">
                <span className={cn('block text-[14px] leading-5', q.asked ? 'text-muted-foreground line-through' : 'text-foreground')}>{q.question}</span>
                {q.whyItMatters && <span className="mt-0.5 block text-[12.5px] leading-[17px] text-muted-foreground">{q.whyItMatters}</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {prep.checklist.length > 0 && (
        <>
          <JkSectionLabel as="h2" className="mt-8">Before the call</JkSectionLabel>
          <ul className="mt-3 space-y-1">
            {prep.checklist.map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => onToggleChecklist(c.id)} aria-pressed={c.done}
                  className="flex w-full items-start gap-3 rounded-xl px-1 py-2 text-left text-[14px] leading-5">
                  <span className={cn('mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border', c.done ? 'border-ok bg-ok text-background' : 'border-border-strong')}>
                    {c.done && <Check className="h-3 w-3" strokeWidth={3} />}
                  </span>
                  <span className={c.done ? 'text-muted-foreground line-through' : 'text-foreground'}>{c.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <JkSectionLabel as="h2" className="mt-8">Call notes</JkSectionLabel>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="What they asked, names, next steps…"
        className={cn(jkFieldCls, 'mt-3 min-h-[160px] w-full rounded-2xl px-4 py-3 text-[14px] leading-5')}
      />
      <div className="mt-3 flex justify-end">
        <Button size="sm" disabled={saving || notes === (prep.callNotes ?? '')} onClick={async () => { setSaving(true); try { await onSaveNotes(notes) } finally { setSaving(false) } }}>
          {saving ? 'Saving…' : 'Save notes'}
        </Button>
      </div>
    </>
  )
}

/* ─── New deck ────────────────────────────────────────────────────────────── */

type NewDeckArgs = {
  job: { _id: string; company: string; title: string; compensation?: string; resumeUsed?: string } | null
  company: string; role: string; description: string; notes: string; resume: any | null
}

async function createDeck(createPrep: ReturnType<typeof useMutation<typeof api.interviewPreps.create>>, a: NewDeckArgs): Promise<Id<'interviewPreps'>> {
  const res = await fetch('/api/interview-prep/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ company: a.company, role: a.role, description: a.description, notes: a.notes, resumeContent: a.resume?.content ?? null }),
  })
  const data = await res.json()
  if (!res.ok || !data.prep) throw new Error(data.error || 'Could not write the deck')
  const g = data.prep
  const arr = (x: unknown) => (Array.isArray(x) ? x : [])
  const base = {
    jobId: a.job ? (a.job._id as Id<'jobs'>) : undefined,
    company: a.company,
    role: a.role,
    compensationTarget: a.job?.compensation,
    resumeUsed: a.job?.resumeUsed || a.resume?.name,
    status: 'upcoming',
    elevatorPitch: g.elevatorPitch,
    roleSummary: g.roleSummary,
    flashcards: arr(g.flashcards).map((c: any) => ({ ...c, confidence: undefined, starred: false })),
    stories: arr(g.stories),
    requirementMatches: arr(g.requirementMatches),
    questionsToAsk: arr(g.questionsToAsk),
    trapsAndGuardrails: arr(g.trapsAndGuardrails),
    checklist: arr(g.checklist),
  }
  const proofPoints = arr(g.proofPoints)
    .filter((p: any) => typeof p?.title === 'string' && typeof p?.detail === 'string')
    .slice(0, 4)
    .map((p: any, i: number) => ({ id: String(p.id ?? `pp-${i + 1}`), title: p.title, detail: p.detail }))
  try {
    return await createPrep({ ...base, proofPoints })
  } catch (err) {
    // The deployed backend may not know proofPoints yet (schema change waits for a deploy).
    if (proofPoints.length && /proofPoints|extra field|Validator/i.test(String(err))) return await createPrep(base)
    throw err
  }
}

function CreateDeck({ jobs, presetJob, resume, onCancel, onCreate }: {
  jobs: any[]; presetJob: string; resume: any | null; onCancel: () => void; onCreate: (a: NewDeckArgs) => Promise<void>
}) {
  const [jobId, setJobId] = useState(presetJob)
  const [company, setCompany] = useState('')
  const [role, setRole] = useState('')
  const [description, setDescription] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const job = jobs.find((j) => j._id === jobId) ?? null

  const submit = async () => {
    const c = job ? job.company : company.trim()
    const r = job ? job.title : role.trim()
    if (!c || !r) { toast.error('Pick a job, or type the company and role.'); return }
    setBusy(true)
    try {
      await onCreate({ job, company: c, role: r, description: job ? job.description || '' : description.trim(), notes: job ? job.notes || '' : notes.trim(), resume })
      toast.success('Deck ready', `${c}, ${r}`)
    } catch (e) {
      toast.error('Could not write the deck', e instanceof Error ? e.message : undefined)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section data-enter className="mx-5 mb-5 rounded-[28px] border border-input bg-card p-5 lg:mx-8 lg:p-7">
      <h2 className="jk-enter text-[18px] font-medium text-foreground" style={enter(0)}>New prep deck</h2>
      <p className="jk-enter mt-1 text-[13.5px] text-muted-foreground" style={enter(1)}>
        Written from {resume ? `your resume "${resume.name}"` : 'the job alone (add a base resume for answers in your own words)'} and the posting.
      </p>
      <div className="jk-enter mt-5 grid gap-4 md:grid-cols-2" style={enter(2)}>
        <JkField label="Job" id="prep-job" className="md:col-span-2">
          <select id="prep-job" value={jobId} onChange={(e) => setJobId(e.target.value)} className={cn(jkFieldCls, 'h-11 w-full px-3')}>
            <option value="">Type it in instead</option>
            {jobs.map((j) => <option key={j._id} value={j._id}>{j.company} · {j.title}</option>)}
          </select>
        </JkField>
        {!job && (
          <>
            <JkField label="Company" id="prep-company"><Input id="prep-company" value={company} onChange={(e) => setCompany(e.target.value)} className={cn(jkFieldCls, 'h-11')} /></JkField>
            <JkField label="Role" id="prep-role"><Input id="prep-role" value={role} onChange={(e) => setRole(e.target.value)} className={cn(jkFieldCls, 'h-11')} /></JkField>
            <JkField label="Job description" id="prep-desc" className="md:col-span-2">
              <textarea id="prep-desc" value={description} onChange={(e) => setDescription(e.target.value)} className={cn(jkFieldCls, 'min-h-[110px] w-full px-3 py-2')} />
            </JkField>
            <JkField label="Notes for the call (optional)" id="prep-notes" className="md:col-span-2">
              <Input id="prep-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Who you're meeting, format, pay range" className={cn(jkFieldCls, 'h-11')} />
            </JkField>
          </>
        )}
      </div>
      <div className="jk-enter mt-5 flex justify-end gap-2" style={enter(3)}>
        <Button variant="ghost" onClick={onCancel} disabled={busy}>Cancel</Button>
        <Button onClick={submit} disabled={busy} className="gap-2">{busy && <Loader2 className="h-4 w-4 animate-spin" />}{busy ? 'Writing your deck…' : 'Write the deck'}</Button>
      </div>
    </section>
  )
}

/** What a deck holds — shown on the empty page so the feature explains itself. */
const DECK_PARTS = [
  { label: 'Cheat sheet & pitch', note: 'Your 60-second answer to "tell me about yourself"', tick: 'var(--bar-1)' },
  { label: 'Flashcards', note: 'The questions this role will ask, answered from your resume', tick: 'var(--bar-2)' },
  { label: 'Story bank', note: 'Situation, action, result for the projects you will lean on', tick: 'var(--bar-3)' },
  { label: 'Questions & notes', note: 'What to ask them, and a place to write during the call', tick: 'var(--bar-4)' },
]

function PrepEmpty({ jobs, onNew, onPick }: { jobs: any[]; onNew: () => void; onPick: (jobId: string) => void }) {
  const recent = jobs.slice(0, 3)
  return (
    <section data-enter className="mx-5 mt-2 grid gap-5 lg:mx-8 lg:mt-10 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] xl:gap-8">
      {/* Left: the pitch and the way in */}
      <div className="flex flex-col">
        <h2 className="jk-enter max-w-[440px] text-[30px] font-medium leading-[1.08] tracking-[-0.8px] text-foreground lg:text-[40px] lg:tracking-[-1.2px]" style={enter(0)}>
          Walk into the call already knowing your answers
        </h2>
        <p className="jk-enter mt-4 max-w-[440px] text-[14.5px] leading-relaxed text-muted-foreground" style={enter(1)}>
          Pick a job you track. JobKompass reads the posting and your resume and writes the deck you rehearse from.
        </p>
        <div className="jk-enter mt-7" style={enter(2)}>
          <Button onClick={onNew} className="h-11 rounded-full px-7 text-[14px] font-medium">New deck</Button>
        </div>

        {recent.length > 0 && (
          <div className="jk-enter mt-10" style={enter(3)}>
            <p className="font-mono text-[11px] uppercase tracking-[1.6px] text-subtle-foreground">Start from a job you track</p>
            <ul className="mt-3 divide-y divide-border overflow-hidden rounded-[20px] border border-input bg-card">
              {recent.map((j) => (
                <li key={j._id}>
                  <button
                    type="button"
                    onClick={() => onPick(j._id)}
                    className="group flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors hover:bg-accent"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-input bg-popover text-[13px] font-medium text-foreground">
                      {(j.company || '?').trim().charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium text-foreground">{j.title}</span>
                      <span className="block truncate text-[12.5px] text-muted-foreground">{j.company}</span>
                    </span>
                    <span className="shrink-0 text-[12.5px] text-subtle-foreground transition-colors group-hover:text-foreground">Prep this →</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Right: a real-looking deck so the page shows what you get */}
      <div className="jk-enter relative" style={enter(2)} aria-hidden>
        <div className="relative mx-auto max-w-[520px] pb-5">
          <div className="absolute inset-x-8 bottom-0 top-8 rounded-[28px] border border-input bg-popover/60" />
          <div className="absolute inset-x-4 bottom-2.5 top-4 rounded-[28px] border border-input bg-popover/80" />
          <article className="relative rounded-[28px] border border-input bg-card p-6 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.6)] lg:p-7">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[11px] uppercase tracking-[1.6px] text-subtle-foreground">Card 1 of 24 · Role & fit</p>
              <span className="h-2 w-2 rounded-full bg-warn" />
            </div>
            <p className="mt-5 text-[20px] font-medium leading-snug tracking-[-0.3px] text-foreground lg:text-[22px]">
              Why this role, and why now?
            </p>
            <div className="mt-5 space-y-2.5 border-t border-border pt-5 text-[13.5px] leading-relaxed text-muted-foreground">
              <p>Open with the problem you solved last that looks most like theirs.</p>
              <p>Name the part of the posting that pulled you in, in their words.</p>
              <p>Close on what you want to own in the first 90 days.</p>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              {RATINGS.map((r) => (
                <span key={r.value} className="inline-flex items-center gap-1.5 rounded-full border border-input bg-popover px-3 py-1.5 text-[12px] text-muted-foreground">
                  <span className={cn('h-1.5 w-1.5 rounded-full', r.dot)} />{r.label}
                </span>
              ))}
            </div>
          </article>
        </div>

        <ul className="mx-auto mt-4 grid max-w-[520px] gap-px overflow-hidden rounded-[20px] border border-input bg-border sm:grid-cols-2">
          {DECK_PARTS.map((d) => (
            <li key={d.label} className="bg-card px-4 py-3.5">
              <span className="flex items-center gap-2 text-[13.5px] font-medium text-foreground">
                <span className="h-3 w-[3px] rounded-full" style={{ background: d.tick }} />{d.label}
              </span>
              <span className="mt-1 block text-[12.5px] leading-snug text-muted-foreground">{d.note}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
