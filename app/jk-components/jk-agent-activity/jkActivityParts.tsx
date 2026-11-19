'use client'

/**
 * Small pieces shared by the Agent activity page (D27-D29, M26-M27):
 *
 *   <JkActivityStatus ok size?="md"|"sm" />           ring + dot (done) or ring + x (failed), with the word
 *   <JkMeter value={0..1} tone="var(--bar-1)" />      6px bar on --track, full 0 to 100% scale
 *   <JkRunsMeter share ok failed />                   By action bar: runs share in blue, failed share in red after a 2px gap
 *   <JkStatFigure label value sub size?="lg"|"md" />  headline figure (ACTIONS / 412 / 38 today)
 *   <JkFilterPill label value options onChange />     desktop filter: "Agent  All ⌄" dropdown
 *   <JkModelIcon model provider? />                   the landing's agent mark for a model, neutral when unknown
 *
 * Types for the data come straight from the Convex queries (convex/agent/activity.ts).
 */
import { ChevronDown } from "lucide-react"
import type { FunctionReturnType } from "convex/server"
import type { api } from "@/convex/_generated/api"
import { cn } from "@/lib/utils"
import { modelMark } from "@/lib/agentActivity/modelMark"
import JkAgentMark from "../jkAgentMark"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export type ActivitySummary = Extract<NonNullable<FunctionReturnType<typeof api.agent.activity.summaryMine>>, { hasAny: true }>
export type ActivityItem = FunctionReturnType<typeof api.agent.activity.listMine>["page"][number]

export type ActivityFilters = { agent?: string; model?: string; actionType?: string; status?: "success" | "error" }

/** Model colour: the logo bars in order of use; "unknown" stays neutral. */
export function modelTone(model: string, index: number): string {
  if (model === "unknown") return "var(--subtle-foreground)"
  return ["var(--bar-1)", "var(--bar-2)", "var(--bar-3)", "var(--bar-4)"][index % 4]
}

/** The model's agent mark, always in colour so it reads at a glance. Default 16px. */
export function JkModelIcon({ model, provider, className }: { model?: string | null; provider?: string | null; className?: string }) {
  return <JkAgentMark mark={modelMark(model, provider)} colour className={cn("size-4", className)} />
}

export function JkActivityStatus({ ok, size = "md", className }: { ok: boolean; size?: "md" | "sm"; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-foreground", size === "md" ? "text-[13.5px]" : "text-[13px]", className)}>
      <svg aria-hidden viewBox="0 0 12 12" className="size-3 shrink-0" fill="none" strokeLinecap="round">
        {ok ? (
          <>
            <circle cx="6" cy="6" r="4.5" stroke="var(--ok)" strokeWidth="1.5" />
            <circle cx="6" cy="6" r="1.8" fill="var(--ok)" />
          </>
        ) : (
          <>
            <circle cx="6" cy="6" r="4.5" stroke="var(--destructive)" strokeWidth="1.5" />
            <path d="M4.2 4.2 7.8 7.8M7.8 4.2 4.2 7.8" stroke="var(--destructive)" strokeWidth="1.2" />
          </>
        )}
      </svg>
      {ok ? "Done" : "Failed"}
    </span>
  )
}

export function JkMeter({ value, tone, className }: { value: number; tone: string; className?: string }) {
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-track", className)}>
      <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: tone }} />
    </div>
  )
}

/** share = runs / most runs of any action; the failed part sits after a 2px gap, inside that share. */
export function JkRunsMeter({ share, count, failed }: { share: number; count: number; failed: number }) {
  const okPart = count ? (share * (count - failed)) / count : 0
  const errPart = share - okPart
  return (
    <div className="relative h-1.5 w-full rounded-full bg-track">
      <div className="absolute inset-y-0 left-0 rounded-full bg-bar-3 transition-[width] duration-700" style={{ width: `${okPart * 100}%` }} />
      {failed > 0 && (
        <div className="absolute inset-y-0 rounded-full bg-destructive"
          style={{ left: `calc(${okPart * 100}% + 2px)`, width: `max(4px, calc(${errPart * 100}% - 2px))` }} />
      )}
    </div>
  )
}

export function JkStatFigure({ label, value, sub, size = "lg" }: { label: string; value: string; sub: string; size?: "lg" | "md" }) {
  return (
    <div className="min-w-0">
      <p className="font-mono text-[10px] font-medium uppercase leading-[13px] tracking-[1.6px] text-subtle-foreground">{label}</p>
      <p className={cn("font-medium text-foreground", size === "lg" ? "mt-[9px] text-[44px] leading-[52px] tracking-[-1px]" : "mt-1.5 text-[34px] leading-10 tracking-[-0.8px]")}>{value}</p>
      <p className={cn("truncate text-[13px] leading-4 text-muted-foreground", size === "lg" ? "mt-[9px]" : "mt-1.5")}>{sub}</p>
    </div>
  )
}

export function JkFilterPill({ label, value, options, onChange, mono, icon }: {
  label: string
  value: string | undefined
  options: { value: string; label: string }[]
  onChange: (v: string | undefined) => void
  mono?: boolean
  /** An icon before each option and the chosen value (the Model filter shows agent marks). */
  icon?: (value: string) => React.ReactNode
}) {
  const current = options.find((o) => o.value === value)?.label ?? "All"
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button"
          className={cn("flex h-9 max-w-[260px] items-center gap-1.5 rounded-full border border-input pl-4 pr-3 text-[13px] outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50",
            value ? "bg-accent" : "bg-card")}>
          <span className="text-subtle-foreground">{label}</span>
          {icon && value && <span className="ml-0.5 flex shrink-0">{icon(value)}</span>}
          <span className={cn("truncate font-medium text-foreground", mono && value && "font-mono text-[12px]")}>{current}</span>
          <ChevronDown aria-hidden className="ml-1.5 size-4 shrink-0 text-subtle-foreground" strokeWidth={1.6} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-[320px] min-w-[180px] overflow-y-auto">
        <DropdownMenuRadioGroup value={value ?? ""} onValueChange={(v) => onChange(v || undefined)}>
          <DropdownMenuRadioItem value="">All</DropdownMenuRadioItem>
          {options.map((o) => (
            <DropdownMenuRadioItem key={o.value} value={o.value} className={cn("gap-2", mono && "font-mono text-[12.5px]")}>{icon?.(o.value)}{o.label}</DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
