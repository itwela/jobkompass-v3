'use client'

import { Star, MoreVertical, CheckCircle2, Circle } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import JkDocThumb from "./jkDocThumb";
import { DRAG_MIME } from "./jkDocumentFolderCard";

/**
 * One document on My Documents (D07 269x256 card / M06 171x238 card).
 *
 *   thumbnail panel (--popover) with the real page, favourite star top-right (desktop)
 *   title · "Resume · Mar template" · mono meta ("PTC · Nov 5" or "edited 2 days ago")
 *   the kebab menu is passed in as `menu` (a DropdownMenu), so actions stay with the form.
 *
 * Base resume = gold (--plan) border. Phone shows one mono caps line: "RESUME · MAR · BASE".
 */
export default function JkDocumentCard({
  id, type, title, kindLabel, templateShort, company, edited, dateShort, isBase, isFavorite, isNew,
  content, fileId, selectionMode, selected, onOpen, onToggleFavorite, menu, below, index = 0,
}: {
  id: string;
  type: "resume" | "cover-letter";
  title: string;
  kindLabel: string;
  templateShort: string | null;
  company: string | null;
  edited: string;
  dateShort: string;
  isBase: boolean;
  isFavorite: boolean;
  isNew?: boolean;
  content?: unknown;
  fileId?: Id<"_storage">;
  selectionMode?: boolean;
  selected?: boolean;
  onOpen: () => void;
  onToggleFavorite: () => void;
  menu: React.ReactNode;
  below?: React.ReactNode;
  index?: number;
}) {
  const desktopMeta = company ? `${company} · ${dateShort}` : edited;
  const phoneMeta = [kindLabel, isBase ? templateShort : company ?? templateShort, isBase ? "base" : null].filter(Boolean).join(" · ");
  return (
    <div
      role="button"
      tabIndex={0}
      draggable={!selectionMode}
      data-doc-card
      onDragStart={(event) => {
        if (selectionMode) return;
        event.dataTransfer.setData(DRAG_MIME, JSON.stringify({ id, type }));
        event.dataTransfer.effectAllowed = "move";
      }}
      onClick={onOpen}
      onKeyDown={(event) => {
        const t = event.target as HTMLElement;
        if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable) return;
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpen(); }
      }}
      className={cn(
        "jk-enter group relative flex min-w-0 cursor-pointer flex-col rounded-[18px] border bg-card p-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:rounded-[20px] lg:p-3",
        isBase ? "border-plan" : "border-border hover:border-input",
        selectionMode && selected && "border-ring ring-2 ring-ring/30",
      )}
      style={{ "--i": Math.min(index, 12) } as React.CSSProperties}
    >
      <div className="relative flex h-[150px] items-center justify-center overflow-hidden rounded-[10px] bg-popover lg:rounded-[12px]">
        {/* One page (104x140, D07); phones show it at 91x130 (M06). */}
        <JkDocThumb content={type === "resume" ? content : undefined} fileId={fileId} width={104} height={140} className="origin-center max-lg:scale-[0.9] lg:mt-5 lg:self-start" />
        {selectionMode ? (
          <span className={cn("absolute right-2.5 top-2.5", selected ? "text-ring" : "text-subtle-foreground")}>
            {selected ? <CheckCircle2 className="size-5" /> : <Circle className="size-5" />}
          </span>
        ) : (
          <button
            type="button"
            aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
            aria-pressed={isFavorite}
            onClick={(event) => { event.stopPropagation(); onToggleFavorite(); }}
            className={cn(
              "absolute right-2 top-2 hidden size-8 items-center justify-center rounded-full transition-colors hover:bg-accent lg:flex",
              isFavorite ? "text-bar-1" : "text-subtle-foreground hover:text-foreground",
            )}
          >
            <Star className={cn("size-[15px]", isFavorite && "fill-current")} strokeWidth={1.6} />
          </button>
        )}
        {isNew && !selectionMode && (
          <span className="absolute left-2.5 top-2.5 rounded-full bg-ring/15 px-2 py-0.5 font-mono text-[9.5px] font-bold uppercase tracking-[0.8px] text-ring">New</span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col px-1 pt-3 lg:pt-3.5">
        <p className="truncate text-[13.5px] font-medium leading-4 text-foreground lg:text-[14.5px] lg:leading-[17px]">{title}</p>
        <p className="mt-[5px] hidden truncate text-[12.5px] leading-[15px] text-muted-foreground lg:block">
          {kindLabel}{templateShort ? ` · ${templateShort} template` : ""}
        </p>
        <div className="mt-auto flex items-center gap-2 pt-2.5 lg:pt-3">
          <p className="hidden min-w-0 flex-1 truncate font-mono text-[11px] leading-[15px] text-subtle-foreground lg:block">{desktopMeta}</p>
          <p className="min-w-0 flex-1 truncate font-mono text-[8.5px] uppercase leading-[11px] tracking-[0.6px] text-subtle-foreground lg:hidden">{phoneMeta}</p>
          {!selectionMode && (
            <div className="-my-2 -mr-1.5 shrink-0" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
              {menu}
            </div>
          )}
        </div>
        {below}
      </div>
    </div>
  );
}

/** The kebab trigger every card uses. */
export function JkDocMenuTrigger({ label, ...props }: { label: string } & React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      aria-label={label}
      {...props}
      className="flex size-8 items-center justify-center rounded-full text-subtle-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      <MoreVertical className="size-4" strokeWidth={1.6} />
    </button>
  );
}
