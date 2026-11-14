'use client'

/**
 * Small pieces shared by every My Jobs surface (D03 table + rail, D04 cards, D05/D06 dialogs,
 * M01/M02/M13 phone screens).
 *
 *   <JkCompBars compensation="$150k - $180k" />   pay band as $–$$$$, unlit marks in --border-strong
 *   <JkJobLogo job={job} size={20} />            employer logo (favicon by domain, monogram fallback)
 *   <JkKbd>J</JkKbd>                             keyboard hint chip
 *   <JkMonoLabel>Keywords</JkMonoLabel>          mono caps field label
 *   <JkJobsDialog …/>                            centred dialog on desktop, sheet or page on phones
 */
import { useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { compTier, companyDomain } from "@/lib/jkJobs";
import JkCompanyLogo from "../jkCompanyLogo";
import JkArt, { type JkArtName } from "../jkArt";

const EASE = [0.16, 1, 0.3, 1] as const;

export function JkCompBars({ compensation, className }: { compensation?: string | null; className?: string }) {
  const tier = compTier(compensation);
  if (tier === 0) {
    return <span className={cn("font-mono text-[12px] font-medium text-subtle-foreground", className)} title={compensation || "No pay listed"}>-</span>;
  }
  return (
    <span className={cn("whitespace-nowrap font-mono text-[12px] font-medium", className)} title={compensation ?? undefined} aria-label={`Pay band ${tier} of 4${compensation ? `: ${compensation}` : ""}`}>
      <span className="text-foreground">{"$".repeat(tier)}</span>
      <span className="text-border-strong">{"$".repeat(4 - tier)}</span>
    </span>
  );
}

export function JkJobLogo({ company, link, size = 20, className }: { company: string; link?: string | null; size?: number; className?: string }) {
  return (
    <JkCompanyLogo
      company={company}
      domain={companyDomain(link, company)}
      size="sm"
      className={cn("border-border-strong bg-accent", className)}
      // Frame sizes: 20 (table), 16 (cards), 44 (rail). Radius ~30% of the edge.
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.3), fontSize: Math.max(8, Math.round(size * 0.5)) }}
    />
  );
}

export function JkKbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd className={cn("inline-flex h-5 min-w-[22px] items-center justify-center rounded-md border border-input px-1 font-mono text-[9.5px] font-normal text-muted-foreground", className)}>
      {children}
    </kbd>
  );
}

export function JkMonoLabel({ children, className, as: Tag = "span", htmlFor }: { children: React.ReactNode; className?: string; as?: "span" | "label" | "p"; htmlFor?: string }) {
  return (
    <Tag htmlFor={htmlFor} className={cn("font-mono text-[10px] uppercase leading-[13px] tracking-[0.12em] text-subtle-foreground", className)}>
      {children}
    </Tag>
  );
}

/**
 * Dialog for My Jobs. Desktop: centred card with a painting band behind its header (D05, D06).
 * Below `md`: `mobile="sheet"` slides up from the bottom (M13), `mobile="page"` covers the screen (M02).
 */
export function JkJobsDialog({
  open, onClose, label, width = 840, art = "hero", artHeight = 129, header, footer, children, mobile = "sheet", mobileHeader, className,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  width?: number;
  art?: JkArtName | null;
  artHeight?: number;
  header: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  mobile?: "sheet" | "page";
  /** Phone page only: replaces the card header (M02 has its own back bar). */
  mobileHeader?: React.ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  const page = mobile === "page";
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="jk-jobs-dialog"
          className={cn("fixed inset-0 z-50 flex justify-center md:items-center md:p-6", page ? "items-stretch" : "items-end")}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.2 }}
          data-jk-dialog
        >
          <button type="button" aria-label="Close" tabIndex={-1} onClick={onClose} className="absolute inset-0 cursor-default bg-scrim" />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            initial={reduce ? false : { y: 28, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { y: 20, opacity: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
            style={{ "--jk-dialog-w": `${width}px` } as React.CSSProperties}
            className={cn(
              "relative flex w-full flex-col overflow-hidden border-input bg-popover md:max-h-[calc(100dvh-48px)] md:w-[var(--jk-dialog-w)] md:max-w-full md:rounded-[28px] md:border",
              page ? "h-dvh bg-background md:h-auto md:bg-popover" : "max-h-[92dvh] rounded-t-[32px] border-t md:rounded-b-[28px]",
              className,
            )}
          >
            {page && mobileHeader && <div className="md:hidden">{mobileHeader}</div>}
            <div className={cn("relative isolate shrink-0", page && mobileHeader && "hidden md:block")}>
              {!page && <div aria-hidden className="mx-auto mt-3 h-1 w-10 rounded-full bg-border-strong md:hidden" />}
              {art && (
                <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 hidden overflow-hidden md:block" style={{ height: artHeight }}>
                  <JkArt name={art} variant="section" fade="none" position="right 30%" />
                  <div className="absolute inset-0 bg-popover/30" />
                  <div className="absolute inset-0 bg-gradient-to-r from-popover via-popover/80 via-40% to-transparent to-75%" />
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent from-40% to-popover" />
                </div>
              )}
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="absolute right-6 top-6 z-10 hidden size-9 items-center justify-center rounded-full text-foreground/80 transition-colors hover:bg-accent hover:text-foreground md:flex"
              >
                <X className="size-[18px]" strokeWidth={1.6} />
              </button>
              {header}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
            {footer}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
