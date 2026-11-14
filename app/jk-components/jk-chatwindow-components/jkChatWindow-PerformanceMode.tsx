'use client'

/**
 * Performance (D11 desktop, M09 phone). Every number comes from the user's jobs and
 * documents through lib/performance/stats.ts. "What JobKompass sees" is Pro only and
 * comes from /api/performance/summary (three headline + evidence items).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, LogIn } from 'lucide-react'
import { useAuth } from '@/providers/jkAuthProvider'
import { useSubscription } from '@/providers/jkSubscriptionProvider'
import { useJobs } from '@/providers/jkJobsProvider'
import { useJobKompassDocuments } from '@/providers/jkDocumentsProvider'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { trackUpgradeClicked } from '@/lib/analytics/client'
import { rateLimitMessageFromResponse } from '@/lib/rateLimit/message'
import { computePerformance, fmtPct, type PerfJob, type PerfScope } from '@/lib/performance/stats'
import JkAppPageHeader from '../jk-app/jkAppPageHeader'
import JkSegmented from '../jk-app/jkSegmented'
import JkSectionLabel from '../jk-app/jkSectionLabel'
import JkArt from '../jkArt'
import JkUpgradeModal from '../jkUpgradeModal'
import { JkGauge, JkSankey, JkSparkline, JkWeeklyChart } from '../jk-performance/jkCharts'

const SCOPES: { value: PerfScope; label: string }[] = [
  { value: 'month', label: 'This month' },
  { value: 'all', label: 'All time' },
]

const enter = (i: number) => ({ '--i': i }) as React.CSSProperties
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

export default function JkCW_PerformanceMode() {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const { isPro } = useSubscription()
  const { allJobs, jobs } = useJobs()
  const { documents, isLoading: docsLoading } = useJobKompassDocuments()
  const [scope, setScope] = useState<PerfScope>('month')
  const [upgradeOpen, setUpgradeOpen] = useState(false)

  const stats = useMemo(() => {
    const resumes = documents.filter((d: any) => d.documentType === 'resume')
    const letters = documents.filter((d: any) => d.documentType === 'cover-letter')
    return computePerformance(allJobs as unknown as PerfJob[], resumes, letters, scope)
  }, [allJobs, documents, scope])

  if (authLoading) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
  }
  if (!isAuthenticated) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
        <h2 className="text-[22px] font-medium text-foreground">Sign in to see how your search is going</h2>
        <Button className="mt-5 gap-2" onClick={() => window.dispatchEvent(new CustomEvent('jk:openSignIn'))}>
          <LogIn className="h-4 w-4" /> Sign in
        </Button>
      </div>
    )
  }

  const loading = jobs === undefined || docsLoading
  const month = scope === 'month'
  const { rate, prevRate } = stats
  const shortPrev = stats.prevMonthLabel.slice(0, 3).toUpperCase()

  // "2 interviews from 38 applications. Up from 3.1% in October."
  const rateLine = rate.applications === 0
    ? month ? `No applications dated ${stats.monthLabel} yet.` : 'No applications yet.'
    : `${plural(rate.interviews, 'interview')} from ${plural(rate.applications, 'application')}.`
  let compareLine: string | null = null
  if (month && prevRate && rate.interviewRate !== null) {
    if (prevRate.interviewRate === null) compareLine = `No applications in ${stats.prevMonthLabel} to compare with.`
    else {
      const d = rate.interviewRate - prevRate.interviewRate
      const word = Math.abs(d) < 0.05 ? 'Same as' : d > 0 ? 'Up from' : 'Down from'
      compareLine = Math.abs(d) < 0.05 ? `Same as ${stats.prevMonthLabel}.` : `${word} ${fmtPct(prevRate.interviewRate)}% in ${stats.prevMonthLabel}.`
    }
  }

  const docsSub = `${plural(stats.docs.resumes, 'resume')}, ${plural(stats.docs.letters, 'letter')}`

  return (
    <div className="chat-scroll h-full overflow-y-auto pb-[calc(var(--jk-tabbar-h)+24px)] lg:pb-10">
      <JkAppPageHeader
        title="Performance"
        sub={`How the search is going, from ${plural(stats.totalJobs, 'tracked job')}`}
        art="waves"
        artHeight={150}
        divider
        className="border-b-0 lg:border-b"
        actions={<JkSegmented options={SCOPES} value={scope} onChange={setScope} size="sm" ariaLabel="Period" />}
      />

      {loading ? (
        <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div key={scope}>
          {/* ── Headline numbers ─────────────────────────────────────────── */}
          <section data-enter className="mx-5 grid grid-cols-3 border-b border-border pb-7 lg:mx-0 lg:px-8 lg:pb-7 lg:pt-[26px] xl:grid-cols-[minmax(0,420fr)_repeat(3,minmax(0,240fr))]">
            <div className="jk-enter col-span-3 pt-3 lg:pt-0 xl:col-span-1 xl:pr-6" style={enter(0)}>
              <JkSectionLabel as="h2" className="tracking-[1.4px] lg:tracking-[1.6px]">Interview rate</JkSectionLabel>
              <div className="mt-0 flex items-end justify-between gap-2 lg:justify-start lg:gap-12">
                <p className="flex items-baseline whitespace-nowrap text-foreground" aria-label={`Interview rate ${fmtPct(rate.interviewRate)} percent`}>
                  <span className="text-[100px] font-medium leading-[119px] tracking-[-4px] lg:text-[112px] lg:leading-[133px]">{fmtPct(rate.interviewRate)}</span>
                  <span className="ml-2.5 text-[38px] font-medium text-subtle-foreground lg:text-[44px]">%</span>
                </p>
                <JkGauge value={rate.interviewRate} previous={month ? prevRate?.interviewRate ?? null : null} previousLabel={shortPrev} className="mb-3 shrink-0 lg:mb-6" />
              </div>
              <p className="-mt-1 max-w-[420px] text-[14.5px] leading-5 text-muted-foreground">
                {rateLine}
                {compareLine && <><br className="lg:hidden" /><span className="hidden lg:inline"> </span>{compareLine}</>}
              </p>
            </div>

            <div className="col-span-3 mt-8 grid grid-cols-3 border-t border-border pt-7 lg:mt-7 xl:contents">
              <StatTile
                i={1}
                label={<><span className="xl:hidden">Offer rate</span><span className="hidden xl:inline">Offer rate</span></>}
                value={rate.offerRate === null ? '–' : `${fmtPct(rate.offerRate)}%`}
                sub={plural(rate.offers, 'offer')}
                spark={<JkSparkline values={stats.sparks.offerRate} color="var(--bar-2)" label="Offer rate, last 6 months" />}
              />
              <StatTile
                i={2}
                label={month
                  ? <><span className="lg:hidden">Applied</span><span className="hidden lg:inline">Applied this month</span></>
                  : 'Applied'}
                value={String(month ? stats.appliedThisMonth : stats.appliedTotal)}
                sub={month ? `${stats.appliedLastMonth} last month` : `${stats.appliedThisMonth} this month`}
                spark={<JkSparkline values={stats.sparks.applied} color="var(--bar-3)" label="Applications, last 6 months" />}
              />
              <StatTile
                i={3}
                label={<><span className="lg:hidden">Documents</span><span className="hidden lg:inline">Documents written</span></>}
                value={String(stats.docs.total)}
                sub={<><span className="lg:hidden">{stats.docs.resumes} + {stats.docs.letters}</span><span className="hidden lg:inline">{docsSub}</span></>}
                spark={<JkSparkline values={stats.sparks.docs} color="var(--bar-4-ink)" label="Documents, last 6 months" />}
              />
            </div>
          </section>

          {/* ── Sankey + weekly chart ────────────────────────────────────── */}
          <section data-enter className="grid border-b-0 border-border xl:grid-cols-[minmax(0,682fr)_minmax(0,494fr)] xl:border-b">
            <div className="jk-enter border-b border-border px-5 pb-10 pt-7 lg:px-8 lg:pt-[26px] xl:border-b-0 xl:border-r xl:pb-6" style={enter(0)}>
              <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                <JkSectionLabel as="h2" className="tracking-[1.4px] lg:tracking-[1.6px]">Where {plural(stats.sankey.saved, 'job')} ended up</JkSectionLabel>
                <p className="font-mono text-[9px] uppercase tracking-[0.8px] text-subtle-foreground lg:text-[9.5px]">Saved &gt; applied &gt; outcome</p>
              </div>
              {month && <p className="mt-1.5 text-[12px] text-subtle-foreground">Jobs saved in {stats.monthLabel}.</p>}
              <JkSankey data={stats.sankey} className="mt-7 lg:mt-8" />
            </div>

            <div className="jk-enter border-b border-border px-5 pb-8 pt-7 lg:px-8 lg:pt-[26px] xl:border-b-0" style={enter(1)}>
              <div className="flex items-center justify-between">
                <JkSectionLabel as="h2" className="tracking-[1.4px] lg:tracking-[1.6px]">Applications per week</JkSectionLabel>
                <p className="font-mono text-[9.5px] uppercase tracking-[1.2px] text-subtle-foreground"><span className="lg:hidden">12 weeks</span><span className="hidden lg:inline">Last 12 weeks</span></p>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-[12px] text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-bar-4-ink" />Applications</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-plan" />Interview booked</span>
              </div>
              <JkWeeklyChart weeks={stats.weeks} average={stats.weeklyAverage} showInterviews={stats.hasInterviewDates} className="mt-4" />
              {(!stats.hasInterviewDates || stats.undatedApplied > 0) && (
                <p className="mt-3 text-[12px] leading-4 text-subtle-foreground">
                  {!stats.hasInterviewDates && 'Interview dates show up as you move jobs to Interviewing. '}
                  {stats.undatedApplied > 0 && `${plural(stats.undatedApplied, 'application')} with no date applied ${stats.undatedApplied === 1 ? "isn't" : "aren't"} on the chart.`}
                </p>
              )}
            </div>
          </section>

          {/* ── What JobKompass sees (Pro) ───────────────────────────────── */}
          <section data-enter className="px-5 pt-6 lg:px-8">
            <div className="jk-enter" style={enter(0)}>
              <JkSees isPro={isPro} applications={stats.appliedTotal} onUpgrade={() => { trackUpgradeClicked({ surface: 'performance_insights', authenticated: true }); setUpgradeOpen(true) }} />
            </div>
          </section>
        </div>
      )}

      <JkUpgradeModal isOpen={upgradeOpen} onClose={() => setUpgradeOpen(false)} feature="What JobKompass sees" currentLimit="Pro plan" />
    </div>
  )
}

