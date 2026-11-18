'use client'

/**
 * Phone + tablet shell (below `lg`), from M01 / M03 / M10:
 *
 *   <JkAppMobileHeader onBack={…} onMenu={…} extra={…} />   sticky 56px bar: logo (or back arrow on
 *        sub-screens), short title + real count, search, menu. `extra` adds a control before search.
 *   <JkAppMobileMenu open onClose />                           menu (M10), circle reveal from the menu button. Full screen on
 *        phones; from 640px it is a 440px panel on the right over a dimmed page, so it never sits as a thin column in a wide void.
 *   <JkAppTabBar onMore />                                     bottom tabs Jobs / Docs / Chat / More.
 *
 * The shell (jkConsole.tsx) sets --jk-tabbar-h on its root so fixed bottom UI (chat input,
 * floating "Add job") can sit above the tab bar: `bottom: calc(var(--jk-tabbar-h) + 16px)`.
 */
import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { BriefcaseBusiness, ChevronLeft, FileText, LayoutGrid, MessageCircle, Search, type LucideIcon } from "lucide-react";
import { useAuthActions } from "@convex-dev/auth/react";
import { mainAssets } from "@/app/lib/constants";
import { useAuth } from "@/providers/jkAuthProvider";
import { useJobKompassChatWindow } from "@/providers/jkChatWindowProvider";
import { cn } from "@/lib/utils";
import JkThemeSwitch from "../jkThemeSwitch";
import JkSignOutButton from "../jkSignOutButton";
import { JkNavRow, JkUserChipBody } from "../jkSIdebar";
import { JK_TABS, JK_TOP_LEVEL, useJkAppNav } from "./jkAppNav";

const EASE = [0.16, 1, 0.3, 1] as const;
const TAB_ICON: Record<string, LucideIcon> = { "/my-jobs": BriefcaseBusiness, "/documents": FileText, "/chat": MessageCircle, more: LayoutGrid };

export function JkAppMobileHeader({ onBack, onMenu, onSearch, extra, menuOpen }: {
  onBack: () => void;
  onMenu: () => void;
  onSearch: () => void;
  extra?: React.ReactNode;
  menuOpen: boolean;
}) {
  const nav = useJkAppNav();
  const top = JK_TOP_LEVEL.includes(nav.currentId);
  const count = nav.count(nav.currentId);
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center border-b border-border bg-background pl-5 pr-2.5 pt-[env(safe-area-inset-top)] lg:hidden">
      {top ? (
        <Image src={mainAssets.logo} alt="JobKompass" width={30} height={28} className="mr-1.5 h-7 w-[30px] shrink-0 object-contain" />
      ) : (
        <button type="button" onClick={onBack} aria-label="Back" className="-ml-2 mr-1 flex size-9 shrink-0 items-center justify-center rounded-full text-foreground hover:bg-accent">
          <ChevronLeft className="size-5" strokeWidth={1.8} />
        </button>
      )}
      <h1 key={nav.currentId} className="min-w-0 truncate text-[20px] font-semibold leading-6 tracking-[-0.3px] text-foreground [animation:jk-enter_0.5s_cubic-bezier(0.16,1,0.3,1)_both]">
        {nav.title(nav.currentId)}
      </h1>
      {count !== null && <span className="ml-7 shrink-0 font-mono text-[12px] text-subtle-foreground">{count}</span>}
      <div className="ml-auto flex shrink-0 items-center">
        {extra}
        <button type="button" onClick={onSearch} aria-label="Search" className="flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground">
          <Search className="size-[18px]" strokeWidth={1.8} />
        </button>
        <button
          type="button"
          onClick={onMenu}
          aria-label="Open menu"
          aria-expanded={menuOpen}
          aria-controls="jk-app-menu"
          className="flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <span aria-hidden className="flex w-4 flex-col gap-[3.5px]">
            <span className="h-[1.6px] rounded-full bg-current" />
            <span className="h-[1.6px] rounded-full bg-current" />
            <span className="h-[1.6px] rounded-full bg-current" />
          </span>
        </button>
      </div>
    </header>
  );
}

