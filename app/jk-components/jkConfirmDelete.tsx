'use client'

import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { ReactNode } from "react";

interface ConfirmDeleteProps {
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
  className?: string;
}

export default function JkConfirmDelete({
  message = "Are you sure you want to delete?",
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  isLoading = false,
  className,
}: ConfirmDeleteProps) {
  return (
    <div
      className={cn(
        "w-full rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive flex flex-col gap-2",
        className
      )}
    >
      <span className="font-medium">{message}</span>
      <div className="flex gap-2">
        <button
          onClick={onConfirm}
          disabled={isLoading}
          className={cn(
            "flex-1 rounded bg-destructive py-1 text-on-fill transition-colors hover:bg-destructive disabled:cursor-not-allowed disabled:opacity-70",
            isLoading && "flex items-center justify-center gap-2"
          )}
        >
          {isLoading ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              {confirmLabel}
            </>
          ) : (
            confirmLabel
          )}
        </button>
        <button
          onClick={onCancel}
          disabled={isLoading}
          className="flex-1 rounded border border-destructive/30 bg-card/90 py-1 text-destructive transition-colors hover:border-destructive/30 hover:bg-card disabled:cursor-not-allowed disabled:opacity-70"
        >
          {cancelLabel}
        </button>
      </div>
    </div>
  );
}

