'use client'

/**
 * D27 / D28 / D29, M26 / M27 Agent activity. Last item of the Settings rail (under CLI keys); on
 * phones it opens from Settings and the back arrow returns there.
 *
 * Data: api.agent.activity.summaryMine (figures, by model / agent / action, filter menus) and
 * api.agent.activity.listMine (the feed, paginated). Signed-in user's rows only. Nothing here is
 * sample data: what the agent did not report shows as an em dash.
 */
import { useMemo, useState } from "react"
import { useQuery, usePaginatedQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { useAuth } from "@/providers/jkAuthProvider"
import { useJobs } from "@/providers/jkJobsProvider"
import { cn } from "@/lib/utils"
import { rangeFrom, startOfDay, type ActivityRange } from "@/lib/agentActivity/format"
import JkAppPageHeader from "../jk-app/jkAppPageHeader"
import JkSegmented from "../jk-app/jkSegmented"
import JkSectionLabel from "../jk-app/jkSectionLabel"
import { useJkAppNav } from "../jk-app/jkAppNav"
import { goToSectionWhenMounted } from "./jkChatWindow-SettingsMode"
import { openKeyIdentityOnMount } from "../jk-cli-keys/jkCliKeys"
import { agentDisplayName, allUnknown } from "@/lib/agentActivity/identity"
import { JkFilterPill, JkModelIcon, type ActivityFilters, type ActivityItem, type ActivitySummary } from "../jk-agent-activity/jkActivityParts"
import {
  JkActivityByAction, JkActivityByAgent, JkActivityByModel, JkActivityDetails, JkActivityEmpty,
  JkActivityFeedCards, JkActivityFeedTable, JkActivityFilterButton, JkActivityFilterSheet, JkActivityStats,
  JkActivityUnknownBanner,
} from "../jk-agent-activity/jkActivitySections"

const RANGES: { value: ActivityRange; label: string }[] = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "all", label: "All time" },
]
const PAGE = 25
const SUB = "What your agents did on your account, and how each model held up"
const enter = (i: number) => ({ "--i": i } as React.CSSProperties)

