import { cn } from "@/lib/utils";

const BAR = ["bg-bar-1", "bg-bar-2", "bg-bar-3", "bg-bar-4"] as const;
const TICK_TEXT = ["text-bar-1", "text-bar-2", "text-bar-3", "text-bar-4-ink"] as const;
export type JkTone = 1 | 2 | 3 | 4 | "plan";

/** The four logo-colour bars. */
export function JkBars({ size = "md", className }: { size?: "sm" | "md" | "lg"; className?: string }) {
  const h = size === "sm" ? "h-3" : size === "lg" ? "h-8" : "h-5";
  const w = size === "lg" ? "w-1.5" : "w-1";
  return (
    <span aria-hidden className={cn("inline-flex items-end gap-0.5", className)}>
      {BAR.map((c, i) => (
        <span key={c} className={cn("rounded-full", w, h, c, i % 2 === 1 && "translate-y-[-15%]")} />
      ))}
    </span>
  );
}

/** A single vertical tick in one logo colour (or gold for the paid plan). */
export function JkTick({ tone = 1, className }: { tone?: JkTone; className?: string }) {
  return <span aria-hidden className={cn("inline-block h-3 w-[3px] shrink-0 rounded-full", tone === "plan" ? "bg-plan" : BAR[tone - 1], className)} />;
}

/** Tick plus mono caps label, used above every section heading. */
export function JkEyebrow({ children, tone = 1, className }: { children: React.ReactNode; tone?: JkTone; className?: string }) {
  return (
    <p className={cn("jk-eyebrow flex items-center gap-2.5 text-subtle-foreground", className)}>
      <JkTick tone={tone} />
      <span>{children}</span>
    </p>
  );
}

export function jkToneText(tone: 1 | 2 | 3 | 4) {
  return TICK_TEXT[tone - 1];
}
