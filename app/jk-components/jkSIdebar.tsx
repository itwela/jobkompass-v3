'use client'

/**
 * Desktop left rail (D01 / D03): logo, search + new chat, the six places with a tick and real
 * counts, CONVERSATIONS from the real threads, and the user chip (opens account + settings).
 * Settings, Help & Guides, Job Leads, theme, plan and sign out live in the user chip menu —
 * the frames keep them out of the rail.
 *
 * Nav data comes from useJkAppNav() (jk-app/jkAppNav.ts), shared with the phone menu.
 */
import { useState, useEffect } from 'react'
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { useAuth } from "@/providers/jkAuthProvider"
import { useSubscription } from "@/providers/jkSubscriptionProvider"
import { useFeatureAccess } from "@/hooks/useFeatureAccess"
import { useJobKompassChatWindow } from "@/providers/jkChatWindowProvider"
import { Trash2, Plus, LogIn, LogOut, Settings, Search, CreditCard, Home, Moon, Sun, LifeBuoy, Inbox } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useAuthActions } from "@convex-dev/auth/react"
import { mainAssets } from "@/app/lib/constants"
import Image from "next/image"
import Link from "next/link"
import JkSearchModal from './jkSearchModal'
import JkUpgradeModal from './jkUpgradeModal'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import JkSectionLabel from './jk-app/jkSectionLabel'
import { useJkAppNav, jkInitials, jkPlanBadge } from './jk-app/jkAppNav'
import { useJobKompassTheme } from '@/providers/jkThemeProvider'
import { trackUpgradeClicked } from '@/lib/analytics/client'
import { cn } from '@/lib/utils'

/** Opens search, or the upgrade prompt on the free plan (search is a paid feature). Shared by rail + phone header. */
export function useJkOpenSearch(setUpgradeModal: ReturnType<typeof useFeatureAccess>['setUpgradeModal']) {
  const { isAuthenticated } = useAuth()
  const { planId, isFree } = useSubscription()
  const [open, setOpen] = useState(false)
  const openSearch = () => {
    if (isFree && isAuthenticated) {
      setUpgradeModal({ isOpen: true, feature: 'Search functionality', currentLimit: 'Not available on free plan', currentPlan: planId || 'free' })
    } else {
      setOpen(true)
    }
  }
  return { searchOpen: open, setSearchOpen: setOpen, openSearch }
}

/** The tick + label + count row. `size="lg"` is the phone menu (M10). */
export function JkNavRow({ label, count, active, tick, onClick, size = "md" }: {
  label: string; count: number | null; active: boolean; tick: string; onClick: () => void; size?: "md" | "lg"
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex w-full items-center text-left outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ring/50",
        size === "md"
          ? cn("h-[38px] gap-[13px] rounded-xl px-3 text-[15px] leading-[18px]", active ? "bg-accent font-medium text-foreground" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground")
          : cn("min-h-14 gap-[17px] py-2 text-[22px] font-medium leading-[26px] tracking-[-0.3px]", active ? "text-foreground" : "text-muted-foreground hover:text-foreground"),
      )}
    >
      <span
        aria-hidden
        className={cn("w-[3px] shrink-0 rounded-full transition-colors duration-200", size === "md" ? "h-3.5" : "h-[22px]", !active && "bg-input group-hover:bg-border-strong")}
        style={active ? { background: tick } : undefined}
      />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count !== null && (
        <span className={cn("shrink-0 font-mono tabular-nums", size === "md" ? "text-[12px]" : "text-[13px]", active && size === "md" ? "text-muted-foreground" : "text-subtle-foreground")}>
          {count}
        </span>
      )}
    </button>
  )
}

/** Avatar initial + name + @username + plan badge (gold only for paid plans). */
export function JkUserChipBody({ size = "md" }: { size?: "md" | "lg" }) {
  const { user } = useAuth()
  const { planId, subscription } = useSubscription()
  const badge = jkPlanBadge(planId, subscription?.status)
  if (!user) return null
  return (
    <span className="flex w-full min-w-0 items-center gap-2.5 text-left">
      <span
        aria-hidden
        className={cn("flex shrink-0 items-center justify-center rounded-full bg-bar-2 font-bold text-on-fill", size === "md" ? "size-8 text-[12px]" : "size-10 text-[13px]")}
      >
        {jkInitials(user.name, user.email)}
      </span>
      <span className={cn("min-w-0 flex-1", size === "lg" && "pl-0.5")}>
        <span className={cn("block truncate font-medium text-foreground", size === "md" ? "text-[14px] leading-[17px]" : "text-[16px] leading-[19px]")}>{user.name || user.email}</span>
        {user.username && (
          <span className={cn("mt-0.5 block truncate font-mono text-subtle-foreground", size === "md" ? "text-[11.5px] leading-[15px]" : "text-[12px] leading-4")}>@{user.username}</span>
        )}
      </span>
      {badge && (
        <span className={cn(
          "shrink-0 rounded-full px-[7px] py-[2.5px] font-mono text-[9.5px] font-bold leading-[13px] tracking-[0.8px]",
          badge.paid ? "bg-plan/15 text-plan-text" : "bg-muted text-muted-foreground",
        )}>
          {badge.label}
        </span>
      )}
    </span>
  )
}

