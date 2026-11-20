'use client'

/**
 * Settings > CLI keys (D32-D36, M30). A key can be tied to an agent: activity made with it is named
 * by the key, never by what the request says. Keys without an identity keep working (the agent
 * reports its own, or shows as Unknown agent).
 *
 *   <JkCliKeys creating onCreatingChange />   create form, the once-shown key, the key list, Edit identity sheet
 *   <JkIdentityChip identity provider? />     "✳ Claude Code · claude-opus-5-5 · anthropic"
 *   openKeyIdentityOnMount(keyId)             from Agent activity: open that key's identity once the list loads
 *
 * The plaintext key lives only in this component's state until the box is closed; it is masked on
 * screen and copied with the copy button.
 */
import { useEffect, useState } from "react"
import { useAction, useMutation, useQuery } from "convex/react"
import { ChevronRight, Copy, KeyRound, X } from "lucide-react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { useAuth } from "@/providers/jkAuthProvider"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { toast } from "@/lib/toast"
import { cn } from "@/lib/utils"
import { modelMark } from "@/lib/agentActivity/modelMark"
import { fmtKeyCreated, fmtKeyUsed, hasIdentity, identityTail, maskKey, type KeyIdentity } from "@/lib/agentActivity/identity"
import JkAgentMark from "../jkAgentMark"
import JkSectionLabel from "../jk-app/jkSectionLabel"
import { JkFieldLabel, jkFieldCls } from "../jkField"
import { JkConfirmText } from "../jkConfirm"

type KeyRow = { _id: string; name: string; createdAt: number; lastUsedAt?: number } & KeyIdentity

const FIELDS: { key: keyof KeyIdentity; label: string; mono?: boolean; placeholder: string }[] = [
  { key: "agentName", label: "Agent name", placeholder: "e.g. Claude Code" },
  { key: "model", label: "Model", mono: true, placeholder: "e.g. claude-opus-5-5" },
  { key: "provider", label: "Provider", mono: true, placeholder: "e.g. anthropic" },
  { key: "agentId", label: "Agent id", mono: true, placeholder: "Optional, e.g. cc-laptop-01" },
]

const EMPTY: KeyIdentity = { agentName: "", agentId: "", model: "", provider: "" }

let pendingIdentityEdit: string | null = null
/** Agent activity's "Scope this key": open that key's Edit identity sheet once Settings has its keys. */
export function openKeyIdentityOnMount(keyId: string) {
  pendingIdentityEdit = keyId
}

async function copy(text: string, what: string) {
  try { await navigator.clipboard.writeText(text); toast.success("Copied", { description: `${what} copied`, duration: 2000 }) }
  catch { toast.error("Copy failed", { description: "Could not copy to the clipboard", duration: 2000 }) }
}

const pick = (k: KeyIdentity): KeyIdentity => ({ agentName: k.agentName ?? "", agentId: k.agentId ?? "", model: k.model ?? "", provider: k.provider ?? "" })

/** "✳ Claude Code · claude-opus-5-5 · anthropic": the identity a key carries. */
export function JkIdentityChip({ identity, provider = true, className }: { identity: KeyIdentity; provider?: boolean; className?: string }) {
  const mark = modelMark(identity.agentName) ?? modelMark(identity.model, identity.provider)
  const tail = identityTail(identity, { provider })
  return (
    <span className={cn("inline-flex h-[26px] min-w-0 max-w-full items-center gap-[7px] rounded-full border border-input bg-card pl-[9px] pr-[11px]", className)}>
      <JkAgentMark mark={mark} colour className="size-3" />
      {identity.agentName && <span className="shrink-0 text-[13px] text-foreground">{identity.agentName}</span>}
      {tail.length > 0 && (
        <span className="truncate font-mono text-[11.5px] text-muted-foreground">{identity.agentName ? "· " : ""}{tail.join(" · ")}</span>
      )}
    </span>
  )
}

