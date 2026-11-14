'use client'

import { cn } from "@/lib/utils";

export type JkDocFilter = "all" | "resume" | "cover-letter" | "favorites";

/**
 * D07 / M06 filter pills: "All 170" (active = gold outline on --accent), then
 * tinted pills with a dot for Resumes (bar-2), Cover letters (bar-3), Favorites (bar-1).
 * Phones scroll the row sideways and fade it out at the right edge.
 */
export default function JkDocFilterTabs({ value, onChange, counts }: {
  value: JkDocFilter;
  onChange: (v: JkDocFilter) => void;
  counts: Record<JkDocFilter, number>;
}) {
  const items: { id: JkDocFilter; label: string; dot?: string }[] = [
    { id: "all", label: "All" },
    { id: "resume", label: "Resumes", dot: "var(--bar-2)" },
    { id: "cover-letter", label: "Cover letters", dot: "var(--bar-3)" },
    { id: "favorites", label: "Favorites", dot: "var(--bar-1)" },
  ];
  return (
    <div className="relative -mx-5 lg:mx-0">
      <div role="tablist" aria-label="Filter documents" className="no-scrollbar flex gap-2 overflow-x-auto px-5 lg:px-0">
        {items.map((it) => {
          const active = value === it.id;
          return (
            <button
              key={it.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(it.id)}
              className={cn(
                "flex h-9 shrink-0 items-center gap-2.5 rounded-full border px-4 text-[14px] font-medium leading-4 text-foreground transition-colors lg:h-8 lg:text-[13.5px]",
                active ? "border-[1.5px] border-plan bg-accent" : "border-transparent hover:brightness-110",
              )}
              style={!active && it.dot ? { background: `color-mix(in srgb, ${it.dot} 14%, transparent)` } : undefined}
            >
              {it.dot && <span aria-hidden className="size-2 rounded-full" style={{ background: it.dot }} />}
              {it.label}
              <span className={cn("font-mono text-[12px] leading-4", active ? "font-medium text-foreground" : "text-muted-foreground")}>{counts[it.id]}</span>
            </button>
          );
        })}
      </div>
      <span aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-[60px] bg-gradient-to-l from-background to-transparent lg:hidden" />
    </div>
  );
}