export function JkAppMobileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const reduce = useReducedMotion();
  const nav = useJkAppNav();
  const { user, isAuthenticated } = useAuth();
  const { setCurrentThreadId } = useJobKompassChatWindow();
  const { signOut } = useAuthActions();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    closeRef.current?.focus();
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [open, onClose]);

  // Close if the window grows past the phone shell.
  useEffect(() => {
    if (!open) return;
    const mq = window.matchMedia("(min-width: 1024px)");
    const on = () => { if (mq.matches) onClose(); };
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [open, onClose]);

  const go = (id: string) => { if (id === "/chat") setCurrentThreadId(null); nav.go(id); onClose(); };
  // The menu button sits 32px in from the right edge, 28px down: the reveal grows from there.
  const from = "circle(0px at calc(100% - 32px) 28px)";
  const to = "circle(150% at calc(100% - 32px) 28px)";
  const rise = (i: number) => ({
    initial: reduce ? false : { opacity: 0, y: 22 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.55, delay: reduce ? 0 : 0.14 + i * 0.05, ease: EASE },
  } as const);
  const secondary = "block w-full py-2.5 text-left text-[16px] leading-[19px] text-muted-foreground transition-colors hover:text-foreground";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="scrim"
          aria-hidden
          onClick={onClose}
          className="fixed inset-0 z-[59] hidden bg-scrim sm:block lg:hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        />
      )}
      {open && (
        <motion.div
          key="menu"
          id="jk-app-menu"
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          className="fixed inset-y-0 right-0 z-[60] flex w-full flex-col overflow-y-auto bg-card sm:w-[440px] sm:border-l sm:border-border sm:shadow-2xl lg:hidden"
          initial={reduce ? { opacity: 0 } : { clipPath: from }}
          animate={reduce ? { opacity: 1 } : { clipPath: to }}
          exit={reduce ? { opacity: 0 } : { clipPath: from }}
          transition={{ duration: reduce ? 0.2 : 0.6, ease: EASE }}
        >
          <div className="flex w-full flex-1 flex-col px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)] sm:px-7">
            <div className="flex h-14 shrink-0 items-center justify-between">
              <Link href="/" onClick={onClose} className="flex items-center gap-2">
                <Image src={mainAssets.logo} alt="" width={32} height={30} className="h-[30px] w-8 object-contain" />
                <span className="text-[20px] font-bold leading-6 tracking-[-0.2px] text-foreground">JobKompass</span>
              </Link>
              <button ref={closeRef} type="button" onClick={onClose} aria-label="Close menu"
                className="group -mr-2.5 flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground">
                <span className="relative block size-[13px]">
                  <span className="absolute left-0 top-1/2 h-[1.6px] w-[15px] -translate-x-px rotate-45 rounded-full bg-current" />
                  <span className="absolute left-0 top-1/2 h-[1.6px] w-[15px] -translate-x-px -rotate-45 rounded-full bg-current" />
                </span>
              </button>
            </div>

            <nav aria-label="App" className="mt-[18px] flex flex-col">
              {nav.items.map((item, i) => (
                <motion.div key={item.id} {...rise(i)}>
                  <JkNavRow size="lg" label={item.label} count={item.count} tick={item.tick} active={nav.currentId === item.id} onClick={() => go(item.id)} />
                </motion.div>
              ))}
            </nav>

            <div aria-hidden className="min-h-10 flex-1" />
            <motion.div {...rise(6)} className="border-t border-border pb-6 pt-3.5">
              <button type="button" className={secondary} onClick={() => go("/settings")}>Settings</button>
              <button type="button" className={secondary} onClick={() => go("/help")}>Help & Guides</button>
              <Link href="/" onClick={onClose} className={secondary}>Landing page</Link>
            </motion.div>

            <motion.div {...rise(7)} className="border-t border-border pt-6">
              {isAuthenticated && user ? (
                <>
                  <button type="button" onClick={() => go("/settings")} aria-label="Account settings" className="w-full pr-5">
                    <JkUserChipBody size="lg" />
                  </button>
                  <div className="mt-5 flex items-center justify-between">
                    <JkSignOutButton className="text-[14px] hover:underline" onConfirm={async () => { onClose(); setCurrentThreadId(null); await signOut(); }} />
                    <JkThemeSwitch />
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-between">
                  <Link href="/auth" onClick={onClose} className="text-[16px] font-medium text-foreground">Sign in</Link>
                  <JkThemeSwitch />
                </div>
              )}
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function JkAppTabBar({ onMore, moreOpen }: { onMore: () => void; moreOpen: boolean }) {
  const nav = useJkAppNav();
  const { setCurrentThreadId } = useJobKompassChatWindow();
  const inTabs = JK_TABS.some((t) => t.id === nav.currentId);
  const reduce = useReducedMotion();
  return (
    <nav aria-label="Tabs" className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] lg:hidden">
      <ul className="mx-auto grid h-[60px] max-w-[520px] grid-cols-4">
        {JK_TABS.map((t) => {
          const on = t.id === "more" ? moreOpen || !inTabs : nav.currentId === t.id;
          const Icon = TAB_ICON[t.id];
          return (
            <li key={t.id}>
              <button
                type="button"
                aria-current={on ? "page" : undefined}
                onClick={() => {
                  if (t.id === "more") return onMore();
                  if (t.id === "/chat" && nav.currentId === "/chat") setCurrentThreadId(null);
                  nav.go(t.id);
                }}
                className={cn("flex h-full w-full flex-col items-center justify-center gap-[3px] text-[11.5px] leading-[14px] transition-colors", on ? "font-semibold text-foreground" : "text-subtle-foreground hover:text-muted-foreground")}
              >
                <span className="relative flex h-[30px] w-[58px] items-center justify-center">
                  {on && <motion.span layoutId="jk-tab-pill" aria-hidden className="absolute inset-0 rounded-full bg-accent" transition={{ duration: reduce ? 0 : 0.35, ease: EASE }} />}
                  <Icon aria-hidden className="relative size-[19px]" strokeWidth={on ? 2 : 1.7} />
                </span>
                {t.label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
