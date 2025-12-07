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
        "w-full rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 flex flex-col gap-2",
        className
      )}
    >
      <span className="font-medium">{message}</span>
      <div className="flex gap-2">
        <button
          onClick={onConfirm}
          disabled={isLoading}
          className={cn(
            "flex-1 rounded bg-red-600 py-1 text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70",
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
          className="flex-1 rounded border border-red-200 bg-white/90 py-1 text-red-600 transition-colors hover:border-red-300 hover:bg-white disabled:cursor-not-allowed disabled:opacity-70"
        >
          {cancelLabel}
        </button>
      </div>
    </div>
  );
}

