'use client'

/**
 * The blocks of the Agent activity page. Each takes the real query data as props and lays itself
 * out for the phone frame (M26) below `md` and the desktop frame (D27) from `md`:
 *
 *   <JkActivityStats summary />             ACTIONS · SUCCESS RATE · AVERAGE TIME · TOKENS (4-up, 2x2 on phones)
 *   <JkActivityByModel summary />           table with success bars on a full 0-100% scale; list on phones
 *   <JkActivityByAgent summary onScopeKeys />  one card per agent; Unknown nudges to scope a key (D30)
 *   <JkActivityUnknownBanner … />           when every row is an unknown agent
 *   <JkActivityByAction summary />          runs bars with the failed share, best model per action
 *   <JkActivityFeedTable items onOpen />    the activity table (wide screens)
 *   <JkActivityFeedCards items onOpen />    the activity as cards (phones, narrow desktop)
 *   <JkActivityDetails item onClose … />    D31 details panel: key name, identity source, client (never message bodies)
 *   <JkActivityEmpty onManageKeys />        D29
 *   <JkActivityFilterSheet … />             M27
 */
import { useEffect, useState } from "react"
import { Copy, SlidersHorizontal, ChevronDown, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { toast } from "@/lib/toast"
import JkSectionLabel from "../jk-app/jkSectionLabel"
import {
  NONE, fmtCost, fmtFeedTime, fmtRate, fmtSeconds, fmtStamp, fmtTokenSplit, fmtTokens, fmtWhen,
} from "@/lib/agentActivity/format"
import {
  agentDisplayName, allUnknown, canScopeKey, identityNote, identitySourceLabel, isUnknownAgent, keyNameLabel,
} from "@/lib/agentActivity/identity"
import {
  JkActivityStatus, JkMeter, JkModelIcon, JkRunsMeter, JkStatFigure, modelTone,
  type ActivityFilters, type ActivityItem, type ActivitySummary,
} from "./jkActivityParts"
import {
  MODEL_FIX_CLI, MODEL_FIX_FLAGS, NAME_THE_MODEL, isUnknownModel, modelDisplayName, modelFix, modelSourceLabel,
  showUnknownModelBanner, unknownModelBannerText, unknownModelCount,
} from "@/lib/agentActivity/modelIdentity"

const enter = (i: number) => ({ "--i": i } as React.CSSProperties)
const mono = "font-mono"

function Corner({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-[9.5px] uppercase leading-[13px] text-subtle-foreground">{children}</span>
}

// ---------------------------------------------------------------- headline figures

export function JkActivityStats({ summary }: { summary: ActivitySummary }) {
  const t = summary.totals
  const count = t?.count ?? 0
  const items = [
    { label: "Actions", value: String(count), sub: `${summary.today} today`, subM: `${summary.today} today` },
    { label: "Success rate", value: t ? fmtRate(t.successRate) : NONE, sub: `${t?.error ?? 0} failed`, subM: `${t?.error ?? 0} failed` },
    { label: "Average time", value: fmtSeconds(t?.avgLatencyMs), sub: "per action, start to finish", subM: "per action" },
    {
      label: "Tokens",
      value: fmtTokens((t?.inputTokens ?? 0) + (t?.outputTokens ?? 0), (t?.tokenRows ?? 0) > 0, "headline"),
      sub: t && t.costRows > 0 ? `${fmtCost(t.costUsd, true)} where the agent reported cost` : "no cost reported",
      subM: t && t.costRows > 0 ? `${fmtCost(t.costUsd, true)} reported` : "no cost reported",
    },
  ]
  return (
    <div className="grid grid-cols-2 gap-y-6 md:grid-cols-4 md:gap-y-0">
      {items.map((it, i) => (
        <div key={it.label} className={cn("jk-enter min-w-0", i % 2 === 1 && "border-l border-border pl-3 max-md:pl-[11px]", i > 0 && "md:-ml-6 md:border-l md:border-border md:pl-6", i === 2 && "max-md:border-l-0 max-md:pl-0")} style={enter(i)}>
          <div className="hidden md:block"><JkStatFigure label={it.label} value={it.value} sub={it.sub} /></div>
          <div className="md:hidden"><JkStatFigure label={it.label} value={it.value} sub={it.subM} size="md" /></div>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------- model identity

/** What a row's unknown-model nudge does: open that key's identity, or Settings > CLI keys. */
export type ModelFixHandlers = { onScopeKey: (keyId: string) => void; onManageKeys: () => void }

/** The model id, or a muted "Unknown model". */
function JkModelName({ model, className }: { model: string; className?: string }) {
  return <span className={cn(isUnknownModel(model) ? "font-sans text-muted-foreground" : "text-foreground", className)}>{modelDisplayName(model)}</span>
}

/**
 * "Name the model": a small link to the fix. Inside a clickable row it is a span (no nested
 * buttons); keyboard users reach the same fix from the details panel.
 */
function JkNameModelLink({ onClick, nested, label = NAME_THE_MODEL, className }: { onClick: () => void; nested?: boolean; label?: string; className?: string }) {
  const cls = cn("text-left text-[11.5px] leading-[14px] text-muted-foreground underline decoration-border-strong underline-offset-[3px] transition-colors hover:text-foreground", className)
  if (nested) {
    return <span role="link" className={cls} onClick={(e) => { e.stopPropagation(); onClick() }}>{label}</span>
  }
  return <button type="button" onClick={onClick} className={cls}>{label}</button>
}

const runFix = (r: { model: string; keyId?: string; keyName?: string }, h: ModelFixHandlers) => () => {
  const fix = modelFix(r)
  if (fix.kind === "key") h.onScopeKey(fix.keyId)
  else h.onManageKeys()
}

/** Shown above the feed when a meaningful share of rows has no model. */
export function JkActivityUnknownModelBanner({ summary, onManageKeys }: { summary: ActivitySummary; onManageKeys: () => void }) {
  const unknown = unknownModelCount(summary.byModel)
  if (!showUnknownModelBanner(unknown, summary.total)) return null
  return (
    <div className="jk-enter flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-[16px] border border-input bg-card px-4 py-[14px]" style={enter(3)}>
      <p className="flex min-w-0 max-w-[620px] items-center gap-2.5 text-[13.5px] leading-[19px] text-muted-foreground">
        <JkModelIcon model={null} className="size-4 shrink-0" />
        <span>{unknownModelBannerText(unknown)}</span>
      </p>
      <Button variant="outline" className="h-9 shrink-0 rounded-full px-5 text-[13px]" onClick={onManageKeys}>{NAME_THE_MODEL}</Button>
    </div>
  )
}

// ---------------------------------------------------------------- by model

export function JkActivityByModel({ summary, onManageKeys }: { summary: ActivitySummary; onManageKeys: () => void }) {
  const rows = summary.byModel
  return (
    <section>
      <div className="flex items-center justify-between gap-4">
        <JkSectionLabel as="h2">By model</JkSectionLabel>
        <Corner><span className="md:hidden">Success rate</span><span className="max-md:hidden">Success rate, 0 to 100%</span></Corner>
      </div>

      {/* Desktop table (D27) */}
      <div className="max-md:hidden">
        <div className="mt-[21px] grid grid-cols-[minmax(120px,1fr)_56px_minmax(150px,178px)_62px_62px_46px] border-b border-border pb-[9px] font-mono text-[9.5px] font-medium leading-[13px] text-subtle-foreground">
          <span>MODEL</span><span>RUNS</span><span>SUCCESS</span><span>AVG TIME</span><span>TOKENS</span><span className="text-right">COST</span>
        </div>
        {rows.map((m, i) => (
          <div key={`${m.model}-${m.provider}`} className="jk-enter grid h-14 grid-cols-[minmax(120px,1fr)_56px_minmax(150px,178px)_62px_62px_46px] items-center border-b border-border" style={enter(i)}>
            <div className="flex min-w-0 items-center gap-2.5 pr-3">
              <JkModelIcon model={m.model} provider={m.provider} className="size-[18px]" />
              <div className="min-w-0">
                <p className="truncate font-mono text-[13px] font-medium leading-4"><JkModelName model={m.model} /></p>
                {isUnknownModel(m.model)
                  ? <JkNameModelLink onClick={onManageKeys} className="mt-[3px] block text-[12px]" />
                  : <p className="mt-[3px] truncate text-[12px] leading-[14px] text-subtle-foreground">{m.provider}</p>}
              </div>
            </div>
            <span className="font-mono text-[13px] text-foreground">{m.count}</span>
            <span className="flex items-center gap-3 pr-2">
              <JkMeter value={m.successRate} tone={modelTone(m.model, i)} className="min-w-0 flex-1" />
              <span className="w-[46px] shrink-0 font-mono text-[13px] font-medium text-foreground">{fmtRate(m.successRate)}</span>
            </span>
            <span className="font-mono text-[13px] text-muted-foreground">{fmtSeconds(m.avgLatencyMs)}</span>
            <span className="font-mono text-[13px] text-muted-foreground">{fmtTokens(m.inputTokens + m.outputTokens, m.tokenRows > 0)}</span>
            <span className="text-right font-mono text-[13px] text-muted-foreground">{fmtCost(m.costUsd, m.costRows > 0)}</span>
          </div>
        ))}
      </div>

      {/* Phone list (M26) */}
      <ul className="mt-[17px] flex flex-col gap-[22px] md:hidden">
        {rows.map((m, i) => (
          <li key={`${m.model}-${m.provider}`} className="jk-enter" style={enter(i)}>
            <div className="flex items-center justify-between gap-3 font-mono text-[13.5px] font-medium text-foreground">
              <span className="flex min-w-0 items-center gap-2"><JkModelIcon model={m.model} provider={m.provider} /><JkModelName model={m.model} className="truncate" /></span><span className="shrink-0">{fmtRate(m.successRate)}</span>
            </div>
            <JkMeter value={m.successRate} tone={modelTone(m.model, i)} className="mt-[9px]" />
            {isUnknownModel(m.model) && <JkNameModelLink onClick={onManageKeys} className="mt-[7px] block text-[12.5px]" />}
            <p className="mt-[7px] text-[12.5px] leading-[15px] text-subtle-foreground">
              {[isUnknownModel(m.model) ? null : m.provider, `${m.count} runs`, fmtSeconds(m.avgLatencyMs), ...(m.costRows > 0 ? [fmtCost(m.costUsd, true)] : [])].filter(Boolean).join(" · ")}
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}

// ---------------------------------------------------------------- by agent

export function JkActivityByAgent({ summary, onScopeKeys }: { summary: ActivitySummary; onScopeKeys: () => void }) {
  return (
    <section>
      <JkSectionLabel as="h2">By agent</JkSectionLabel>
      <div className="mt-[13px] grid grid-cols-2 gap-3 md:grid-cols-[repeat(auto-fill,minmax(132px,1fr))]">
        {summary.byAgent.map((a, i) => {
          const unknown = isUnknownAgent(a.agentName)
          return (
            <div key={a.agentName} className="jk-enter relative min-w-0 rounded-[16px] border border-input bg-card px-[14px] pb-[13px] pt-[13px] md:pb-[15px] md:pl-4 md:pr-2" style={enter(i)}>
              <p className={cn("truncate text-[15px] font-medium leading-[18px] max-md:pr-14", unknown ? "text-muted-foreground" : "text-foreground")}>{agentDisplayName(a.agentName)}</p>
              <span className="absolute right-[14px] top-[15px] font-mono text-[11px] text-subtle-foreground md:hidden">{a.count} runs</span>
              <p className="mt-[5px] text-[22px] font-medium leading-[26px] tracking-[-0.4px] text-foreground">{fmtRate(a.successRate)}</p>
              <p className="mt-[7px] font-mono text-[11px] leading-[14px] text-subtle-foreground max-md:hidden">{a.count} runs</p>
              <p className="mt-1 flex min-w-0 items-center gap-1.5 font-mono text-[11px] leading-[14px] text-muted-foreground max-md:mt-[7px] max-md:text-[10.5px]">
                <JkModelIcon model={a.usualModel} className="size-3.5" /><JkModelName model={a.usualModel} className="truncate text-muted-foreground" />
              </p>
              {unknown ? (
                // Nudge: an unknown agent gets a name once its key is tied to one.
                <button type="button" onClick={onScopeKeys}
                  className="mt-1 text-left text-[11.5px] leading-4 text-muted-foreground underline decoration-border-strong underline-offset-[3px] transition-colors hover:text-foreground max-md:mt-[7px]">
                  Scope a key to<br />name this agent
                </button>
              ) : isUnknownModel(a.usualModel) ? (
                <JkNameModelLink onClick={onScopeKeys} className="mt-1 block" />
              ) : null}
            </div>
          )
        })}
      </div>
    </section>
  )
}

/** Shown above the feed when no row names its agent yet. */
export function JkActivityUnknownBanner({ summary, onScopeKeys }: { summary: ActivitySummary; onScopeKeys: () => void }) {
  if (!allUnknown(summary.byAgent)) return null
  return (
    <div className="jk-enter flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-[16px] border border-input bg-card px-4 py-[14px]" style={enter(3)}>
      <p className="min-w-0 max-w-[560px] text-[13.5px] leading-[19px] text-muted-foreground">
        None of these actions name their agent. Tie each key to an agent and its activity shows who did what.
      </p>
      <Button variant="outline" className="h-9 shrink-0 rounded-full px-5 text-[13px]" onClick={onScopeKeys}>Scope a key</Button>
    </div>
  )
}

// ---------------------------------------------------------------- by action

export function JkActivityByAction({ summary }: { summary: ActivitySummary }) {
  const rows = summary.byActionType
  const most = Math.max(1, ...rows.map((r) => r.count))
  return (
    <section>
      <div className="flex items-center justify-between gap-4">
        <JkSectionLabel as="h2">By action</JkSectionLabel>
        <Corner><span className="md:hidden">Best model</span><span className="max-md:hidden">Runs</span></Corner>
      </div>
      <ul className="mt-[19px] flex flex-col gap-[18px] md:gap-[10px]">
        {rows.map((a, i) => (
          <li key={a.actionType} className="jk-enter" style={enter(i)}>
            <div className="flex items-baseline justify-between gap-3 font-mono text-[12.5px] font-medium leading-4 text-foreground">
              <span className="truncate">{a.actionType}</span>
              <span className="shrink-0 max-md:font-normal max-md:text-muted-foreground">{a.count}</span>
            </div>
            <div className="mt-[7px]"><JkRunsMeter share={a.count / most} count={a.count} failed={a.error} /></div>
            <div className="mt-[5px] flex items-center justify-between gap-3 text-[12px] leading-[14px]">
              <span className="flex min-w-0 items-center gap-1.5 text-subtle-foreground">
                {a.best && <JkModelIcon model={a.best.model} className="size-3.5" />}
                <span className="truncate max-md:hidden">{a.best ? `Best: ${modelDisplayName(a.best.model)}, ${fmtRate(a.best.successRate)}` : ""}</span>
                <span className="truncate md:hidden">{[a.best ? `${modelDisplayName(a.best.model)} · ${fmtRate(a.best.successRate)}` : null, a.error ? `${a.error} failed` : null].filter(Boolean).join(" · ")}</span>
              </span>
              {a.error > 0 && <span className="shrink-0 text-destructive max-md:hidden">{a.error} failed</span>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

// ---------------------------------------------------------------- feed

const targetOf = (r: ActivityItem) => r.targetLabel ?? r.target ?? NONE
const FEED_COLS = "grid-cols-[60px_220px_184px_172px_minmax(0,172fr)_minmax(0,160fr)_36px_110px]"

/** The agent's name; "unknown" reads as a muted "Unknown". */
function JkAgentName({ name, className }: { name: string; className?: string }) {
  return <span className={cn("font-medium", isUnknownAgent(name) ? "text-muted-foreground" : "text-foreground", className)}>{agentDisplayName(name)}</span>
}

export function JkActivityFeedTable({ items, selectedId, onOpen, fix }: { items: ActivityItem[]; selectedId?: string; onOpen: (r: ActivityItem) => void; fix: ModelFixHandlers }) {
  const now = Date.now()
  return (
    <div role="table" aria-label="Agent activity" className="-mx-8">
      <div role="row" className={cn("grid border-b border-border px-8 pb-[11px] font-mono text-[10px] font-medium leading-[13px] text-subtle-foreground", FEED_COLS)}>
        {["TIME", "AGENT", "MODEL", "ACTION", "TARGET", "SUMMARY"].map((h) => <span key={h} role="columnheader">{h}</span>)}
        <span role="columnheader" className="text-right">TOOK</span>
        <span role="columnheader" className="pl-6">STATUS</span>
      </div>
      {items.map((r, i) => {
        const ok = r.status === "success"
        const on = selectedId === r.id
        return (
          <button key={r.id} type="button" role="row" onClick={() => onOpen(r)}
            className={cn("jk-enter relative grid h-14 w-full items-center border-b border-border px-8 text-left transition-colors hover:bg-muted", FEED_COLS, on && "bg-muted")}
            style={enter(Math.min(i, 12))}>
            {on && <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-bar-4" />}
            <span role="cell" className="font-mono text-[12px] text-muted-foreground">{fmtFeedTime(r.timestamp, now)}</span>
            <span role="cell" className="min-w-0 pr-3">
              <JkAgentName name={r.agentName} className="block truncate text-[14px] leading-[18px]" />
              <span className="mt-[3px] block truncate text-[11.5px] leading-[14px] text-subtle-foreground">{identityNote(r)}</span>
            </span>
            <span role="cell" className="flex min-w-0 items-center gap-2 pr-3">
              <JkModelIcon model={r.model} provider={r.provider} />
              <span className="min-w-0">
                <JkModelName model={r.model} className="block truncate font-mono text-[12.5px] leading-4" />
                {isUnknownModel(r.model)
                  ? <JkNameModelLink nested onClick={runFix(r, fix)} className="mt-0.5 block truncate" />
                  : <span className="mt-0.5 block truncate text-[11.5px] leading-[14px] text-subtle-foreground">{r.provider}</span>}
              </span>
            </span>
            <span role="cell" className="truncate pr-3 font-mono text-[12px] text-muted-foreground">{r.actionType}</span>
            <span role="cell" className="truncate pr-4 text-[13.5px] text-foreground">{targetOf(r)}</span>
            <span role="cell" className={cn("truncate pr-1 text-[13.5px]", ok ? "text-muted-foreground" : "text-destructive")}>{r.summary}</span>
            <span role="cell" className="text-right font-mono text-[12px] text-muted-foreground">{fmtSeconds(r.latencyMs)}</span>
            <span role="cell" className="pl-6"><JkActivityStatus ok={ok} /></span>
          </button>
        )
      })}
    </div>
  )
}

export function JkActivityFeedCards({ items, onOpen, fix }: { items: ActivityItem[]; onOpen: (r: ActivityItem) => void; fix: ModelFixHandlers }) {
  const now = Date.now()
  return (
    <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {items.map((r, i) => {
        const ok = r.status === "success"
        return (
          <li key={r.id} className="jk-enter min-w-0" style={enter(Math.min(i, 12))}>
            <button type="button" onClick={() => onOpen(r)}
              className="block w-full rounded-[16px] border border-input bg-card px-4 pb-[15px] pt-[15px] text-left transition-colors hover:bg-muted">
              <span className="flex items-center justify-between gap-3">
                <JkAgentName name={r.agentName} className="truncate text-[14px] leading-[18px]" />
                <JkActivityStatus ok={ok} size="sm" className="shrink-0" />
              </span>
              <span className="mt-[3px] block truncate text-[11.5px] leading-[14px] text-subtle-foreground">{identityNote(r)}</span>
              <span className="mt-[10px] block truncate text-[15px] font-medium leading-[18px] text-foreground">{targetOf(r)}</span>
              <span className={cn("mt-[5px] block truncate text-[13.5px] leading-4", ok ? "text-muted-foreground" : "text-destructive")}>{r.summary}</span>
              <span className="mt-[11px] flex min-w-0 items-center gap-1.5 font-mono text-[11px] leading-[14px] text-subtle-foreground">
                <JkModelIcon model={r.model} provider={r.provider} className="size-3.5" />
                <span className="truncate">{[modelDisplayName(r.model), r.actionType, fmtFeedTime(r.timestamp, now)].join(" · ")}</span>
              </span>
              {isUnknownModel(r.model) && <JkNameModelLink nested onClick={runFix(r, fix)} className="mt-[7px] inline-block" />}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

// ---------------------------------------------------------------- details (D28)

function detailsText(r: ActivityItem): string {
  return [
    `Action: ${r.actionType}`,
    `Status: ${r.status === "success" ? "Done" : "Failed"}`,
    ...(r.errorMessage ? [`Error: ${r.errorMessage}`] : []),
    `Agent: ${agentDisplayName(r.agentName)} (${identityNote(r)})`,
    `Key name: ${keyNameLabel(r)}`,
    `Identity: ${identitySourceLabel(r)}`,
    ...(r.client ? [`Client: ${r.client}`] : []),
    `Model: ${modelDisplayName(r.model)}`,
    `Model source: ${modelSourceLabel(r)}`,
    `Provider: ${r.provider}`,
    `Target: ${targetOf(r)}`,
    `Summary: ${r.summary}`,
    `Started: ${fmtStamp(r.timestamp)}`,
    `Took: ${fmtSeconds(r.latencyMs)}`,
    `Tokens: ${fmtTokenSplit(r.inputTokens, r.outputTokens)}`,
    `Cost: ${fmtCost(r.costUsd ?? 0, typeof r.costUsd === "number")}`,
  ].join("\n")
}

export function JkActivityDetails({ item, onClose, onOpenJob, onScopeKey, onManageKeys }: {
  item: ActivityItem | null
  onClose: () => void
  onOpenJob: (jobId: string) => void
  /** Settings > CLI keys with this key's identity open. */
  onScopeKey: (keyId: string) => void
  /** Settings > CLI keys. */
  onManageKeys: () => void
}) {
  // Keep the last row on screen while the panel slides out.
  const [shown, setShown] = useState<ActivityItem | null>(item)
  useEffect(() => { if (item) setShown(item) }, [item])
  const r = item ?? shown
  const ok = r?.status === "success"
  const noModel = r ? isUnknownModel(r.model) : false
  const fix = r ? modelFix(r) : { kind: "none" as const }
  // The model nudge replaces the agent-scope nudge: it fixes both when the key gets an identity.
  const scope = r && !noModel ? canScopeKey(r) : false
  const rows: { k: string; v: string; mono?: boolean; icon?: boolean }[] = r ? [
    { k: "Key name", v: keyNameLabel(r), mono: !!r.keyScoped && !!r.keyName },
    { k: "Identity", v: identitySourceLabel(r) },
    ...(r.client ? [{ k: "Client", v: r.client, mono: true }] : []),
    { k: "Model", v: noModel ? modelDisplayName(r.model) : r.provider && r.provider !== "unknown" ? `${r.model} · ${r.provider}` : r.model, mono: !noModel, icon: true },
    { k: "Model from", v: modelSourceLabel(r) },
    { k: "Target", v: targetOf(r) },
    { k: "Started", v: fmtStamp(r.timestamp), mono: true },
    { k: "Tokens", v: fmtTokenSplit(r.inputTokens, r.outputTokens), mono: true },
    { k: "Cost", v: fmtCost(r.costUsd ?? 0, typeof r.costUsd === "number"), mono: true },
  ] : []
  const copy = async () => {
    if (!r) return
    try { await navigator.clipboard.writeText(detailsText(r)); toast.success("Copied", { description: "Details copied", duration: 2000 }) }
    catch { toast.error("Copy failed", { description: "Could not copy to the clipboard", duration: 2000 }) }
  }
  return (
    <Sheet open={item !== null} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto border-l border-input bg-card p-0 shadow-none sm:max-w-[440px] [&>button:last-child]:hidden">
        {r && (
          <div className="px-5 pb-10 pt-[30px] sm:px-8">
            <div className="flex items-start justify-between">
              <JkSectionLabel>Action</JkSectionLabel>
              <button type="button" onClick={onClose} aria-label="Close" className="-mr-2 -mt-2.5 flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground">
                <X className="size-[18px]" strokeWidth={1.6} />
              </button>
            </div>
            <SheetTitle className="mt-[7px] break-all font-mono text-[22px] font-medium leading-[28px] text-foreground">{r.actionType}</SheetTitle>
            <SheetDescription asChild>
              <div className="mt-[11px] flex flex-wrap items-center gap-x-4 gap-y-1 text-[13.5px] leading-4 text-muted-foreground">
                <JkActivityStatus ok={ok} />
                <span>{agentDisplayName(r.agentName)} · {fmtWhen(r.timestamp)} · took {fmtSeconds(r.latencyMs)}</span>
              </div>
            </SheetDescription>
            {!ok && (
              <div className="mt-[22px] rounded-[16px] border border-destructive/45 bg-destructive/[0.08] px-[18px] pb-[18px] pt-[17px]">
                <p className="font-mono text-[10px] font-medium uppercase leading-[13px] tracking-[1.6px] text-destructive">Error</p>
                <p className="mt-[11px] text-[13.5px] leading-[19px] text-muted-foreground">{r.errorMessage ?? "The agent did not say what went wrong."}</p>
              </div>
            )}
            <dl className="mt-7">
              {rows.map((row) => (
                <div key={row.k} className="grid grid-cols-[118px_minmax(0,1fr)] items-baseline border-b border-border py-[10px] leading-5 first:pt-0">
                  <dt className="font-mono text-[10px] font-medium uppercase tracking-[1.6px] text-subtle-foreground">{row.k}</dt>
                  <dd className={cn("break-words text-foreground", row.mono ? "font-mono text-[13px]" : "text-[14px]", row.icon && "flex min-w-0 items-center gap-2")}>
                    {row.icon && <JkModelIcon model={r.model} provider={r.provider} />}
                    {row.icon ? <span className="min-w-0 break-words">{row.v}</span> : row.v}
                  </dd>
                </div>
              ))}
            </dl>
            {noModel && (
              <div className="mt-[23px] rounded-[16px] border border-input px-4 pb-[14px] pt-[13px] text-[13px] leading-[19px] text-muted-foreground">
                <p>No model was sent with this action. Tie the key to an agent and model, and every action it makes names the model.</p>
                <code className="mt-[10px] block break-words rounded-[10px] bg-muted px-3 py-2 font-mono text-[12px] leading-[17px] text-foreground">{MODEL_FIX_CLI}</code>
                <p className="mt-[8px] font-mono text-[11.5px] leading-4 text-subtle-foreground">{MODEL_FIX_FLAGS}</p>
              </div>
            )}
            {scope && (
              <p className="mt-[23px] rounded-[16px] border border-input px-4 py-[13px] text-[13px] leading-[19px] text-muted-foreground">
                Scope this key to an agent so its name<br className="max-sm:hidden" /> comes from the key, not the request.
              </p>
            )}
            <div className={cn("flex flex-wrap gap-3", scope || noModel ? "mt-5" : "mt-[39px]")}>
              {r.targetJobId && (
                <Button className="h-11 rounded-full px-[25px] text-[14px]" onClick={() => onOpenJob(r.targetJobId!)}>Open the job</Button>
              )}
              {fix.kind === "key" ? (
                <Button variant="outline" className="h-11 rounded-full px-[26px] text-[14px]" onClick={() => onScopeKey(fix.keyId)}>Add a model to this key</Button>
              ) : fix.kind === "keys" ? (
                <Button variant="outline" className="h-11 rounded-full px-[26px] text-[14px]" onClick={onManageKeys}>Open CLI keys</Button>
              ) : scope ? (
                <Button variant="outline" className="h-11 rounded-full px-[28px] text-[14px]" onClick={() => onScopeKey(r.keyId!)}>Scope this key</Button>
              ) : (
                <Button variant="outline" className="h-11 rounded-full px-[26px] text-[14px]" onClick={copy}>Copy details</Button>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

// ---------------------------------------------------------------- empty (D29)

const LOG_EXAMPLE = [
  "jk --agent Summit --model claude-opus-5-5 activity log \\",
  '  --type email_sent --target "Recruiter, Linear" --summary "Follow-up sent"',
]

export function JkActivityEmpty({ onManageKeys }: { onManageKeys: () => void }) {
  const copy = async () => {
    try { await navigator.clipboard.writeText(LOG_EXAMPLE.join("\n")); toast.success("Copied", { description: "Command copied", duration: 2000 }) }
    catch { toast.error("Copy failed", { description: "Could not copy to the clipboard", duration: 2000 }) }
  }
  return (
    <div className="max-w-[720px]">
      <h2 className="jk-enter text-[22px] font-medium leading-[26px] tracking-[-0.4px] text-foreground" style={enter(2)}>No agent activity yet</h2>
      <p className="jk-enter mt-[13px] max-w-[540px] text-[15px] leading-[22px] text-muted-foreground" style={enter(3)}>
        When an agent works on your account with a CLI key, each action shows up here with the model behind it, whether it worked, and how long it took.
      </p>
      <p className="jk-enter mt-6 text-[13.5px] leading-[19px] text-subtle-foreground" style={enter(4)}>
        Anything an agent does through jk is logged on its own. For work done outside JobKompass, like an email sent from Gmail, have it run:
      </p>
      <div className="jk-enter relative mt-[13px] rounded-[16px] border border-input bg-card py-[17px] pl-5 pr-14" style={enter(5)}>
        <pre className="overflow-x-auto font-mono text-[13px] leading-6 text-foreground">{LOG_EXAMPLE.join("\n")}</pre>
        <button type="button" onClick={copy} aria-label="Copy command" className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground">
          <Copy className="size-4" strokeWidth={1.6} />
        </button>
      </div>
      <Button variant="outline" className="jk-enter mt-12 h-10 rounded-full px-[23px] text-[13.5px]" style={enter(6)} onClick={onManageKeys}>Manage CLI keys</Button>
    </div>
  )
}

// ---------------------------------------------------------------- phone filters (M26 row + M27 sheet)

export function filterSummary(f: ActivityFilters): string {
  const parts = [f.agent ? agentDisplayName(f.agent) : undefined, f.model, f.actionType, f.status === "success" ? "Done" : f.status === "error" ? "Failed" : undefined].filter(Boolean)
  return parts.length ? parts.join(", ") : "All agents and models"
}

export function JkActivityFilterButton({ filters, onClick }: { filters: ActivityFilters; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="flex h-10 w-full items-center gap-3 rounded-full border border-input bg-card pl-4 pr-4 text-left text-[14px] text-foreground transition-colors hover:bg-accent">
      <SlidersHorizontal aria-hidden className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.6} />
      <span className="min-w-0 flex-1 truncate">{filterSummary(filters)}</span>
      <ChevronDown aria-hidden className="size-4 shrink-0 text-subtle-foreground" strokeWidth={1.6} />
    </button>
  )
}

function Chip({ on, children, mono: isMono, icon, onClick }: { on: boolean; children: React.ReactNode; mono?: boolean; icon?: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick}
      className={cn("inline-flex h-[34px] max-w-full items-center gap-[7px] rounded-full border px-[14px] transition-colors", icon && "pl-[11px]",
        isMono ? "font-mono text-[12.5px]" : "text-[13.5px]",
        on ? "border-border-strong bg-accent font-medium text-foreground" : "border-input text-muted-foreground hover:text-foreground")}>
      {icon}
      <span className="truncate">{children}</span>
    </button>
  )
}

export function JkActivityFilterSheet({ open, onOpenChange, options, value, onApply, onDraftChange, count }: {
  open: boolean
  onOpenChange: (o: boolean) => void
  options: ActivitySummary["options"]
  value: ActivityFilters
  onApply: (f: ActivityFilters) => void
  /** Called with the pending choice so the parent can count it live. */
  onDraftChange: (f: ActivityFilters) => void
  /** Rows matching the pending choice, or null while loading. */
  count: number | null
}) {
  const [draft, setDraft] = useState<ActivityFilters>(value)
  useEffect(() => { if (open) setDraft(value) }, [open, value])
  useEffect(() => { onDraftChange(draft) }, [draft, onDraftChange])
  const n = count
  const groups: { key: keyof ActivityFilters; label: string; mono?: boolean; opts: { v: string; l: string }[] }[] = [
    { key: "agent", label: "Agent", opts: options.agents.map((a) => ({ v: a, l: agentDisplayName(a) })) },
    { key: "model", label: "Model", mono: true, opts: options.models.map((m) => ({ v: m, l: modelDisplayName(m) })) },
    { key: "status", label: "Status", opts: [{ v: "success", l: "Done" }, { v: "error", l: "Failed" }] },
  ]
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[78dvh] gap-0 rounded-t-[24px] border border-b-0 border-input bg-card p-0 shadow-none [&>button:last-child]:hidden">
        <div aria-hidden className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-border-strong" />
        <div className="flex shrink-0 items-center justify-between px-5 pt-[18px]">
          <SheetTitle className="text-[20px] font-semibold leading-6 text-foreground">Filter activity</SheetTitle>
          <button type="button" onClick={() => setDraft({})} className="text-[14px] font-medium text-muted-foreground hover:text-foreground">Clear</button>
        </div>
        <SheetDescription className="sr-only">Choose which agents, models, statuses and actions to show</SheetDescription>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 pt-[26px]">
          {groups.map((g) => (
            <fieldset key={g.key} className="mb-6">
              <legend className="font-mono text-[10px] font-medium uppercase leading-[13px] tracking-[1.6px] text-subtle-foreground">{g.label}</legend>
              <div className="mt-[11px] flex flex-wrap gap-2">
                <Chip on={!draft[g.key]} onClick={() => setDraft({ ...draft, [g.key]: undefined })}>All</Chip>
                {g.opts.map((o) => (
                  <Chip key={o.v} mono={g.mono} icon={g.key === "model" ? <JkModelIcon model={o.v} className="size-3.5" /> : undefined} on={draft[g.key] === o.v} onClick={() => setDraft({ ...draft, [g.key]: o.v })}>{o.l}</Chip>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
        <div className="shrink-0 px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-2">
          <Button className="h-12 w-full rounded-full text-[16px]" onClick={() => { onApply(draft); onOpenChange(false) }}>
            {n === null ? "Show actions" : `Show ${n} action${n === 1 ? "" : "s"}`}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