function IdentityFields({ value, onChange, layout, idPrefix }: { value: KeyIdentity; onChange: (v: KeyIdentity) => void; layout: "grid" | "stack"; idPrefix: string }) {
  return (
    <div className={cn("grid gap-x-4 gap-y-[19px]", layout === "grid" && "sm:grid-cols-2")}>
      {FIELDS.map((f) => (
        <div key={f.key} className="min-w-0">
          <JkFieldLabel htmlFor={`${idPrefix}-${f.key}`}>{f.label}</JkFieldLabel>
          <input id={`${idPrefix}-${f.key}`} value={value[f.key] ?? ""} onChange={(e) => onChange({ ...value, [f.key]: e.target.value })}
            placeholder={f.placeholder} maxLength={120} autoComplete="off" spellCheck={false}
            className={cn(jkFieldCls, "h-[45px]", f.mono ? "font-mono text-[13px]" : "text-[14px]")} />
        </div>
      ))}
    </div>
  )
}

/** D36: set or change a key's identity. Past activity keeps what it was logged with. */
function JkKeyIdentitySheet({ keyRow, onClose }: { keyRow: KeyRow | null; onClose: () => void }) {
  const setIdentity = useMutation(api.agent.keys.setIdentityMine)
  const [draft, setDraft] = useState<KeyIdentity>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [shown, setShown] = useState<KeyRow | null>(keyRow)
  useEffect(() => { if (keyRow) { setShown(keyRow); setDraft(pick(keyRow)) } }, [keyRow])
  const k = keyRow ?? shown
  const save = async () => {
    if (!k) return
    setSaving(true)
    try {
      await setIdentity({ id: k._id as Id<"agentApiKeys">, ...draft })
      toast.success("Identity saved", { description: `Activity from ${k.name} now shows it`, duration: 2500 })
      onClose()
    } catch (e) { toast.error("Not saved", { description: e instanceof Error ? e.message : "Try again", duration: 3000 }) }
    setSaving(false)
  }
  return (
    <Sheet open={keyRow !== null} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto border-l border-input bg-card p-0 shadow-none sm:max-w-[440px] [&>button:last-child]:hidden">
        {k && (
          <form className="px-5 pb-10 pt-[30px] sm:px-8" onSubmit={(e) => { e.preventDefault(); void save() }}>
            <div className="flex items-start justify-between">
              <JkSectionLabel>Edit identity</JkSectionLabel>
              <button type="button" onClick={onClose} aria-label="Close" className="-mr-2 -mt-2.5 flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground">
                <X className="size-[18px]" strokeWidth={1.6} />
              </button>
            </div>
            <SheetTitle className="mt-[7px] break-all font-mono text-[22px] font-medium leading-[28px] text-foreground">{k.name}</SheetTitle>
            <SheetDescription className="mt-[9px] text-[13.5px] leading-4 text-muted-foreground">
              {hasIdentity(k) ? `Tied to ${k.agentName || "an agent"}` : "Legacy key, no identity yet"}
            </SheetDescription>
            <div className="mt-[25px]"><IdentityFields value={draft} onChange={setDraft} layout="stack" idPrefix="edit-identity" /></div>
            <p className="mt-[19px] text-[13px] leading-[18px] text-subtle-foreground">Activity from this key will always show this identity.</p>
            <p className="mt-[21px] rounded-[16px] border border-input px-4 py-[13px] text-[13px] leading-[19px] text-muted-foreground">
              Past activity is not changed. Earlier actions<br className="max-sm:hidden" /> keep the identity they were logged with.
            </p>
            <div className="mt-[27px] flex flex-wrap gap-3">
              <Button type="submit" className="h-11 rounded-full px-[29px] text-[14px]" disabled={saving}>{saving ? "Saving…" : "Save identity"}</Button>
              <Button type="button" variant="outline" className="h-11 rounded-full px-[28px] text-[14px]" onClick={onClose}>Cancel</Button>
            </div>
          </form>
        )}
      </SheetContent>
    </Sheet>
  )
}

