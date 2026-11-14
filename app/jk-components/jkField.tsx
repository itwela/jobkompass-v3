import { cn } from "@/lib/utils";

/** Mono caps label above a field, with an optional item on the right (e.g. "Forgot password?"). */
export function JkFieldLabel({ htmlFor, children, aside, className }: { htmlFor?: string; children: React.ReactNode; aside?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("mb-[7px] flex items-end justify-between gap-3", className)}>
      <label htmlFor={htmlFor} className="font-mono text-[10px] font-medium uppercase leading-[13px] tracking-[0.12em] text-subtle-foreground">
        {children}
      </label>
      {aside}
    </div>
  );
}

/** Field surface shared by auth and onboarding: card fill, input border, gold while typing. */
export const jkFieldCls =
  "w-full rounded-xl border border-input bg-card px-3.5 text-[14.5px] text-foreground placeholder:text-subtle-foreground outline-none transition-[border-color,box-shadow] focus-visible:border-plan focus-visible:shadow-[0_0_0_0.5px_var(--plan)] disabled:opacity-60";

export function JkField({ label, aside, id, className, style, children }: { label: string; aside?: React.ReactNode; id: string; className?: string; style?: React.CSSProperties; children: React.ReactNode }) {
  return (
    <div className={className} style={style}>
      <JkFieldLabel htmlFor={id} aside={aside}>{label}</JkFieldLabel>
      {children}
    </div>
  );
}

/** Inline error under a form, in the app's destructive colour. */
export function JkFormError({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 px-3.5 py-2.5 text-[13.5px] leading-snug text-destructive">
      {children}
    </p>
  );
}
