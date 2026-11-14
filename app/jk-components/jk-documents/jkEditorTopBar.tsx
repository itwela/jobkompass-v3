'use client'

import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export type JkSaveState = "saved" | "unsaved" | "saving" | "error";

/** D08 status pill: SAVED (green) / SAVING / UNSAVED / NOT SAVED. */
export function JkSavePill({ state, className }: { state: JkSaveState; className?: string }) {
  const label = { saved: "Saved", unsaved: "Unsaved", saving: "Saving", error: "Not saved" }[state];
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn(
        "inline-flex h-[18px] shrink-0 items-center rounded-full px-[7px] font-mono text-[9.5px] font-bold uppercase leading-none tracking-[0.8px]",
        state === "saved" && "bg-ok/14 text-ok",
        state === "saving" && "bg-accent text-muted-foreground",
        state === "unsaved" && "bg-accent text-subtle-foreground",
        state === "error" && "bg-destructive/14 text-destructive",
        className,
      )}
    >
      {label}
    </span>
  );
}

/**
 * Top of the editor (D08 72px bar / M15 sub-row): back, "My Documents / name",
 * save status, and the actions on the right (desktop only — phones get a bottom bar).
 */
export function JkEditorTopBar({ title, onBack, status, aside, actions }: {
  title: string;
  onBack: () => void;
  status?: React.ReactNode;
  /** Small mono text on the right on phones (linked company). */
  aside?: string | null;
  actions?: React.ReactNode;
}) {
  return (
    <div className="jk-enter flex shrink-0 items-center gap-3 border-b border-border px-5 py-3.5 lg:h-[72px] lg:px-8 lg:py-0">
      <button type="button" onClick={onBack} aria-label="Back to My Documents" className="-ml-2 flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground lg:-ml-2.5">
        <ChevronLeft className="size-[18px]" strokeWidth={1.7} />
      </button>
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-[15px] leading-[18px] lg:text-[13px] lg:leading-[15px]">
        <button type="button" onClick={onBack} className="hidden shrink-0 text-muted-foreground transition-colors hover:text-foreground lg:inline">My Documents</button>
        <span aria-hidden className="hidden text-subtle-foreground lg:inline">/</span>
        <span className="min-w-0 truncate text-foreground lg:font-medium">{title}</span>
      </nav>
      {status && <span className="shrink-0 lg:ml-6">{status}</span>}
      {aside && <span className="ml-auto shrink-0 truncate font-mono text-[11px] uppercase tracking-[0.6px] text-subtle-foreground lg:hidden">{aside}</span>}
      {actions && <div className="ml-auto hidden shrink-0 items-center gap-2 lg:flex">{actions}</div>}
    </div>
  );
}
