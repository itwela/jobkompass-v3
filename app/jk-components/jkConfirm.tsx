'use client'

/**
 * Two-click confirmation for anything that can't be undone. The control the person
 * clicked changes its own words to a question; a second click on it does the thing.
 * No dialog. It goes back to normal after a few seconds or when focus leaves.
 *
 *   <JkConfirmButton variant="destructive" onConfirm={remove}>Delete job</JkConfirmButton>
 *   <JkConfirmMenuItem onConfirm={remove}><Trash2 />Delete</JkConfirmMenuItem>     (inside a DropdownMenu)
 *   <JkConfirmText onConfirm={revoke}>Revoke</JkConfirmText>                      (plain text control)
 */
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export const JK_CONFIRM_LABEL = "Sure? Click again";

export function useConfirmClick(onConfirm: () => void | Promise<void>, ms = 5000) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!asking) return;
    const id = window.setTimeout(() => setAsking(false), ms);
    return () => window.clearTimeout(id);
  }, [asking, ms]);
  /** Returns true when this click only asked the question. */
  const click = async (): Promise<boolean> => {
    if (busy) return true;
    if (!asking) { setAsking(true); return true; }
    setBusy(true);
    try { await onConfirm(); } finally { setBusy(false); setAsking(false); }
    return false;
  };
  return { asking, busy, click, reset: () => setAsking(false) };
}

type ButtonProps = React.ComponentProps<typeof Button>;

export function JkConfirmButton({ onConfirm, children, confirmLabel = JK_CONFIRM_LABEL, busyLabel, disabled, onClick: _ignored, ...props }: Omit<ButtonProps, "onClick"> & {
  onConfirm: () => void | Promise<void>; confirmLabel?: React.ReactNode; busyLabel?: React.ReactNode; onClick?: never;
}) {
  const c = useConfirmClick(onConfirm);
  return (
    <Button type="button" {...props} disabled={disabled || c.busy} aria-live="polite" onBlur={c.reset}
      onClick={(e) => { e.stopPropagation(); void c.click(); }}>
      {c.busy ? busyLabel ?? children : c.asking ? confirmLabel : children}
    </Button>
  );
}

/** A plain text or icon control (no Button styling) with the same two clicks. */
export function JkConfirmText({ onConfirm, children, confirmLabel = JK_CONFIRM_LABEL, className, askingClassName = "text-destructive opacity-100", disabled, ...props }: Omit<React.ComponentProps<"button">, "onClick"> & {
  onConfirm: () => void | Promise<void>; confirmLabel?: React.ReactNode; askingClassName?: string;
}) {
  const c = useConfirmClick(onConfirm);
  return (
    <button type="button" {...props} disabled={disabled || c.busy} aria-live="polite" onBlur={c.reset}
      onClick={(e) => { e.stopPropagation(); void c.click(); }} className={cn(className, c.asking && askingClassName)}>
      {c.asking ? confirmLabel : children}
    </button>
  );
}

/** A destructive row in a dropdown menu. The first select keeps the menu open and asks. */
export function JkConfirmMenuItem({ onConfirm, children, confirmLabel = JK_CONFIRM_LABEL, className, ...props }: Omit<React.ComponentProps<typeof DropdownMenuItem>, "onSelect" | "onClick"> & {
  onConfirm: () => void | Promise<void>; confirmLabel?: React.ReactNode;
}) {
  const c = useConfirmClick(onConfirm);
  return (
    <DropdownMenuItem variant="destructive" {...props} className={className}
      onClick={(e) => e.stopPropagation()}
      onSelect={(e) => { if (!c.asking) { e.preventDefault(); void c.click(); } else { void c.click(); } }}>
      {c.asking ? <span className="font-medium">{confirmLabel}</span> : children}
    </DropdownMenuItem>
  );
}
