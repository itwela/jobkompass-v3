'use client'

/**
 * D13 / M11 Settings. Five sections on one scrolling page: Account, Plan and usage, Resume
 * preferences (default template + writing preferences), Chrome extension, CLI keys.
 * On desktop the app rail is swapped for JkSettingsRail (Back to My Jobs + section nav that
 * follows the scroll); jkConsole.tsx renders it while this mode is open.
 */
import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useAction, useMutation, useQuery } from "convex/react"
import { useAuthActions } from "@convex-dev/auth/react"
import { ChevronLeft, Copy, KeyRound, X } from "lucide-react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { useAuth } from "@/providers/jkAuthProvider"
import { useSubscription } from "@/providers/jkSubscriptionProvider"
import { useFeatureAccess } from "@/hooks/useFeatureAccess"
import { useJobKompassChatWindow } from "@/providers/jkChatWindowProvider"
import { Button } from "@/components/ui/button"
import { toast } from "@/lib/toast"
import { cn } from "@/lib/utils"
import { mainAssets } from "@/app/lib/constants"
import { RESUME_TEMPLATES, canUseResumeTemplate, resumeTemplateMinRank } from "@/lib/templates"
import { rankLabel, RANK_PLUS, RANK_PRO, type PlanRank } from "@/convex/plans"
import { basePlanId, planName } from "@/lib/upgradeOffer"
import { plans } from "../jkPricing"
import JkAppPageHeader from "../jk-app/jkAppPageHeader"
import JkSectionLabel from "../jk-app/jkSectionLabel"
import { useJkAppNav } from "../jk-app/jkAppNav"
import { JkNavRow, JkUserMenu } from "../jkSIdebar"
import { JkFieldLabel, jkFieldCls } from "../jkField"
import JkUpgradeModal from "../jkUpgradeModal"
import JkSignOutButton from "../jkSignOutButton"
import { JkConfirmText } from "../jkConfirm"
import JkArt from "../jkArt"
import { JkDefaultTemplateProbe } from "../jkDefaultTemplate"

export const JK_SETTINGS_SECTIONS = [
  { id: "account", label: "Account" },
  { id: "plan", label: "Plan and usage" },
  { id: "resume", label: "Resume preferences" },
  { id: "extension", label: "Chrome extension" },
  { id: "cli", label: "CLI keys" },
] as const

const SCROLL_ID = "jk-settings-scroll"
const sectionDomId = (id: string) => `jk-settings-${id}`

/** Which section is in view: the last one whose top has passed the upper third of the scroller. */
function useActiveSection(enabled: boolean) {
  const [active, setActive] = useState<string>(JK_SETTINGS_SECTIONS[0].id)
  useEffect(() => {
    if (!enabled) return
    let scroller: HTMLElement | null = null
    let raf = 0
    const onScroll = () => {
      if (!scroller) return
      const top = scroller.getBoundingClientRect().top + scroller.clientHeight / 3
      let current: string = JK_SETTINGS_SECTIONS[0].id
      for (const s of JK_SETTINGS_SECTIONS) {
        const el = document.getElementById(sectionDomId(s.id))
        if (el && el.getBoundingClientRect().top <= top) current = s.id
      }
      if (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 4) current = JK_SETTINGS_SECTIONS[JK_SETTINGS_SECTIONS.length - 1].id
      setActive(current)
    }
    // The content mounts beside the rail; wait for its scroller if it is not there yet.
    const attach = () => {
      scroller = document.getElementById(SCROLL_ID)
      if (!scroller) { raf = requestAnimationFrame(attach); return }
      onScroll()
      scroller.addEventListener("scroll", onScroll, { passive: true })
    }
    attach()
    return () => { cancelAnimationFrame(raf); scroller?.removeEventListener("scroll", onScroll) }
  }, [enabled])
  return active
}

const goToSection = (id: string) =>
  document.getElementById(sectionDomId(id))?.scrollIntoView({ behavior: "smooth", block: "start" })

