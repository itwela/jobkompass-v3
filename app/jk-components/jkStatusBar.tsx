'use client'

import { useState } from "react";
import { cn } from "@/lib/utils";
import { STATUS_BG, segmentWidths, statusKey, type StatusCount } from "@/lib/jkStatus";

interface JkStatusBarProps {
  counts: StatusCount[];
  /** Status currently filtered to, or null for all. */
  active?: string | null;
  /** Omit to render a read-only bar. */
  onSelect?: (status: string | null) => void;
  className?: string;
}

/** Segmented bar of job statuses. Each segment is also the filter for that status. */
export default function JkStatusBar({ counts, active = null, onSelect, className }: JkStatusBarProps) {
  const [hover, setHover] = useState<string | null>(null);
  const segments = segmentWidths(counts).filter((s) => s.width > 0);
  const total = counts.reduce((a, c) => a + (c.count > 0 ? c.count : 0), 0);
  const shown = segments.find((s) => s.status === (hover ?? active));

  if (segments.length === 0) {
    return <div className={cn("h-2 w-full rounded-full bg-muted", className)} aria-hidden />;
  }
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
      <div className="flex h-2 w-full gap-1" role={onSelect ? "group" : undefined} aria-label="Jobs by status">
        {segments.map((s) => {
          const dim = active !== null && active !== s.status;
          const cls = cn("h-full min-w-1.5 rounded-full transition-opacity", STATUS_BG[statusKey(s.status)], dim && "opacity-30");
          return onSelect ? (
            <button
              key={s.status}
              type="button"
              style={{ width: `${s.width}%` }}
              className={cn(cls, "cursor-pointer hover:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring")}
              aria-pressed={active === s.status}
              aria-label={`${s.status}: ${s.count} of ${total}`}
              onMouseEnter={() => setHover(s.status)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(s.status)}
              onBlur={() => setHover(null)}
              onClick={() => onSelect(active === s.status ? null : s.status)}
            />
          ) : (
            <span key={s.status} style={{ width: `${s.width}%` }} className={cls} title={`${s.status}: ${s.count}`} />
          );
        })}
      </div>
    </div>
  );
}
