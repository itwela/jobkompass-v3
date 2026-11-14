import { cn } from "@/lib/utils";

/**
 * JkSectionLabel — the mono-caps label above a group ("CONVERSATIONS", "FOLDERS", "NEW CHAT").
 *
 * Props
 *   children   the label text; write it in normal case or caps, it is shown in caps.
 *   tick?      CSS colour for a 3×14 tick before the label, e.g. "var(--plan)" (D01 "NEW CHAT").
 *   tone?      "subtle" (default, --subtle-foreground) | "muted" (--muted-foreground) | "plan" (gold, paid-only meaning).
 *   as?        element to render, default "p" (use "h2" when it heads a section).
 *   className  extra classes (spacing).
 *
 * Spec: JetBrains Mono 10px Medium, letter-spacing 1.6px (D03 / D07 / D11).
 */
export default function JkSectionLabel({
  children, tick, tone = "subtle", as: Tag = "p", className,
}: {
  children: React.ReactNode;
  tick?: string;
  tone?: "subtle" | "muted" | "plan";
  as?: "p" | "h2" | "h3" | "span" | "div";
  className?: string;
}) {
  return (
    <Tag
      className={cn(
        "flex items-center gap-[11px] font-mono text-[10px] font-medium uppercase leading-[13px] tracking-[1.6px]",
        tone === "subtle" && "text-subtle-foreground",
        tone === "muted" && "text-muted-foreground",
        tone === "plan" && "text-plan-text",
        className,
      )}
    >
      {tick && <span aria-hidden className="h-3.5 w-[3px] shrink-0 rounded-full" style={{ background: tick }} />}
      {children}
    </Tag>
  );
}