function StatTile({ i, label, value, sub, spark }: { i: number; label: React.ReactNode; value: string; sub: React.ReactNode; spark: React.ReactNode }) {
  return (
    <div
      className="jk-enter min-w-0 border-border pr-2 [&:not(:first-child)]:border-l [&:not(:first-child)]:pl-3.5 sm:pr-4 lg:[&:not(:first-child)]:pl-6 xl:border-l xl:pl-6"
      style={enter(i)}
    >
      <JkSectionLabel as="h2" className="text-[9.5px] tracking-[1.2px] lg:text-[10px] lg:tracking-[1.6px]">{label}</JkSectionLabel>
      <p className="mt-2.5 text-[28px] font-medium leading-[33px] tracking-[-0.6px] text-foreground lg:mt-4 lg:text-[44px] lg:leading-[52px] lg:tracking-[-1px]">{value}</p>
      <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground lg:mt-1 lg:text-[13px]">{sub}</p>
      <div className="mt-4 lg:mt-3">{spark}</div>
    </div>
  )
}

type SeesItem = { headline: string; evidence: string }
const SEES_TICKS = ['var(--bar-2)', 'var(--bar-3)', 'var(--bar-4)']

function JkSees({ isPro, applications, onUpgrade }: { isPro: boolean; applications: number; onUpgrade: () => void }) {
  const [items, setItems] = useState<SeesItem[] | null>(null)
  const [state, setState] = useState<'idle' | 'loading' | 'error' | 'thin'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const rowRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    setState('loading')
    setError(null)
    try {
      const res = await fetch('/api/performance/summary', { method: 'POST' })
      if (res.status === 429) throw new Error(rateLimitMessageFromResponse(res))
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Something went wrong.')
      if (data.reason === 'not-enough-data') { setState('thin'); setItems([]); return }
      setItems(data.items)
      setState('idle')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
      setState('error')
    }
  }, [])

  useEffect(() => { if (isPro) load() }, [isPro, load])

  const onScroll = () => {
    const el = rowRef.current
    if (!el) return
    setPage(Math.round(el.scrollLeft / el.clientWidth))
  }

  return (
    <div>
      <div className="relative isolate overflow-hidden rounded-[22px] border border-input bg-card lg:rounded-3xl">
        <div aria-hidden className="pointer-events-none absolute bottom-1 right-4 top-1 -z-10 hidden aspect-square md:block">
          <JkArt name="step3" variant="spot" fade="all" />
        </div>
        <div className="px-[18px] pb-6 pt-5 lg:px-6 lg:pb-7 lg:pt-6 md:pr-[220px]">
          <div className="flex items-center justify-between gap-3 md:justify-start md:gap-5">
            <h2 className="flex items-center gap-3 text-[15px] font-medium text-foreground lg:text-[15px]">
              <span aria-hidden className="flex gap-[3px]">
                {['var(--bar-1)', 'var(--bar-2)', 'var(--bar-3)', 'var(--bar-4)'].map((c) => <span key={c} className="h-[13px] w-[3px] rounded-full" style={{ background: c }} />)}
              </span>
              What JobKompass sees
            </h2>
            <span className="rounded-full bg-plan/15 px-2 py-0.5 font-mono text-[9.5px] font-bold tracking-[0.8px] text-plan-text">PRO</span>
          </div>

          {!isPro ? (
            <div className="mt-4">
              <p className="text-[14px] font-medium text-foreground">Patterns in your own search, read from your jobs.</p>
              <p className="mt-1 text-[12.5px] text-muted-foreground">Which resumes get callbacks, what goes quiet, which days work. Part of Pro.</p>
              <Button size="sm" className="mt-4" onClick={onUpgrade}>See Pro</Button>
            </div>
          ) : state === 'loading' ? (
            <div className="mt-5 flex items-center gap-2 text-[13px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Reading your numbers…</div>
          ) : state === 'thin' ? (
            <p className="mt-4 text-[13px] leading-5 text-muted-foreground">
              Not enough data yet. This needs at least 5 applications to say anything real; you have {applications}.
            </p>
          ) : state === 'error' ? (
            <div className="mt-4 text-[13px] text-muted-foreground">
              {error} <button className="ml-1 text-foreground underline underline-offset-4" onClick={load}>Try again</button>
            </div>
          ) : items && (
            <div ref={rowRef} onScroll={onScroll} className="-mx-[18px] mt-4 flex snap-x snap-mandatory overflow-x-auto px-[18px] [scrollbar-width:none] md:mx-0 md:block md:overflow-visible md:px-0 md:space-y-[13px]">
              {items.map((it, i) => (
                <div key={i} className="flex w-full shrink-0 snap-start gap-[13px] md:w-auto">
                  <span aria-hidden className="mt-[3px] h-[26px] w-[3px] shrink-0 rounded-full md:h-[26px]" style={{ background: SEES_TICKS[i % 3] }} />
                  <div className="min-w-0 pr-2">
                    <p className="text-[18px] font-medium leading-6 text-foreground md:text-[14px] md:leading-[17px]">{it.headline}</p>
                    <p className="mt-1 text-[15px] leading-[22px] text-muted-foreground md:mt-0.5 md:text-[12.5px] md:leading-[15px]">{it.evidence}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {isPro && items && items.length > 1 && (
        <p className="mt-2.5 text-center font-mono text-[9.5px] tracking-[1.2px] text-subtle-foreground md:hidden">{page + 1} OF {items.length}</p>
      )}
    </div>
  )
}
