'use client'

import { LogOut } from "lucide-react";
import { JkConfirmText } from "./jkConfirm";
import { cn } from "@/lib/utils";

/** Sign out in two clicks: the label turns into a question, the second click signs out. */
export default function JkSignOutButton({ onConfirm, className, icon = false }: { onConfirm: () => void | Promise<void>; className?: string; icon?: boolean }) {
  return (
    <JkConfirmText onConfirm={onConfirm} className={cn("text-destructive", className)} askingClassName="font-semibold"
      confirmLabel={<>{icon && <LogOut className="size-4 shrink-0" />}Sure? Click again to sign out</>}>
      {icon && <LogOut className="size-4 shrink-0" />}Sign out
    </JkConfirmText>
  );
}
