'use client'

import { cn } from "@/lib/utils";
import { useJobKompassTheme } from "@/providers/jkThemeProvider";

/** Night / Day switch for the footer. The choice is saved, so it holds across pages and visits. */
export default function JkThemeSwitch({ className }: { className?: string }) {
  const { theme, toggleTheme } = useJobKompassTheme();
  return (
    <div role="group" aria-label="Theme" className={cn("inline-flex h-[34px] rounded-full border border-border bg-card p-[3px]", className)}>
      {(["dark", "light"] as const).map((t) => (
        <button
          key={t}
          type="button"
          aria-pressed={theme === t}
          onClick={() => { if (theme !== t) toggleTheme(); }}
          className={cn(
            "rounded-full px-3.5 font-mono text-[9.5px] uppercase tracking-[1.2px] transition-colors",
            theme === t ? "bg-accent font-medium text-foreground" : "text-subtle-foreground hover:text-foreground",
          )}
        >
          {t === "dark" ? "Night" : "Day"}
        </button>
      ))}
    </div>
  );
}
