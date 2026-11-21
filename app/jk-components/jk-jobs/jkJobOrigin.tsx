'use client'

/**
 * My Jobs "Source" and "Added by" cells (D03 table). Each is one icon with a hover card
 * that explains it: where the job came from (Gmail, Outlook, a site online) and which
 * agent added or changed it, with what it did and when. A blank cell still explains itself.
 */
import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import { Globe } from "lucide-react"
import { cn } from "@/lib/utils"
import type { JobSource } from "@/lib/jkJobSource"
import { modelMark } from "@/lib/agentActivity/modelMark"
import JkAgentMark from "../jkAgentMark"

export type JobAgent = {
  agentName: string
  model: string
  provider: string
  actions: { at: number; actionType: string; ok: boolean }[]
}

const ACTION_LABEL: Record<string, string> = { "jobs.create": "Added this job", "jobs.update": "Updated details" }

const when = (ms: number) =>
  new Date(ms).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })

/** The real Gmail mark (Google's 2020 logo). */
export function JkGmailMark({ className }: { className?: string }) {
  return <img src="/images/sources/gmail.svg" alt="" aria-hidden className={cn("shrink-0 object-contain", className)} />
}

/** The real Outlook mark. */
export function JkOutlookMark({ className }: { className?: string }) {
  return <img src="/images/sources/outlook.svg" alt="" aria-hidden className={cn("shrink-0", className)} />
}

function SourceMark({ source, className }: { source: JobSource; className?: string }) {
  if (source.kind === "gmail") return <JkGmailMark className={className} />
  if (source.kind === "outlook") return <JkOutlookMark className={className} />
  if (source.kind === "web") return <Globe aria-hidden strokeWidth={1.6} className={cn("shrink-0 text-bar-4-ink", className)} />
  return null
}

/** Hover card shell: icon + heading + mono sub line, then label/value rows. */
function OriginCard({ icon, head, sub, rows, children }: {
  icon?: React.ReactNode
  head: string
  sub?: string
  rows: [string, React.ReactNode][]
  children: React.ReactNode
}) {
  return (
    <TooltipPrimitive.Provider delayDuration={120}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>
          <span
            className="flex size-7 items-center justify-center rounded-md transition-colors hover:bg-accent"
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </span>
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side="bottom"
            align="center"
            sideOffset={6}
            collisionPadding={12}
            className="z-50 w-[288px] rounded-[12px] border border-border bg-popover px-3.5 py-3 text-[12px] text-muted-foreground shadow-lg animate-in fade-in-0 slide-in-from-top-1 data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
          >
            <div className="flex items-center gap-2.5">
              {icon && <span className="flex size-5 shrink-0 items-center justify-center">{icon}</span>}
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-foreground">{head}</p>
                {sub && <p className="truncate font-mono text-[11px] text-subtle-foreground">{sub}</p>}
              </div>
            </div>
            {rows.length > 0 && (
              <dl className="mt-2.5 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 border-t border-border pt-2.5">
                {rows.map(([k, v], i) => (
                  <div key={i} className="contents">
                    <dt className="pt-px font-mono text-[10px] uppercase tracking-[0.08em] text-subtle-foreground">{k}</dt>
                    <dd className="break-words text-foreground/90">{v}</dd>
                  </div>
                ))}
              </dl>
            )}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  )
}

function OpenLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="underline decoration-border underline-offset-2 hover:text-foreground">
      {children} ↗
    </a>
  )
}

export function JkJobSourceCell({ source, savedAt }: { source: JobSource; savedAt: number }) {
  const icon = <SourceMark source={source} className="size-[18px]" />
  if (source.kind === "gmail" || source.kind === "outlook") {
    const app = source.kind === "gmail" ? "Gmail" : "Outlook"
    return (
      <OriginCard icon={icon} head={`Came from your ${app}`} sub={source.inbox ?? app} rows={[
        ["From", source.sender ?? "-"],
        ["Received", source.received ?? "-"],
        ["Open", <OpenLink key="o" href={source.url!}>{source.kind === "gmail" ? "Thread in Gmail" : "Message in Outlook"}</OpenLink>],
      ]}>{icon}</OriginCard>
    )
  }
  if (source.kind === "web") {
    return (
      <OriginCard icon={icon} head="Found online" sub={source.site} rows={[
        ["Site", source.host!],
        ["Saved", when(savedAt)],
        ["Open", <OpenLink key="o" href={source.url!}>Original posting</OpenLink>],
      ]}>{icon}</OriginCard>
    )
  }
  return <OriginCard head="No source saved" rows={[["Why", "Added without a posting or email link"]]}><span aria-label="No source" /></OriginCard>
}

export function JkJobAddedByCell({ agents, savedAt }: { agents: JobAgent[]; savedAt: number }) {
  if (agents.length === 0) {
    return (
      <OriginCard head="Added by you" rows={[["Saved", when(savedAt)], ["Agents", "None have touched this job"]]}>
        <span aria-label="Added by you" />
      </OriginCard>
    )
  }
  return (
    <span className="flex items-center -space-x-1.5">
      {agents.map((a) => {
        const mark = <JkAgentMark mark={modelMark(a.model, a.provider)} colour className="size-4 text-foreground" />
        return (
          <OriginCard
            key={a.agentName}
            icon={<JkAgentMark mark={modelMark(a.model, a.provider)} colour className="size-[18px] text-foreground" />}
            head={a.agentName}
            sub={[a.model, a.provider && a.provider !== "unknown" ? a.provider : null].filter(Boolean).join(" · ")}
            rows={a.actions.map((x) => [when(x.at), `${ACTION_LABEL[x.actionType] ?? x.actionType}${x.ok ? "" : " (failed)"}`])}
          >
            {mark}
          </OriginCard>
        )
      })}
    </span>
  )
}