/** From another page (Agent activity): open Settings, then scroll once the section has mounted. */
export function goToSectionWhenMounted(id: string) {
  let tries = 0
  const step = () => {
    const el = document.getElementById(sectionDomId(id))
    if (el) { el.scrollIntoView({ block: "start" }); return }
    if (++tries < 60) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

/** Desktop rail while Settings is open (D13): back, section nav, and the same account menu as the app rail. */
export function JkSettingsRail() {
  const nav = useJkAppNav()
  const onActivity = nav.currentId === "/agent-activity"
  const active = useActiveSection(!onActivity)
  return (
    <div className="relative flex h-full w-[264px] shrink-0 flex-col overflow-hidden border-r border-border bg-card">
      <div className="mt-[22px] flex h-[30px] shrink-0 items-center pl-[22px]">
        <Link href="/" className="flex items-center gap-2.5" aria-label="JobKompass home">
          <Image src={mainAssets.logo} alt="" width={32} height={30} className="h-[30px] w-8 object-contain" />
          <span className="text-[18px] font-bold leading-[21px] tracking-[-0.2px] text-foreground">JobKompass</span>
        </Link>
      </div>
      <div className="mt-8 px-3.5">
        <button type="button" onClick={() => nav.go("/my-jobs")}
          className="flex h-[38px] w-full items-center gap-3.5 rounded-xl border border-input px-4 text-[14px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
          <ChevronLeft className="size-4" strokeWidth={1.8} />Back to My Jobs
        </button>
      </div>
      <JkSectionLabel as="h2" className="mt-8 px-[26px]">Settings</JkSectionLabel>
      <nav aria-label="Settings sections" className="mt-3 flex flex-col gap-0.5 px-3.5">
        {JK_SETTINGS_SECTIONS.map((s) => (
          <JkNavRow key={s.id} label={s.label} count={null} tick="var(--plan)" active={!onActivity && active === s.id}
            onClick={() => { if (onActivity) { nav.go("/settings"); if (s.id !== JK_SETTINGS_SECTIONS[0].id) goToSectionWhenMounted(s.id) } else goToSection(s.id) }} />
        ))}
        {/* D27: its own page, last item, right under CLI keys */}
        <JkNavRow label="Agent activity" count={null} tick="var(--bar-1)" active={onActivity} onClick={() => nav.go("/agent-activity")} />
      </nav>
      <div className="mx-[18px] mt-auto shrink-0 border-t border-border pb-[22px] pt-[21px]">
        <JkUserMenu />
      </div>
    </div>
  )
}

function JkSettingsSection({ id, title, sub, action, children, index, className }: {
  id: string; title: string; sub?: string; action?: React.ReactNode; children: React.ReactNode; index: number; className?: string
}) {
  return (
    <section id={sectionDomId(id)} aria-labelledby={`${sectionDomId(id)}-h`}
      className={cn("jk-enter scroll-mt-6 border-t border-border py-7 first:border-t-0 first:pt-0 lg:py-[30px]", className)}
      style={{ "--i": index + 2 } as React.CSSProperties}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 id={`${sectionDomId(id)}-h`} className="text-[22px] font-medium leading-[26px] tracking-[-0.3px] text-foreground lg:text-[18px] lg:leading-[21px] lg:tracking-[-0.2px]">{title}</h2>
          {sub && <p className="mt-1.5 text-[13px] leading-[15px] text-muted-foreground max-lg:hidden">{sub}</p>}
        </div>
        {action}
      </div>
      <div className="mt-5 lg:mt-[17px]">{children}</div>
    </section>
  )
}

function JkUsageBar({ label, value, ratio, tone }: { label: string; value: string; ratio: number; tone: string }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[10px] font-medium uppercase tracking-[1.2px] text-muted-foreground max-lg:text-[11px] max-lg:tracking-[2.5px]">{label}</span>
        <span className="font-mono text-[12px] font-medium text-foreground max-lg:text-[13px]">{value}</span>
      </div>
      <div className="mt-2.5 h-[6px] w-full overflow-hidden rounded-full bg-accent">
        <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.max(0, Math.min(1, ratio)) * 100}%`, background: tone }} />
      </div>
    </div>
  )
}

const TEMPLATE_BLURB: Record<string, string> = {
  jake: "Clean single column",
  joseph: "Calibri, core competencies",
  mar: "Times, early career",
}

const fmtDay = (ms: number) => new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric" })
const fmtDate = (ms: number) => new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
function fmtUsed(ms?: number) {
  if (!ms) return "never used"
  const today = new Date(); const d = new Date(ms)
  return d.toDateString() === today.toDateString() ? "last used today" : `last used ${fmtDay(ms)}`
}
/** jkx_live_4f9a…c21e with a dotted middle, as the frame shows it. */
const maskKey = (key: string) => key.length <= 16 ? key : `${key.slice(0, 13)}${"·".repeat(16)}${key.slice(-4)}`

async function copy(text: string, what: string) {
  try { await navigator.clipboard.writeText(text); toast.success("Copied", { description: `${what} copied`, duration: 2000 }) }
  catch { toast.error("Copy failed", { description: "Could not copy to the clipboard", duration: 2000 }) }
}

export default function JkCW_SettingsMode() {
  const nav = useJkAppNav()
  const { user, isAuthenticated } = useAuth()
  const { subscription, planId, rank } = useSubscription()
  const { getUsageStats } = useFeatureAccess()
  const usage = getUsageStats()
  const { signOut } = useAuthActions()
  const { setCurrentThreadId } = useJobKompassChatWindow()

  const updateProfile = useMutation(api.auth.updateUserProfile)
  const resumePreferences = useQuery(api.auth.getResumePreferences, isAuthenticated ? {} : "skip")
  const updateResumePreferences = useMutation(api.auth.updateResumePreferences)
  const [defaultTemplate, setDefaultTemplateState] = useState<string | null>(null)
  const setDefaultTemplate = useMutation(api.auth.setDefaultTemplate)

  const extensionApiKey = useQuery(api.extensionApiKeys.get, isAuthenticated ? {} : "skip")
  const generateApiKey = useMutation(api.extensionApiKeys.generate)
  const revokeApiKey = useMutation(api.extensionApiKeys.revoke)

  const cliKeys = useQuery(api.agent.keys.listMine, isAuthenticated ? {} : "skip")
  const generateCliKey = useAction(api.agent.keys.generateMine)
  const revokeCliKey = useMutation(api.agent.keys.revokeMine)

  const [upgrade, setUpgrade] = useState<{ feature: string; requiredPlan?: "plus" | "pro" } | null>(null)
  const [profile, setProfile] = useState({ name: "", username: "", email: "" })
  const [savingProfile, setSavingProfile] = useState(false)
  const [newPref, setNewPref] = useState("")
  const [cliName, setCliName] = useState("")
  const [cliOpen, setCliOpen] = useState(false)
  const [freshCliKey, setFreshCliKey] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    if (user) setProfile({ name: user.name || "", username: user.username || "", email: user.email || "" })
  }, [user])

  const dirty = !!user && (profile.name !== (user.name || "") || profile.username !== (user.username || "") || profile.email !== (user.email || ""))
  const prefs: string[] = resumePreferences ?? []
  const effectiveDefault = defaultTemplate ?? "jake"
  const base = basePlanId(planId)
  const paid = base !== "free" && rank > 0
  const isAnnualPlan = (planId || "").toLowerCase().endsWith("-annual")

  const billingLine = useMemo(() => {
    if (!paid) return "No card on file. Upgrade any time."
    const p = plans.find((x) => x.id === base)
    const price = base === "starter" ? `${p?.oneTimePrice ?? ""} for 7 days` : isAnnualPlan ? `${p?.pricing?.annual.price} a year` : `${p?.pricing?.monthly.price} a month`
    const end = subscription?.currentPeriodEnd as number | undefined
    const trialEnd = subscription?.trialEnd as number | undefined
    if (trialEnd && trialEnd > Date.now()) return `${price} · trial ends ${fmtDate(trialEnd)}`
    if (!end) return price
    return `${price} · ${subscription?.cancelAtPeriodEnd || subscription?.status === "canceled" ? "ends" : base === "starter" ? "ends" : "renews"} ${fmtDate(end)}`
  }, [paid, base, isAnnualPlan, subscription])

  const saveProfile = async () => {
    setSavingProfile(true)
    try {
      await updateProfile({ name: profile.name.trim() || undefined, username: profile.username.trim() || undefined, email: profile.email.trim() || undefined })
      toast.success("Saved", { description: "Your account details are updated", duration: 2000 })
    } catch (e) {
      toast.error("Not saved", { description: e instanceof Error ? e.message.replace(/^.*Error: /, "") : "Try again", duration: 3000 })
    } finally { setSavingProfile(false) }
  }

  const manageBilling = async () => {
    if (!subscription?.stripeCustomerId) { setUpgrade({ feature: "Plans" }); return }
    setBusy("billing")
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customerId: subscription.stripeCustomerId }) })
      const data = await res.json()
      if (data.url) { window.location.href = data.url; return }
      throw new Error()
    } catch { toast.error("Billing did not open", { description: "Try again in a moment.", duration: 3000 }) }
    setBusy(null)
  }

  const pickTemplate = async (id: string) => {
    if (!canUseResumeTemplate(id, rank as PlanRank)) {
      const need = resumeTemplateMinRank(id)
      const t = RESUME_TEMPLATES.find((x) => x.id === id)
      setUpgrade({ feature: `${t?.name.replace("JobKompass ", "") ?? id} resume template`, requiredPlan: need >= RANK_PRO ? "pro" : "plus" })
      return
    }
    const before = defaultTemplate
    setDefaultTemplateState(id)
    try { await setDefaultTemplate({ templateId: id }) }
    catch (e) { setDefaultTemplateState(before); toast.error("Not saved", { description: e instanceof Error ? e.message.replace(/^.*Error: /, "") : "Try again", duration: 3000 }) }
  }

  const savePrefs = async (next: string[]) => {
    try { await updateResumePreferences({ preferences: next }) }
    catch { toast.error("Not saved", { description: "Try again", duration: 3000 }) }
  }

  const newExtensionKey = async () => {
    if (rank < RANK_PLUS) { setUpgrade({ feature: "Chrome extension" }); return }
    setBusy("ext")
    try { await generateApiKey() } catch (e) { toast.error("Key not created", { description: e instanceof Error ? e.message : "Try again", duration: 3000 }) }
    setBusy(null)
  }

  const createCliKey = async () => {
    setBusy("cli")
    try {
      const r = await generateCliKey({ name: cliName.trim() || undefined })
      setFreshCliKey(r.key); setCliName(""); setCliOpen(false)
    } catch (e) { toast.error("Key not created", { description: e instanceof Error ? e.message : "Try again", duration: 3000 }) }
    setBusy(null)
  }

  if (!isAuthenticated || !user) {
    return <div className="flex flex-1 items-center justify-center p-8 text-muted-foreground">Sign in to see your settings</div>
  }

  const field = (key: "name" | "username" | "email", label: string, cls?: string) => (
    <div className={cls}>
      <JkFieldLabel htmlFor={`jk-set-${key}`} className="max-lg:mb-2.5 max-lg:[&_label]:text-[11px] max-lg:[&_label]:tracking-[2.5px]">{label}</JkFieldLabel>
      <input id={`jk-set-${key}`} type={key === "email" ? "email" : "text"} value={profile[key]}
        onChange={(e) => setProfile({ ...profile, [key]: e.target.value })}
        onKeyDown={(e) => { if (e.key === "Enter" && dirty) void saveProfile() }}
        className={cn(jkFieldCls, "h-[45px] rounded-[12px] bg-card max-lg:h-11 max-lg:text-[16px]")} />
    </div>
  )

  return (
    <div id={SCROLL_ID} className="chat-scroll relative flex h-full flex-col overflow-y-auto">
      <JkDefaultTemplateProbe onChange={setDefaultTemplateState} />
      <JkAppPageHeader title="Settings" sub="Account, plan, and keys" art="cabin" artHeight={170} artPosition="right 30%" live={false} divider={false}
        className="lg:pl-[max(32px,calc((100%-880px)/2))]" />

      <div className="mx-auto w-full max-w-[944px] px-5 pb-24 pt-6 lg:px-8 lg:pt-[42px]">
        {/* Account */}
        <JkSettingsSection id="account" index={0} title="Account" sub="How you show up on resumes and in the app"
          action={dirty ? <Button className="h-9 px-5" disabled={savingProfile} onClick={saveProfile}>{savingProfile ? "Saving…" : "Save"}</Button> : null}>
          <div className="grid gap-5 lg:grid-cols-[260px_260px_1fr] lg:gap-4">
            {field("name", "Name")}
            {field("username", "Username", "max-lg:hidden")}
            {field("email", "Email", "lg:max-w-[269px]")}
          </div>
        </JkSettingsSection>

        {/* Plan and usage */}
        <JkSettingsSection id="plan" index={1} title="Plan and usage" sub="What you are on and how much of it is used this month"
          action={<>
            <span className={cn("rounded-full px-3 py-1 font-mono text-[11px] font-bold tracking-[1px] lg:hidden", paid ? "bg-plan/15 text-plan-text" : "bg-muted text-muted-foreground")}>{planName(planId).toUpperCase()}</span>
            <Button variant="outline" className="h-10 px-8 text-[13.5px] max-lg:hidden" disabled={busy === "billing"} onClick={paid ? manageBilling : () => setUpgrade({ feature: "Plans" })}>
              {paid ? "Manage billing" : "Upgrade"}
            </Button>
          </>}>
          <p className="-mt-2 mb-6 text-[15px] text-muted-foreground lg:hidden">{billingLine}</p>
          <div className={cn("relative overflow-hidden lg:rounded-[20px] lg:border lg:px-6 lg:pb-6 lg:pt-[22px]", paid ? "lg:border-plan lg:bg-accent" : "lg:border-input lg:bg-card")}>
            <div className="relative z-10 lg:max-w-[630px]">
              <div className="flex items-center gap-3 max-lg:hidden">
                <span aria-hidden className="h-4 w-[3px] rounded-full bg-bar-4" />
                <span className="text-[20px] font-medium tracking-[-0.3px] text-foreground">{planName(planId)}</span>
                <span className={cn("rounded-full px-2 py-[3px] font-mono text-[9.5px] font-bold tracking-[0.8px]", paid ? "bg-plan/15 text-plan-text" : "bg-muted text-muted-foreground")}>CURRENT PLAN</span>
              </div>
              <p className="mt-1.5 text-[13px] text-muted-foreground max-lg:hidden">{billingLine}</p>
              <div className="flex flex-col gap-6 lg:mt-7 lg:gap-[22px]">
                <JkUsageBar label="AI documents" value={`${usage.documentsUsed} / ${usage.documentsLimit}`}
                  ratio={usage.documentsUsed / Math.max(1, usage.documentsLimit)} tone={paid ? "var(--plan)" : "var(--bar-3)"} />
                <div className="max-lg:hidden">
                  <JkUsageBar label="Jobs tracked" value={usage.jobsLimit === null ? `${usage.jobsUsed} · unlimited` : `${usage.jobsUsed} / ${usage.jobsLimit}`}
                    ratio={usage.jobsLimit === null ? 1 : usage.jobsUsed / Math.max(1, usage.jobsLimit)} tone={usage.jobsLimit === null ? "var(--border-strong)" : "var(--bar-3)"} />
                </div>
              </div>
            </div>
            <div aria-hidden className="absolute right-6 top-1/2 hidden size-[164px] -translate-y-1/2 xl:block">
              <JkArt name="ship4" variant="spot" />
            </div>
          </div>
          <Button variant="outline" className="mt-7 h-12 w-full text-[16px] lg:hidden" disabled={busy === "billing"} onClick={paid ? manageBilling : () => setUpgrade({ feature: "Plans" })}>
            {paid ? "Manage billing" : "Upgrade"}
          </Button>
        </JkSettingsSection>

        {/* Resume preferences */}
        <JkSettingsSection id="resume" index={2} title="Resume preferences" sub="Used every time JobKompass writes for you">
          <div role="radiogroup" aria-label="Default resume template" className="grid grid-cols-1 gap-3 min-[460px]:grid-cols-3 lg:flex lg:gap-3">
            {RESUME_TEMPLATES.map((t) => {
              const short = t.name.replace("JobKompass ", "")
              const need = resumeTemplateMinRank(t.id)
              const on = effectiveDefault === t.id
              const locked = !canUseResumeTemplate(t.id, rank as PlanRank)
              return (
                <button key={t.id} type="button" role="radio" aria-checked={on} onClick={() => pickTemplate(t.id)}
                  className={cn("flex min-h-[84px] flex-col rounded-[16px] border px-4 pb-3 pt-3.5 text-left transition-colors lg:w-[188px]",
                    on ? "border-[1.5px] border-plan bg-accent" : "border-input bg-card hover:bg-accent/60")}>
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-[15px] font-medium text-foreground">{short}</span>
                    <span className={cn("rounded-full px-[7px] py-[3px] font-mono text-[9.5px] font-bold tracking-[0.8px]",
                      need === 0 ? "bg-muted text-muted-foreground" : "bg-plan/15 text-plan-text")}>{rankLabel(need).toUpperCase()}</span>
                  </span>
                  <span className="mt-1.5 text-[12px] text-muted-foreground">{TEMPLATE_BLURB[t.id] ?? t.tags?.join(", ")}</span>
                  <span className={cn("mt-2.5 flex items-center gap-2 text-[11px]", on ? "text-plan-text" : "text-subtle-foreground")}>
                    <span aria-hidden className={cn("size-3 rounded-full", on ? "bg-plan" : "border border-border-strong")} />
                    {on ? "Default" : locked ? `Needs ${rankLabel(need)}` : "Use as default"}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Writing preferences the AI reads on every resume (kept from v3) */}
          <div className="mt-7">
            <JkFieldLabel htmlFor="jk-set-pref">Writing preferences</JkFieldLabel>
            {prefs.length > 0 && (
              <ul className="mb-3 flex flex-wrap gap-2">
                {prefs.map((p, i) => (
                  <li key={`${p}-${i}`} className="flex max-w-full items-center gap-2 rounded-full border border-input bg-card py-1.5 pl-3.5 pr-2 text-[13px] text-foreground">
                    <span className="truncate">{p}</span>
                    <button type="button" aria-label={`Remove ${p}`} onClick={() => savePrefs(prefs.filter((_, j) => j !== i))} className="rounded-full p-0.5 text-subtle-foreground hover:text-foreground"><X className="size-3.5" /></button>
                  </li>
                ))}
              </ul>
            )}
            <form className="flex gap-2.5" onSubmit={(e) => { e.preventDefault(); const v = newPref.trim(); if (!v || prefs.includes(v)) return; setNewPref(""); void savePrefs([...prefs, v]) }}>
              <input id="jk-set-pref" value={newPref} onChange={(e) => setNewPref(e.target.value)} placeholder="Keep it to one page" className={cn(jkFieldCls, "h-11 flex-1")} />
              <Button type="submit" variant="outline" className="h-11 px-5" disabled={!newPref.trim()}>Add</Button>
            </form>
          </div>
        </JkSettingsSection>

        {/* Chrome extension */}
        <JkSettingsSection id="extension" index={3} title="Chrome extension" sub="Save a posting from any site in one click" className="max-lg:hidden">
          {extensionApiKey?.key ? (
            <div className="flex h-14 items-center gap-3 rounded-[16px] border border-input bg-card pl-[18px] pr-3">
              <code className="min-w-0 flex-1 truncate font-mono text-[13px] text-foreground">{maskKey(extensionApiKey.key)}</code>
              <button type="button" aria-label="Copy extension key" onClick={() => copy(extensionApiKey.key, "Extension key")} className="flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"><Copy className="size-4" /></button>
              <JkConfirmText disabled={busy === "extr"} onConfirm={async () => { setBusy("extr"); try { await revokeApiKey() } finally { setBusy(null) } }} className="px-2 text-[12.5px] text-subtle-foreground hover:text-destructive">Revoke</JkConfirmText>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-dashed border-input px-[18px] py-4">
              <p className="text-[13.5px] text-muted-foreground">{rank < RANK_PLUS ? "The extension is part of Plus." : "Create a key, then paste it into the extension."}</p>
              <Button variant="outline" className="h-9 px-5" disabled={busy === "ext"} onClick={newExtensionKey}>{rank < RANK_PLUS ? "See Plus" : "Create key"}</Button>
            </div>
          )}
        </JkSettingsSection>

        {/* CLI keys */}
        <JkSettingsSection id="cli" index={4} title="CLI keys" sub="Let Claude Code, Cursor, or any agent run jk for you"
          action={<Button variant="outline" className="h-10 px-8 text-[13.5px] max-lg:hidden" onClick={() => rank < RANK_PRO ? setUpgrade({ feature: "jk CLI" }) : setCliOpen(true)}>New key</Button>}>
          {freshCliKey && (
            <div className="mb-4 rounded-[16px] border border-plan/60 bg-accent p-4">
              <p className="text-[13px] text-muted-foreground">Copy this key now. It is shown once.</p>
              <div className="mt-2 flex items-center gap-2">
                <code className="min-w-0 flex-1 break-all font-mono text-[13px] text-foreground">{freshCliKey}</code>
                <button type="button" aria-label="Copy CLI key" onClick={() => copy(freshCliKey, "CLI key")} className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"><Copy className="size-4" /></button>
                <button type="button" aria-label="Hide key" onClick={() => setFreshCliKey(null)} className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"><X className="size-4" /></button>
              </div>
            </div>
          )}
          {cliOpen && (
            <form className="mb-4 flex gap-2.5" onSubmit={(e) => { e.preventDefault(); void createCliKey() }}>
              <input autoFocus value={cliName} onChange={(e) => setCliName(e.target.value)} placeholder="Name it, e.g. laptop" aria-label="Key name" className={cn(jkFieldCls, "h-11 flex-1 font-mono text-[13px]")} />
              <Button type="submit" className="h-11 px-5" disabled={busy === "cli"}>{busy === "cli" ? "Creating…" : "Create"}</Button>
              <Button type="button" variant="ghost" className="h-11 px-4" onClick={() => setCliOpen(false)}>Cancel</Button>
            </form>
          )}
          {cliKeys && cliKeys.length > 0 ? (
            <ul className="flex flex-col gap-5 lg:gap-[17px]">
              {cliKeys.map((k, i) => (
                <li key={k._id} className="grid grid-cols-[28px_1fr_auto] items-center gap-x-3 lg:grid-cols-[28px_152px_1fr_auto]">
                  <KeyRound className="size-4 -scale-x-100" style={{ color: i % 2 ? "var(--bar-4)" : "var(--bar-2)" }} />
                  <span className="truncate font-mono text-[13px] text-foreground max-lg:text-[15px]">{k.name}</span>
                  <span className="text-[12.5px] text-muted-foreground max-lg:col-start-2 max-lg:row-start-2 max-lg:mt-0.5 max-lg:text-[14px]">
                    <span className="max-lg:hidden">created {fmtDay(k.createdAt)} · </span>{fmtUsed(k.lastUsedAt)}
                  </span>
                  <JkConfirmText disabled={busy === k._id} onConfirm={async () => { setBusy(k._id); try { await revokeCliKey({ id: k._id as Id<"agentApiKeys"> }) } finally { setBusy(null) } }}
                    className="text-[12.5px] text-subtle-foreground transition-colors hover:text-destructive max-lg:col-start-3 max-lg:row-span-2 max-lg:row-start-1 max-lg:text-[14px]">Revoke</JkConfirmText>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13.5px] text-muted-foreground">No keys yet. {rank < RANK_PRO ? "The jk CLI is part of Pro." : "Create one to use jk from your terminal or an agent."}</p>
          )}
          <Button variant="outline" className="mt-7 h-12 w-full text-[16px] lg:hidden" onClick={() => rank < RANK_PRO ? setUpgrade({ feature: "jk CLI" }) : setCliOpen(true)}>New key</Button>
        </JkSettingsSection>

        {/* Phones: Agent activity is its own page, reached from here (the desktop rail lists it under CLI keys) */}
        <button type="button" onClick={() => nav.go("/agent-activity")}
          className="jk-enter flex w-full items-center justify-between gap-4 border-t border-border py-7 text-left lg:hidden" style={{ "--i": 7 } as React.CSSProperties}>
          <span className="min-w-0">
            <span className="block text-[22px] font-medium leading-[26px] tracking-[-0.3px] text-foreground">Agent activity</span>
            <span className="mt-1.5 block text-[15px] leading-5 text-muted-foreground">What agents did on your account</span>
          </span>
          <ChevronLeft aria-hidden className="size-5 shrink-0 rotate-180 text-subtle-foreground" strokeWidth={1.8} />
        </button>

        <JkSignOutButton className="mt-6 text-[16px] hover:underline lg:hidden" onConfirm={async () => { setCurrentThreadId(null); await signOut() }} />
      </div>

      <JkUpgradeModal isOpen={upgrade !== null} onClose={() => setUpgrade(null)} feature={upgrade?.feature ?? ""} requiredPlan={upgrade?.requiredPlan} />
    </div>
  )
}
