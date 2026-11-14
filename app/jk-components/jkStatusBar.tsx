'use client'

import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { STATUS_BG, segmentWidths, statusKey, type StatusCount } from "@/lib/jkStatus";

interface JkStatusBarProps {
  counts: StatusCount[];
  /** Status currently filtered to, or null for all. */
  active?: string | null;
  /** Omit to render a read-only bar. */
  onSelect?: (status: string | null) => void;
  /** Interactive bar only: bar thickness. "md" = 8px (D03), "sm" = 5px (M01, no tooltip). */
  size?: "md" | "sm";
  className?: string;
}

/**
 * Segmented bar of job statuses. Interactive (D03): each segment is the filter for its status;
 * hovering one lifts it and shows "Applied 38 of 236 | CLICK TO FILTER" above it.
 */
export default function JkStatusBar({ counts, active = null, onSelect, size = "md", className }: JkStatusBarProps) {
  const [hover, setHover] = useState<string | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const [tipPos, setTipPos] = useState<{ left: number; caret: number } | null>(null);
  const segments = segmentWidths(counts).filter((s) => s.width > 0);
  const total = counts.reduce((a, c) => a + (c.count > 0 ? c.count : 0), 0);
  const shown = segments.find((s) => s.status === (hover ?? active));

  // Centre of the shown segment, in % of the bar, for the tooltip.
  let left = 0;
  let centre = 50;
  for (const s of segments) {
    if (s.status === shown?.status) { centre = left + s.width / 2; break; }
    left += s.width;
  }
  const md = size === "md";
  const shownStatus = shown?.status ?? null;

  // Place the tooltip over the segment's centre, kept inside the bar.
  useLayoutEffect(() => {
    const bar = barRef.current, tip = tipRef.current;
    if (!bar || !tip || !shownStatus) { setTipPos(null); return; }
    const w = bar.offsetWidth, tw = tip.offsetWidth, c = (centre / 100) * w;
    const l = Math.max(0, Math.min(w - tw, c - tw / 2));
    setTipPos({ left: l, caret: Math.max(12, Math.min(tw - 18, c - l - 6)) });
  }, [shownStatus, centre]);

  if (segments.length === 0) {
    return <div className={cn("h-2 w-full rounded-full bg-muted", className)} aria-hidden />;
  }

  if (!onSelect) {
    return (
      <div className={cn("w-full", className)}>
        <div className="mb-2 flex h-6 items-center justify-end">
          {shown && (
            <span className="inline-flex items-center gap-2 rounded-full border border-input bg-popover px-3 py-1 text-xs">
              <span className={cn("size-1.5 rounded-full", STATUS_BG[statusKey(shown.status)])} />
              <span className="font-medium text-foreground">{shown.status}</span>
              <span className="font-mono text-muted-foreground">{shown.count} of {total}</span>
            </span>
          )}
        </div>
        <div className="flex h-2 w-full gap-1" aria-label="Jobs by status">
          {segments.map((s) => (
            <span key={s.status} style={{ width: `${s.width}%` }} className={cn("h-full min-w-1.5 rounded-full", STATUS_BG[statusKey(s.status)])} title={`${s.status}: ${s.count}`} />
          ))}
        </div>
      </div>
    );
  }


  return (
    <div className={cn("relative w-full", md ? "pt-0" : "", className)}>
      {md && shown && (
        <div
          ref={tipRef}
          role="status"
          className="pointer-events-none absolute bottom-full z-10 mb-3.5 flex h-9 items-center gap-2 whitespace-nowrap rounded-xl border border-border-strong bg-accent px-3 text-[13.5px] shadow-lg [animation:jk-enter_0.25s_cubic-bezier(0.16,1,0.3,1)_both]"
          style={{ left: tipPos?.left ?? 0, visibility: tipPos ? "visible" : "hidden" }}
        >
          <span className={cn("size-2 rounded-full", STATUS_BG[statusKey(shown.status)])} />
          <span className="font-medium text-foreground">{shown.status}</span>
          <span className="font-mono text-[12px] text-muted-foreground">{shown.count} of {total}</span>
          <span aria-hidden className="mx-0.5 h-3.5 w-px bg-border-strong" />
          <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-subtle-foreground">
            {active === shown.status ? "Click to clear" : "Click to filter"}
          </span>
          <span aria-hidden className="absolute -bottom-[7px] size-3 rotate-45 border-b border-r border-border-strong bg-accent" style={{ left: tipPos?.caret ?? 12 }} />
        </div>
      )}
      <div ref={barRef} className={cn("flex w-full items-center gap-[3px]", md ? "h-3" : "h-[5px]")} role="group" aria-label="Filter jobs by status">
        {segments.map((s) => {
          const on = (hover ?? active) === s.status;
          const dim = active !== null && active !== s.status && hover !== s.status;
          return (
            <button
              key={s.status}
              type="button"
              style={{ width: `${s.width}%` }}
              className={cn(
                "min-w-1.5 cursor-pointer rounded-full transition-[height,opacity] duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                STATUS_BG[statusKey(s.status)],
                md ? (on ? "h-3" : "h-2") : "h-[5px]",
                dim && "opacity-30",
              )}
              aria-pressed={active === s.status}
              aria-label={`${s.status}: ${s.count} of ${total}`}
              onMouseEnter={() => setHover(s.status)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(s.status)}
              onBlur={() => setHover(null)}
              onClick={() => onSelect(active === s.status ? null : s.status)}
            />
          );
        })}
      </div>
    </div>
  );
}