export default function JkCW_AgentActivityMode() {
  const { isAuthenticated } = useAuth()
  const { setSelectedJobId } = useJobs()
  const nav = useJkAppNav()

  const [range, setRange] = useState<ActivityRange>("30d")
  const [filters, setFilters] = useState<ActivityFilters>({})
  const [sheetOpen, setSheetOpen] = useState(false)
  const [draftCount, setDraftCount] = useState<ActivityFilters | null>(null)
  const [selected, setSelected] = useState<ActivityItem | null>(null)

  // Day boundaries keep the query args stable for the whole day (no resubscribe every render).
  const today = startOfDay(Date.now())
  const from = useMemo(() => rangeFrom(range, today), [range, today])
  const args = { ...filters, ...(from !== undefined ? { from } : {}) }

  const summary = useQuery(api.agent.activity.summaryMine, isAuthenticated ? { ...args, todayStart: today } : "skip")
  const feed = usePaginatedQuery(api.agent.activity.listMine, isAuthenticated && summary?.hasAny ? args : "skip", { initialNumItems: PAGE })
  // "Show N actions" in the phone sheet counts the pending choice live.
  const pending = useQuery(
    api.agent.activity.summaryMine,
    isAuthenticated && sheetOpen && draftCount ? { ...draftCount, ...(from !== undefined ? { from } : {}), todayStart: today } : "skip",
  )

  const openJob = (jobId: string) => { setSelected(null); setSelectedJobId(jobId as Id<"jobs">); nav.go("/my-jobs") }
  const manageKeys = () => { nav.go("/settings"); goToSectionWhenMounted("cli") }
  const scopeKey = (keyId: string) => { setSelected(null); openKeyIdentityOnMount(keyId); manageKeys() }

  const empty = summary !== undefined && summary !== null && !summary.hasAny
  const data = summary && summary.hasAny ? (summary as ActivitySummary) : null

  const setFilter = (key: keyof ActivityFilters) => (v: string | undefined) => setFilters((f) => ({ ...f, [key]: v }))

  return (
    <div className="chat-scroll relative flex h-full flex-col overflow-y-auto">
      <JkAppPageHeader
        title="Agent activity" sub={SUB} art="cabin" artHeight={170} artPosition="right 30%" live={false}
        divider={!empty} className={cn("max-lg:hidden", !empty && "lg:pb-6")}
        actions={empty ? undefined : (
          <JkSegmented size="sm" ariaLabel="Time range" options={RANGES} value={range} onChange={setRange} className="[&>button]:w-[92px] [&>button]:px-0" />
        )}
        bottom={empty || !data ? undefined : (
          <div className="flex flex-wrap gap-2.5 pt-[21px]">
            <JkFilterPill label="Agent" value={filters.agent} onChange={setFilter("agent")} options={data.options.agents.map((a) => ({ value: a, label: agentDisplayName(a) }))} />
            <JkFilterPill label="Model" mono icon={(m) => <JkModelIcon model={m} className="size-3.5" />} value={filters.model} onChange={setFilter("model")} options={data.options.models.map((m) => ({ value: m, label: m }))} />
            <JkFilterPill label="Action" mono value={filters.actionType} onChange={setFilter("actionType")} options={data.options.actionTypes.map((a) => ({ value: a, label: a }))} />
            <JkFilterPill label="Status" value={filters.status} onChange={(v) => setFilters((f) => ({ ...f, status: v as ActivityFilters["status"] }))}
              options={[{ value: "success", label: "Done" }, { value: "error", label: "Failed" }]} />
          </div>
        )}
      />

      {empty && (
        <div data-enter className="px-5 pb-24 pt-8 lg:px-8 lg:pt-[197px]">
          <JkActivityEmpty onManageKeys={manageKeys} />
        </div>
      )}

      {data && (
        <div data-enter className="pb-24">
          {/* Phone + tablet controls (M26): range, then one filter row that opens the sheet */}
          <div className="flex flex-col gap-3 px-5 pt-5 lg:hidden">
            <JkSegmented ariaLabel="Time range" options={RANGES} value={range} onChange={setRange} className="w-full [&>button]:flex-1 [&>button]:px-0" />
            <JkActivityFilterButton filters={filters} onClick={() => setSheetOpen(true)} />
          </div>

          <div className="border-b border-border px-5 pb-6 pt-7 lg:px-8 lg:pb-7 lg:pt-[26px]">
            <JkActivityStats summary={data} />
          </div>

          {data.total === 0 ? (
            <p className="jk-enter px-5 pt-8 text-[14px] text-muted-foreground lg:px-8" style={enter(4)}>Nothing in this range. Try All time or clear a filter.</p>
          ) : (
            <>
              <div className="grid border-b border-border min-[1360px]:grid-cols-[minmax(0,664fr)_minmax(0,512fr)]">
                <div className="px-5 lg:px-8 min-[1360px]:pr-8">
                  <div className="border-b border-border py-[26px] min-[1360px]:border-0 min-[1360px]:pb-0">
                    <JkActivityByModel summary={data} />
                  </div>
                  <div className="border-b border-border py-[26px] min-[1360px]:border-0 min-[1360px]:pb-3 min-[1360px]:pt-[30px]">
                    <JkActivityByAgent summary={data} onScopeKeys={manageKeys} />
                  </div>
                </div>
                <div className="px-5 py-[26px] lg:px-8 min-[1360px]:border-l min-[1360px]:border-border">
                  <JkActivityByAction summary={data} />
                </div>
              </div>

              <section className="px-5 pt-[26px] lg:px-8 lg:pt-6">
                {allUnknown(data.byAgent) && <div className="mb-6"><JkActivityUnknownBanner summary={data} onScopeKeys={manageKeys} /></div>}
                <div className="flex items-center justify-between gap-4">
                  <JkSectionLabel as="h2">Activity</JkSectionLabel>
                  <span className="font-mono text-[9.5px] uppercase text-subtle-foreground">Newest first</span>
                </div>
                <div className="mt-[21px] max-[1359px]:hidden">
                  <JkActivityFeedTable items={feed.results} selectedId={selected?.id} onOpen={setSelected} />
                </div>
                <div className="mt-[15px] min-[1360px]:hidden">
                  <JkActivityFeedCards items={feed.results} onOpen={setSelected} />
                </div>
                <div className="mt-[22px] flex flex-col items-center gap-4 min-[1360px]:items-start">
                  {feed.status === "CanLoadMore" && (
                    <button type="button" onClick={() => feed.loadMore(PAGE)} className="text-[14px] font-medium text-foreground hover:underline min-[1360px]:order-2">Show more</button>
                  )}
                  <p className="font-mono text-[10px] uppercase text-subtle-foreground max-[1359px]:hidden">
                    {feed.results.length} of {data.total}{data.truncated ? "+" : ""} shown
                  </p>
                </div>
              </section>
            </>
          )}

          <JkActivityDetails item={selected} onClose={() => setSelected(null)} onOpenJob={openJob} onScopeKey={scopeKey} />
          <JkActivityFilterSheet
            open={sheetOpen}
            onOpenChange={setSheetOpen}
            options={data.options}
            value={filters}
            onApply={setFilters}
            onDraftChange={setDraftCount}
            count={pending === undefined || pending === null ? null : pending.hasAny ? pending.total : 0}
          />
        </div>
      )}
    </div>
  )
}
