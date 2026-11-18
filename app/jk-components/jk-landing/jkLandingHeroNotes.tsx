'use client'

/**
 * The two cards pinned either side of the hero buttons (desktop, from xl). Each is a
 * piece of the real app playing its own short loop:
 * - left: a My Jobs row whose status moves Interested > Applied > Interviewing > Offered
 * - right: the Must-haves meter from a tailored resume filling to 8 of 10
 * Sample data only. With reduced motion both sit still on their finished state.
 */
import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { JkStatusGlyph } from "../jkStatusChip";
import { STATUS_TEXT, statusKey } from "@/lib/jkStatus";
import { cn } from "@/lib/utils";

const STATUSES = ["Interested", "Applied", "Interviewing", "Offered"];
const TICK_MS = 420;
const STATUS_TICKS = 7; // ticks each status stays up
const MET = 8;
const TOTAL = 10;
const METER_TICKS = 22; // fill, hold, reset

const card = "jk-enter absolute hidden rounded-[18px] border border-hero-ink/20 bg-background/60 px-5 text-left backdrop-blur-[2px] xl:block";

export default function JkLandingHeroNotes() {
  const reduce = useReducedMotion();
  const [t, setT] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => setT((v) => v + 1), TICK_MS);
    return () => window.clearInterval(id);
  }, [reduce]);

  const status = reduce ? "Interviewing" : STATUSES[Math.floor(t / STATUS_TICKS) % STATUSES.length];
  const m = t % METER_TICKS;
  const met = reduce ? MET : Math.min(MET, m);
  const written = reduce || m > MET;

  return (
    <>
      <div aria-hidden style={{ "--i": 6 } as React.CSSProperties} className={cn(card, "left-24 top-[474px] h-[84px] w-[268px] pt-[15px]")}>
        <p className="font-mono text-[9.5px] font-medium uppercase tracking-[1.2px] text-bar-4-ink">My Jobs</p>
        <div className="mt-[7px] flex items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] border border-hero-ink/20 bg-hero-ink/10 text-[13px] font-medium text-hero-ink">N</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-medium leading-[18px] text-hero-ink">Applied AI Engineer</p>
            <p className="mt-[3px] flex items-center gap-2 text-[12.5px] leading-[15px]">
              <span className="truncate text-hero-ink/75">Northwind Labs</span>
              <span key={status} className={cn("flex shrink-0 items-center gap-1.5 [animation:jk-enter_0.5s_cubic-bezier(0.16,1,0.3,1)_both]", STATUS_TEXT[statusKey(status)])}>
                <JkStatusGlyph status={status} className="size-[11px]" />{status}
              </span>
            </p>
          </div>
        </div>
      </div>

      <div aria-hidden style={{ "--i": 7 } as React.CSSProperties} className={cn(card, "right-24 top-[468px] h-24 w-[262px] pt-[15px]")}>
        <div className="flex items-baseline justify-between">
          <p className="text-[15px] font-medium leading-[18px] text-hero-ink">Must-haves</p>
          <p className="font-mono text-[13px] font-medium text-hero-ink">{met}/{TOTAL}</p>
        </div>
        <div className="mt-[12px] flex gap-[6px]">
          {Array.from({ length: TOTAL }, (_, i) => (
            <span key={i} className={cn("h-[5px] flex-1 rounded-full transition-colors duration-300", i < met ? "bg-bar-4" : "bg-hero-ink/20")} />
          ))}
        </div>
        <p className={cn("mt-[14px] font-mono text-[9.5px] uppercase tracking-[1px] text-hero-ink/75 transition-opacity duration-500", written ? "opacity-100" : "opacity-0")}>Resume written · 1 page</p>
      </div>
    </>
  );
}
