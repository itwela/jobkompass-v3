'use client'

import { useRef, useState } from "react";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import JkConfirmDelete from "../jkConfirmDelete";
import { Id } from "@/convex/_generated/dataModel";

/** Payload key for dragging a document card onto a folder. */
export const DRAG_MIME = "application/x-jk-document";

export type JkDraggedDocument = {
  id: string;
  type: "resume" | "cover-letter";
};

export type JkFolder = {
  _id: Id<"documentFolders">;
  name: string;
  resumeCount: number;
  coverLetterCount: number;
};

/** Folder accents cycle through the four brand bars, as in D07. */
export const FOLDER_ACCENTS = ["var(--bar-1)", "var(--bar-2)", "var(--bar-3)", "var(--bar-4)"] as const;

export default function JkDocumentFolderCard({
  folder,
  count,
  onOpen,
  onRename,
  onDelete,
  onDropDocument,
  accent = FOLDER_ACCENTS[0],
}: {
  accent?: string;
  folder: JkFolder;
  count: number;
  onOpen: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  onDropDocument?: (payload: JkDraggedDocument) => void;
}) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [draftName, setDraftName] = useState(folder.name);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDropTarget, setIsDropTarget] = useState(false);
  // Guards against a double commit: pressing Enter sets isRenaming false and
  // unmounts the still-focused Input, which can trigger a native blur that
  // React resolves into a second onBlur call on this same closure before
  // teardown completes. Reset whenever a new rename session begins.
  const hasCommittedRef = useRef(false);

  const commitRename = () => {
    if (hasCommittedRef.current) return;
    hasCommittedRef.current = true;
    const next = draftName.trim();
    if (next && next !== folder.name) onRename(next);
    setIsRenaming(false);
  };

  return (
    <div
      className="relative pt-2"
      style={{ "--accent-c": accent } as React.CSSProperties}
      onDragOver={(event) => {
        if (!onDropDocument) return;
        event.preventDefault();
        setIsDropTarget(true);
      }}
      onDragLeave={() => setIsDropTarget(false)}
      onDrop={(event) => {
        setIsDropTarget(false);
        if (!onDropDocument) return;
        event.preventDefault();
        try {
          const raw = event.dataTransfer.getData(DRAG_MIME);
          if (!raw) return;
          const payload = JSON.parse(raw) as JkDraggedDocument;
          if (!payload?.id || !payload?.type) return;
          onDropDocument(payload);
        } catch {
          // A drop from outside the app is a no-op, not an error.
        }
      }}
    >
      {/* Folder tab peeking over the card (D07: 84x20 at 55%). Desktop only; M06 has none. */}
      <span aria-hidden className="absolute left-4 top-0 hidden h-5 w-[84px] rounded-[8px] opacity-55 lg:block" style={{ background: "var(--accent-c)" }} />
      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          if (!isRenaming && !showDeleteConfirm) onOpen();
        }}
        onKeyDown={(event) => {
          if (isRenaming || showDeleteConfirm) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onOpen();
          }
        }}
        className={cn(
          "group relative flex min-h-[56px] cursor-pointer items-center gap-3 rounded-[16px] border border-border bg-card py-3 pl-4 pr-1 lg:gap-4 lg:pr-2 text-foreground transition-colors hover:border-input focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:min-h-16 lg:rounded-[18px] lg:pl-5",
          isDropTarget && "border-ring ring-2 ring-ring/40"
        )}
      >
        <span aria-hidden className="absolute left-0 top-1/2 hidden h-8 w-[3px] -translate-y-1/2 rounded-full lg:block" style={{ background: "var(--accent-c)" }} />
        <FolderIcon />
        <div className="min-w-0 flex-1">
          {isRenaming ? (
            <Input
              autoFocus
              value={draftName}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => setDraftName(event.target.value)}
              onBlur={commitRename}
              onKeyDown={(event) => {
                event.stopPropagation();
                if (event.key === "Enter") commitRename();
                if (event.key === "Escape") {
                  hasCommittedRef.current = true;
                  setDraftName(folder.name);
                  setIsRenaming(false);
                }
              }}
              className="h-8"
            />
          ) : (
            <p className="truncate text-[14px] font-medium leading-[17px] lg:text-[15px] lg:leading-[18px]">{folder.name}</p>
          )}
          {showDeleteConfirm ? null : (
            <p className="mt-[3px] truncate whitespace-nowrap font-mono text-[10.5px] leading-[14px] text-subtle-foreground lg:text-[11.5px] lg:leading-[15px]">
              {count} document{count === 1 ? "" : "s"}
            </p>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`${folder.name} options`}
              className="size-7 shrink-0 text-subtle-foreground lg:size-8 opacity-100 hover:text-foreground lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100 lg:data-[state=open]:opacity-100"
              onClick={(event) => event.stopPropagation()}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
            <DropdownMenuItem
              onClick={(event) => {
                event.stopPropagation();
                setDraftName(folder.name);
                hasCommittedRef.current = false;
                setIsRenaming(true);
              }}
            >
              <Pencil className="h-4 w-4" />
              <span>Rename</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={(event) => {
                event.stopPropagation();
                setShowDeleteConfirm(true);
              }}
            >
              <Trash2 className="h-4 w-4" />
              <span>Delete folder</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {showDeleteConfirm && (
        <div className="mt-2" onClick={(event) => event.stopPropagation()}>
          <JkConfirmDelete
            message={`Delete "${folder.name}"? Its documents will be moved out, not deleted.`}
            onConfirm={() => {
              setShowDeleteConfirm(false);
              onDelete();
            }}
            onCancel={() => setShowDeleteConfirm(false)}
          />
        </div>
      )}
    </div>
  );
}

/** D07 folder glyph: 16x11 outline in the folder's accent. */
function FolderIcon() {
  return (
    <svg aria-hidden width="18" height="14" viewBox="0 0 18 14" fill="none" className="shrink-0" style={{ color: "var(--accent-c)" }}>
      <path d="M1.5 3V11.5C1.5 12.05 1.95 12.5 2.5 12.5H15.5C16.05 12.5 16.5 12.05 16.5 11.5V4.5C16.5 3.95 16.05 3.5 15.5 3.5H8.6L7 1.5H2.5C1.95 1.5 1.5 1.95 1.5 2.5V3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}
