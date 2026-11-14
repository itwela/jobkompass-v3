'use client'

import { useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { mainAssets } from "@/app/lib/constants";
import JkPaintingLoop from "./jkPaintingLoop";
import JkThemeSwitch from "./jkThemeSwitch";
import JkGetStartedButton from "./jkGetStartedButton";
import { HERO_LOOP_FRAGMENT, HERO_LOOP_SECONDS, HERO_LOOP_SPACE } from "./jk-landing/jkHeroLoopShader";

// Anchored on Open (full-screen, oversized links), Tesla (one-line subtitle under each
// item) and Peacock (the page blurs behind the menu).
const LINKS: { label: string; note: string; href: string }[] = [
  { label: "Product", note: "Save, write, track, prep", href: "/#product" },
  { label: "Pricing", note: "Start free, upgrade when it gets busy", href: "/pricing" },
  { label: "CLI", note: "Let your AI agent run the search", href: "/#cli" },
  { label: "Free resume generator", note: "No account needed", href: "/free-resume-generator" },
];

const EASE = [0.16, 1, 0.3, 1] as const;

/** Full-screen navigation for phones and tablets. The circle of light grows out of the menu button. */
export default function JkMobileMenu({ open, onClose, isAuthenticated }: { open: boolean; onClose: () => void; isAuthenticated: boolean }) {
  const reduce = useReducedMotion();
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

  // The menu button sits 40px in from the right edge and 68px down; the reveal starts there.
  const from = "circle(0px at calc(100% - 40px) 68px)";
  const to = "circle(150% at calc(100% - 40px) 68px)";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          id="jk-mobile-nav"
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          className="fixed inset-0 z-[60] flex flex-col overflow-y-auto bg-background/88 backdrop-blur-xl lg:hidden"
          initial={reduce ? { opacity: 0 } : { clipPath: from }}
          animate={reduce ? { opacity: 1 } : { clipPath: to }}
          exit={reduce ? { opacity: 0 } : { clipPath: from }}
          transition={{ duration: reduce ? 0.2 : 0.7, ease: EASE }}
        >
          {/* The live hero painting, as a band behind the top of the menu. */}
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[300px] overflow-hidden">
            <div className="absolute right-0 top-0 aspect-video h-full [mask-image:linear-gradient(to_bottom,black_30%,transparent),linear-gradient(to_left,black_55%,transparent)] [mask-composite:intersect]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/v4/hero-night.webp" alt="" className="absolute inset-0 hidden size-full object-cover opacity-70 dark:block" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/v4/hero-day.webp" alt="" className="absolute inset-0 block size-full object-cover opacity-80 dark:hidden" />
              <JkPaintingLoop src="/images/v4/hero-night.webp" fragment={HERO_LOOP_FRAGMENT} loopSeconds={HERO_LOOP_SECONDS} space={HERO_LOOP_SPACE} className="absolute inset-0 hidden size-full opacity-70 dark:block" />
              <JkPaintingLoop src="/images/v4/hero-day.webp" fragment={HERO_LOOP_FRAGMENT} loopSeconds={HERO_LOOP_SECONDS} space={HERO_LOOP_SPACE} setup={(gl, U) => gl.uniform1f(U("u_day"), 1)} className="absolute inset-0 block size-full opacity-80 dark:hidden" />
            </div>
          </div>

          {/* Top bar: same geometry as the header, so the X lands where the menu button was. */}
          <div className="relative flex h-[136px] shrink-0 items-center justify-between px-5 sm:px-6">
            <Link href="/" onClick={onClose} className="flex items-center gap-1.5">
              <Image src={mainAssets.logo} alt="JobKompass" width={30} height={30} className="shrink-0 object-contain" />
              <span className="text-[19px] font-bold tracking-[-0.2px] text-foreground">JobKompass</span>
            </Link>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="Close menu"
              className="group -mr-2 flex size-10 items-center justify-center rounded-full text-foreground transition-colors hover:bg-foreground/10"
            >
              <span className="relative block size-4">
                <span className="absolute left-0 top-1/2 h-[1.5px] w-4 rotate-45 rounded-full bg-current transition-transform duration-300 group-hover:rotate-[135deg]" />
                <span className="absolute left-0 top-1/2 h-[1.5px] w-4 -rotate-45 rounded-full bg-current transition-transform duration-300 group-hover:rotate-45" />
              </span>
            </button>
          </div>

          <nav className="relative flex-1 px-5 pt-6 sm:px-6">
            <ul className="space-y-2">
              {LINKS.map((l, i) => (
                <motion.li
                  key={l.label}
                  initial={reduce ? false : { opacity: 0, y: 28 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? undefined : { opacity: 0, y: 12, transition: { duration: 0.15 } }}
                  transition={{ duration: 0.55, delay: reduce ? 0 : 0.18 + i * 0.07, ease: EASE }}
                >
                  <Link
                    href={l.href}
                    onClick={onClose}
                    className="group -mx-3 flex items-center gap-4 rounded-[22px] border border-transparent px-3 py-3.5 transition-[background-color,border-color,transform] duration-300 hover:border-border hover:bg-card/80 active:scale-[0.98]"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-balance text-[32px] font-medium leading-[36px] tracking-[-0.8px] text-foreground">{l.label}</span>
                      <span className="mt-1 block text-[13px] leading-[18px] text-muted-foreground">{l.note}</span>
                    </span>
                    <ArrowUpRight className="size-5 shrink-0 -translate-x-1 text-subtle-foreground opacity-50 transition-all duration-300 group-hover:translate-x-0 group-hover:-translate-y-0.5 group-hover:text-foreground group-hover:opacity-100" />
                  </Link>
                </motion.li>
              ))}
            </ul>
          </nav>

          <motion.div
            className="relative shrink-0 border-t border-border px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-5 sm:px-6"
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: reduce ? 0 : 0.5, ease: EASE }}
          >
            <JkGetStartedButton size="lg" surface="header" label="Get started free" className="jk-fx jk-fx-cream h-[52px] w-full text-[15.5px]" />
            <div className="mt-4 flex items-center justify-between">
              {isAuthenticated ? (
                <Link href="/app" onClick={onClose} className="text-[15px] font-medium text-foreground underline-offset-4 hover:underline">Go to the app</Link>
              ) : (
                <Link href="/auth" onClick={onClose} className="text-[15px] font-medium text-foreground underline-offset-4 hover:underline">Log in</Link>
              )}
              <JkThemeSwitch />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
