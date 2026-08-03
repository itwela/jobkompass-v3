'use client'

import { useState } from "react";
import { motion } from "framer-motion";
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

/**
 * Blue manila folder. Deliberately a sibling of the sticky notes in
 * jkChatWindow-ResourcesMode.tsx — same color-object shape, same hover spring —
 * but with no index rotation, because a row of filing folders reads better flat
 * and keeps its labels legible.
 */
const folderColor = {
  bg: '#93C5FD',                    // blue-300
  border: '#3B82F6',                // blue-500
  shadow: 'rgba(59, 130, 246, 0.3)',
};

export default function JkDocumentFolderCard({
  folder,
  count,
  onOpen,
  onRename,
  onDelete,
  onDropDocument,
}: {
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

  const commitRename = () => {
    const next = draftName.trim();
    if (next && next !== folder.name) onRename(next);
    setIsRenaming(false);
  };

  return (
    <motion.div
      layout
      whileHover={{ scale: 1.05 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className="relative"
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
      {/* Tab */}
      <div
        className="h-3.5 w-2/5 rounded-t-md"
        style={{
          backgroundColor: folderColor.bg,
          border: `1px solid ${folderColor.border}`,
          borderBottom: 'none',
        }}
      />
      {/* Body */}
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
          "flex min-h-[104px] cursor-pointer flex-col justify-between rounded-b-xl rounded-tr-xl p-4 text-black transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600",
          isDropTarget && "ring-4 ring-blue-600/40"
        )}
        style={{
          backgroundColor: folderColor.bg,
          border: `1px solid ${folderColor.border}`,
          boxShadow: `0 4px 12px ${folderColor.shadow}, 0 2px 4px rgba(0,0,0,0.1)`,
        }}
      >
        <div className="flex items-start justify-between gap-2">
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
                  setDraftName(folder.name);
                  setIsRenaming(false);
                }
              }}
              className="h-8 bg-white/80 text-black"
            />
          ) : (
            <p className="min-w-0 flex-1 truncate text-sm font-semibold">
              {folder.name}
            </p>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-black/70 hover:bg-black/10 hover:text-black"
                onClick={(event) => event.stopPropagation()}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              onClick={(event) => event.stopPropagation()}
            >
              <DropdownMenuItem
                onClick={(event) => {
                  event.stopPropagation();
                  setDraftName(folder.name);
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

        {showDeleteConfirm ? (
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
        ) : (
          <p className="mt-2 text-xs text-black/70">
            {count} document{count === 1 ? '' : 's'}
          </p>
        )}
      </div>
    </motion.div>
  );
}
