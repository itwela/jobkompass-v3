'use client'

import { useState } from "react";
import { Folder, FolderMinus, FolderPlus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Id } from "@/convex/_generated/dataModel";
import type { JkFolder } from "./jkDocumentFolderCard";

/**
 * Folder picker shared by the per-card ⋮ menu and the multi-select toolbar.
 * Renders as a plain list so it can sit inside a dropdown or a popover.
 */
export default function JkMoveToFolderMenu({
  folders,
  currentFolderId,
  onMove,
  onCreateAndMove,
}: {
  folders: JkFolder[];
  currentFolderId?: string | null;
  onMove: (folderId: Id<"documentFolders"> | null) => void;
  onCreateAndMove: (name: string) => void;
}) {
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState("");

  return (
    <div className="min-w-[220px] space-y-1 p-1">
      {folders.length === 0 && !isCreating && (
        <p className="px-2 py-1.5 text-xs text-muted-foreground">
          No folders yet.
        </p>
      )}

      {folders.map((folder) => {
        const isCurrent = String(folder._id) === String(currentFolderId ?? "");
        return (
          <button
            key={String(folder._id)}
            type="button"
            disabled={isCurrent}
            onClick={() => onMove(folder._id)}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted disabled:opacity-50"
          >
            <Folder className="h-4 w-4 text-blue-500" />
            <span className="min-w-0 flex-1 truncate">{folder.name}</span>
            {isCurrent && (
              <span className="text-[10px] text-muted-foreground">current</span>
            )}
          </button>
        );
      })}

      {currentFolderId && (
        <button
          type="button"
          onClick={() => onMove(null)}
          className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted"
        >
          <FolderMinus className="h-4 w-4" />
          Remove from folder
        </button>
      )}

      {isCreating ? (
        <div className="flex gap-1 p-1">
          <Input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && name.trim()) {
                event.preventDefault();
                onCreateAndMove(name);
                setName("");
                setIsCreating(false);
              }
              if (event.key === "Escape") {
                setName("");
                setIsCreating(false);
              }
            }}
            placeholder="Folder name"
            className="h-8"
          />
          <Button
            size="sm"
            disabled={!name.trim()}
            onClick={() => {
              onCreateAndMove(name);
              setName("");
              setIsCreating(false);
            }}
          >
            Add
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsCreating(true)}
          className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted"
        >
          <FolderPlus className="h-4 w-4" />
          New folder…
        </button>
      )}
    </div>
  );
}
