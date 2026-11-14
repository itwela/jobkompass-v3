'use client'

import { cn } from "@/lib/utils";

/** Monthly / Annual switch with the gold SAVE 25% tag. One component for the pricing page, landing and in-app plan cards. */
export default function JkBillingSwitch({ annual, onChange, className, style }: { annual: boolean; onChange: (annual: boolean) => void; className?: string; style?: React.CSSProperties }) {
  return (
    <div role="group" aria-label="Billing period" style={style} className={cn("inline-flex h-[38px] items-center rounded-full border border-input bg-card p-[3px] lg:h-10", className)}>
      {[false, true].map((v) => (
        <button
          key={String(v)}
          type="button"
          aria-pressed={annual === v}
          onClick={() => onChange(v)}
          className={cn(
            "flex h-full items-center gap-2.5 rounded-full px-6 text-[13px] font-medium transition-colors lg:text-[13.5px]",
            annual === v ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground",
            v && "pr-1.5",
          )}
        >
          {v ? "Annual" : "Monthly"}
          {v && <span className="flex h-5 items-center rounded-full bg-plan px-[11px] font-mono text-[9px] font-bold tracking-[0.6px] text-plan-foreground lg:text-[9.5px] lg:tracking-[0.8px]">SAVE 25%</span>}
        </button>
      ))}
    </div>
  );
}