export function JkCliKeys({ creating, onCreatingChange, emptyNote }: {
  creating: boolean
  onCreatingChange: (open: boolean) => void
  /** Shown when there are no keys (plan-dependent copy from Settings). */
  emptyNote: string
}) {
  const { isAuthenticated } = useAuth()
  const keys = useQuery(api.agent.keys.listMine, isAuthenticated ? {} : "skip") as KeyRow[] | undefined
  const generate = useAction(api.agent.keys.generateMine)
  const revoke = useMutation(api.agent.keys.revokeMine)

  const [name, setName] = useState("")
  const [tie, setTie] = useState(false)
  const [identity, setIdentity] = useState<KeyIdentity>(EMPTY)
  const [busy, setBusy] = useState<string | null>(null)
  const [fresh, setFresh] = useState<{ key: string; identity: KeyIdentity | null } | null>(null)
  const [editing, setEditing] = useState<KeyRow | null>(null)
  const now = Date.now()

  useEffect(() => {
    if (!keys || !pendingIdentityEdit) return
    const k = keys.find((x) => x._id === pendingIdentityEdit)
    pendingIdentityEdit = null
    if (k) setEditing(k)
  }, [keys])

  const reset = () => { setName(""); setTie(false); setIdentity(EMPTY) }
  const create = async () => {
    setBusy("create")
    try {
      const r = await generate({ name: name.trim() || undefined, ...(tie ? identity : {}) })
      setFresh({ key: r.key, identity: r.identity })
      reset(); onCreatingChange(false)
    } catch (e) { toast.error("Key not created", { description: e instanceof Error ? e.message : "Try again", duration: 3000 }) }
    setBusy(null)
  }

  return (
    <div>
      {fresh && (
        <div className="mb-8 rounded-[16px] border border-plan/60 bg-card px-[18px] pb-[15px] pt-[17px]">
          <p className="text-[13px] leading-4 text-muted-foreground">Copy this key now. It is shown once.</p>
          <div className="mt-[7px] flex items-center gap-2">
            <code aria-label="New CLI key, hidden" className="min-w-0 flex-1 truncate font-mono text-[13.5px] text-foreground">{maskKey(fresh.key)}</code>
            <button type="button" aria-label="Copy CLI key" onClick={() => copy(fresh.key, "CLI key")} className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"><Copy className="size-4" strokeWidth={1.6} /></button>
            <button type="button" aria-label="Hide key" onClick={() => setFresh(null)} className="-mr-2 flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"><X className="size-4" strokeWidth={1.6} /></button>
          </div>
          <div className="mt-[11px] flex flex-wrap items-center gap-x-7 gap-y-2 border-t border-border pt-[13px]">
            <span className="text-[13px] text-subtle-foreground">Activity from this key shows as</span>
            {fresh.identity && hasIdentity(fresh.identity)
              ? <JkIdentityChip identity={fresh.identity} />
              : <span className="text-[13px] text-muted-foreground">whatever the agent sends, or Unknown agent</span>}
          </div>
        </div>
      )}

      {creating && (
        <form className="mb-[31px]" onSubmit={(e) => { e.preventDefault(); void create() }}>
          <div className="flex flex-wrap gap-2.5 sm:flex-nowrap">
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Name it, e.g. laptop" aria-label="Key name" maxLength={80}
              className={cn(jkFieldCls, "h-[45px] min-w-0 flex-1 basis-full font-mono text-[13px] sm:basis-auto")} />
            <Button type="submit" className="h-[45px] rounded-full px-[21px] text-[14px]" disabled={busy === "create"}>{busy === "create" ? "Creating…" : "Create"}</Button>
            <Button type="button" variant="ghost" className="h-[45px] px-7 text-[14px]" onClick={() => { reset(); onCreatingChange(false) }}>Cancel</Button>
          </div>
          <button type="button" aria-expanded={tie} onClick={() => setTie((t) => !t)}
            className="mt-[15px] flex items-center gap-2.5 text-[13.5px] text-foreground">
            <ChevronRight aria-hidden className={cn("size-4 text-muted-foreground transition-transform", tie && "rotate-90")} strokeWidth={1.6} />
            Tie this key to an agent
            <span className="ml-2.5 text-subtle-foreground">(optional)</span>
          </button>
          {tie && (
            <div className="mt-[17px]">
              <IdentityFields value={identity} onChange={setIdentity} layout="grid" idPrefix="new-key" />
              <p className="mt-[15px] text-[13px] leading-[18px] text-subtle-foreground">Activity from this key will always show this identity.</p>
            </div>
          )}
        </form>
      )}

      {keys && keys.length > 0 ? (
        <>
          {/* Dividers sit 14px in from both edges on desktop (D32); full width on phones */}
          <ul className="relative before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-border lg:before:inset-x-3.5">
            {keys.map((k, i) => {
              const scoped = hasIdentity(k)
              const tone = { color: i % 2 ? "var(--bar-2)" : "var(--bar-4)" }
              return (
                <li key={k._id} className="relative after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-border max-lg:py-[15px] lg:after:inset-x-3.5">
                  {/* Desktop row (D32) */}
                  <div className="grid h-14 grid-cols-[26px_152px_minmax(0,336px)_minmax(0,1fr)_auto] items-center max-lg:hidden">
                    <KeyRound aria-hidden className="size-4 -scale-x-100" style={tone} />
                    <span className="truncate pr-3 font-mono text-[13.5px] text-foreground">{k.name}</span>
                    <span className="flex min-w-0 items-center gap-[30px] pr-3">
                      {scoped ? <JkIdentityChip identity={k} /> : (
                        <>
                          <span className="truncate text-[13px] text-subtle-foreground">No identity (agent reports its own)</span>
                          <AddIdentity onClick={() => setEditing(k)} />
                        </>
                      )}
                    </span>
                    <span className="truncate pr-4 text-[12.5px] text-subtle-foreground">{fmtKeyCreated(k.createdAt)} · {fmtKeyUsed(k.lastUsedAt, now)}</span>
                    <span className="flex items-center gap-[22px]">
                      {scoped && <button type="button" onClick={() => setEditing(k)} className="text-[12.5px] text-muted-foreground transition-colors hover:text-foreground">Edit identity</button>}
                      <RevokeKey disabled={busy === k._id} onConfirm={async () => { setBusy(k._id); try { await revoke({ id: k._id as Id<"agentApiKeys"> }) } finally { setBusy(null) } }} className="text-[12.5px]" />
                    </span>
                  </div>

                  {/* Phone row (M30) */}
                  <div className="grid grid-cols-[30px_minmax(0,1fr)_auto] items-start gap-y-[5px] lg:hidden">
                    <KeyRound aria-hidden className="mt-[3px] size-4 -scale-x-100" style={tone} />
                    <span className="truncate font-mono text-[15px] leading-[21px] text-foreground">{k.name}</span>
                    <RevokeKey disabled={busy === k._id} onConfirm={async () => { setBusy(k._id); try { await revoke({ id: k._id as Id<"agentApiKeys"> }) } finally { setBusy(null) } }} className="text-[14px] leading-[21px]" />
                    <span className="col-start-2 col-end-4 text-[14px] leading-[18px] text-muted-foreground">{fmtKeyCreated(k.createdAt)} · {fmtKeyUsed(k.lastUsedAt, now)}</span>
                    {scoped ? (
                      <span className="col-start-2 col-end-4 mt-[6px] flex items-center justify-between gap-3">
                        <JkIdentityChip identity={k} provider={false} />
                        <button type="button" onClick={() => setEditing(k)} className="shrink-0 text-[14px] text-muted-foreground hover:text-foreground">Edit</button>
                      </span>
                    ) : (
                      <span className="col-start-2 col-end-4 mt-[6px] flex flex-col items-start gap-1">
                        <span className="text-[13.5px] leading-[18px] text-subtle-foreground">No identity (agent reports its own)</span>
                        <AddIdentity onClick={() => setEditing(k)} className="text-[14px]" />
                      </span>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
          <p className="mt-10 max-w-[430px] text-[13px] leading-[19px] text-subtle-foreground max-lg:hidden">
            Keys with an identity name their agent in Agent activity. Keys without one show whatever the agent sends, or unknown agent.
          </p>
        </>
      ) : (
        <p className="text-[13.5px] text-muted-foreground">{emptyNote}</p>
      )}

      <JkKeyIdentitySheet keyRow={editing} onClose={() => setEditing(null)} />
    </div>
  )
}

function AddIdentity({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <button type="button" onClick={onClick}
      className={cn("shrink-0 border-b border-foreground/60 pb-[3px] text-[13px] leading-4 text-foreground transition-colors hover:border-foreground", className)}>
      Add identity
    </button>
  )
}

function RevokeKey({ onConfirm, disabled, className }: { onConfirm: () => Promise<void>; disabled?: boolean; className?: string }) {
  return (
    <JkConfirmText disabled={disabled} onConfirm={onConfirm}
      className={cn("text-subtle-foreground transition-colors hover:text-destructive", className)}>Revoke</JkConfirmText>
  )
}