export default function JkSidebar() {
  const { user, isAuthenticated } = useAuth()
  const { planId, isPro, isProAnnual } = useSubscription()
  const { getUsageStats, upgradeModal, setUpgradeModal } = useFeatureAccess()
  const usage = getUsageStats()
  const { currentThreadId, setCurrentThreadId } = useJobKompassChatWindow()
  const nav = useJkAppNav()
  const [threadToDelete, setThreadToDelete] = useState<any>(null)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const { searchOpen, setSearchOpen, openSearch } = useJkOpenSearch(setUpgradeModal)
  const { theme, toggleTheme } = useJobKompassTheme()

  const threads = useQuery(api.threads.list, isAuthenticated ? {} : "skip")
  const pendingLeads = useQuery(api.jobLeads.list, isAuthenticated ? { status: "pending_approval" } : "skip")
  const deleteThread = useMutation(api.threads.remove)
  const { signOut } = useAuthActions()

  // Listen for custom event to navigate to sign-in page
  useEffect(() => {
    const handleOpenSignIn = () => { window.location.href = '/auth' }
    window.addEventListener('jk:openSignIn', handleOpenSignIn)
    return () => window.removeEventListener('jk:openSignIn', handleOpenSignIn)
  }, [])

  const handleThreadClick = (threadId: any) => {
    setCurrentThreadId(threadId)
    nav.go('/chat')
  }

  const handleNewChat = () => {
    setCurrentThreadId(null)
    nav.go('/chat')
  }

  const handleDeleteConfirm = async () => {
    if (!threadToDelete) return
    await deleteThread({ threadId: threadToDelete })
    if (currentThreadId === threadToDelete) {
      setCurrentThreadId(null)
      nav.go('/chat')
    }
    setThreadToDelete(null)
  }

  const handleSignOut = async () => {
    await signOut()
    setCurrentThreadId(null)
  }

  const menuItem = "flex w-full items-center gap-3 px-4 py-3 text-left text-[14px] font-medium text-foreground transition-colors hover:bg-accent"

  return (
    <div className="relative flex h-full w-[264px] shrink-0 flex-col overflow-hidden border-r border-border bg-card">
      {/* Logo, search, new chat */}
      <div className="mt-[22px] flex h-[30px] shrink-0 items-center justify-between pl-[22px] pr-4">
        <Link href="/" className="flex items-center gap-2.5" aria-label="JobKompass home">
          <Image src={mainAssets.logo} alt="" width={32} height={30} className="h-[30px] w-8 object-contain" />
          <span className="text-[18px] font-bold leading-[21px] tracking-[-0.2px] text-foreground">JobKompass</span>
        </Link>
        <div className="flex items-center">
          <button type="button" onClick={openSearch} title="Search" aria-label="Search"
            className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
            <Search className="size-[15px]" strokeWidth={1.8} />
          </button>
          <button type="button" onClick={handleNewChat} title="New chat" aria-label="New chat"
            className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
            <Plus className="size-4" strokeWidth={1.8} />
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        {/* Places */}
        <nav aria-label="App" className="mt-8 flex shrink-0 flex-col gap-0.5 px-3.5">
          {nav.items.map((item) => (
            <JkNavRow
              key={item.id}
              label={item.label}
              count={item.count}
              tick={item.tick}
              active={nav.currentId === item.id}
              onClick={() => (item.id === '/chat' ? handleNewChat() : nav.go(item.id))}
            />
          ))}
        </nav>

        {/* Conversations */}
        <JkSectionLabel as="h2" className="mt-[26px] shrink-0 px-[26px]">Conversations</JkSectionLabel>
        <div className="no-scrollbar mt-[17px] min-h-0 flex-1 overflow-y-auto px-3.5 pb-6 [mask-image:linear-gradient(to_bottom,black_calc(100%-28px),transparent)]">
          {!isAuthenticated ? (
            <p className="px-3 text-[13.5px] text-subtle-foreground">Sign in to see your chats</p>
          ) : threads === undefined ? null : threads.length === 0 ? (
            <p className="px-3 text-[13.5px] text-subtle-foreground">No chats yet</p>
          ) : (
            <ul className="flex flex-col">
              {threads.map((thread) => {
                const on = nav.currentId === '/chat' && currentThreadId === thread._id
                return (
                  <li key={thread._id} className="group relative">
                    <button
                      type="button"
                      onClick={() => handleThreadClick(thread._id)}
                      className={cn(
                        "flex h-[34px] w-full items-center rounded-lg px-3 pr-8 text-left text-[13.5px] leading-4 transition-colors",
                        on ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                      )}
                    >
                      <span className="truncate">{thread.title}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setThreadToDelete(thread._id)}
                      aria-label={`Delete ${thread.title}`}
                      className="absolute right-1.5 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-subtle-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      {/* User chip */}
      <div className="mx-[18px] shrink-0 border-t border-border pb-[22px] pt-[21px]">
        {isAuthenticated && user ? (
          <Popover open={userMenuOpen} onOpenChange={setUserMenuOpen}>
            <PopoverTrigger asChild>
              <button type="button" aria-label="Account and settings" className="-mx-3 flex w-[calc(100%+24px)] rounded-xl px-3 py-1.5 transition-colors hover:bg-accent/60">
                <span className="w-full pl-[6px] pr-[3px]"><JkUserChipBody /></span>
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" side="top" sideOffset={10} className="w-[268px] overflow-hidden rounded-2xl border border-border bg-popover p-0 shadow-xl">
              {planId && planId !== 'free' && (
                <div className="space-y-2 border-b border-border px-4 py-3">
                  <div className="flex items-center justify-between font-mono text-[11px]">
                    <span className="uppercase tracking-[1.2px] text-subtle-foreground">AI documents</span>
                    <span className="text-foreground">{usage.documentsUsed} / {usage.documentsLimit}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-accent">
                    <div className="h-full rounded-full bg-bar-3" style={{ width: `${Math.min(100, (usage.documentsUsed / usage.documentsLimit) * 100)}%` }} />
                  </div>
                  <div className="flex items-center justify-between font-mono text-[11px]">
                    <span className="uppercase tracking-[1.2px] text-subtle-foreground">Jobs</span>
                    <span className="text-foreground">{usage.jobsUsed}{usage.jobsLimit !== null ? ` / ${usage.jobsLimit}` : ''}</span>
                  </div>
                </div>
              )}
              <button type="button" className={menuItem} onClick={() => { nav.go('/settings'); setUserMenuOpen(false) }}>
                <Settings className="size-4 text-muted-foreground" />Settings
              </button>
              <button type="button" className={menuItem} onClick={() => { nav.go('/help'); setUserMenuOpen(false) }}>
                <LifeBuoy className="size-4 text-muted-foreground" />Help & Guides
              </button>
              <button type="button" className={menuItem} onClick={() => { nav.go('/leads'); setUserMenuOpen(false) }}>
                <Inbox className="size-4 text-muted-foreground" /><span className="flex-1">Job leads</span>
                {pendingLeads && pendingLeads.length > 0 && <span className="font-mono text-[12px] text-subtle-foreground">{pendingLeads.length}</span>}
              </button>
              <button type="button" className={menuItem} onClick={toggleTheme}>
                {theme === 'dark' ? <Sun className="size-4 text-muted-foreground" /> : <Moon className="size-4 text-muted-foreground" />}
                {theme === 'dark' ? 'Light mode' : 'Dark mode'}
              </button>
              <Link href="/pricing" className={menuItem} onClick={() => {
                setUserMenuOpen(false)
                if (!(isPro || isProAnnual)) trackUpgradeClicked({ surface: 'sidebar', authenticated: true })
              }}>
                <CreditCard className="size-4 text-muted-foreground" />{isPro || isProAnnual ? 'Manage my plan' : 'Upgrade your plan'}
              </Link>
              <Link href="/" className={menuItem} onClick={() => setUserMenuOpen(false)}>
                <Home className="size-4 text-muted-foreground" />Landing page
              </Link>
              <button type="button" className={cn(menuItem, "border-t border-border text-destructive")} onClick={() => { handleSignOut(); setUserMenuOpen(false) }}>
                <LogOut className="size-4" />Sign out
              </button>
            </PopoverContent>
          </Popover>
        ) : (
          <Button asChild variant="outline" className="w-full justify-start gap-2">
            <Link href="/auth"><LogIn className="size-4" />Sign in</Link>
          </Button>
        )}
      </div>

      <Dialog open={threadToDelete !== null} onOpenChange={(o) => { if (!o) setThreadToDelete(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this chat?</DialogTitle>
            <DialogDescription>The conversation is removed for good.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setThreadToDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <JkSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
      <JkUpgradeModal
        isOpen={upgradeModal.isOpen}
        onClose={() => setUpgradeModal((prev) => ({ ...prev, isOpen: false }))}
        feature={upgradeModal.feature}
        currentLimit={upgradeModal.currentLimit}
        currentPlan={upgradeModal.currentPlan}
      />
    </div>
  )
}
