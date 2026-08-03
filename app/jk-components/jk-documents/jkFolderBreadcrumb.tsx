'use client'

import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { DRAG_MIME, type JkDraggedDocument } from "./jkDocumentFolderCard";

/**
 * "← All documents / <folder>" row shown while a folder is open. Doubles as a
 * drop target so a card can be dragged back out of the folder.
 */
export default function JkFolderBreadcrumb({
  folderName,
  onBack,
  onDropDocument,
}: {
  folderName: string;
  onBack: () => void;
  onDropDocument?: (payload: JkDraggedDocument) => void;
}) {
  const [isDropTarget, setIsDropTarget] = useState(false);

  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-lg border border-transparent px-1 py-1 text-sm",
        isDropTarget && "border-blue-500 bg-blue-50 dark:bg-blue-950/40"
      )}
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
          // Ignore drops that did not originate from a document card.
        }
      }}
    >
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        All documents
      </button>
      <span className="text-muted-foreground">/</span>
      <span className="truncate font-semibold text-foreground">{folderName}</span>
    </div>
  );
}
