'use client'

import { useId } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * JkSegmented — the pill toggle used across the app ("Table | Grouped" on My Jobs,
 * "This month | All time" on Performance).
 *
 * Props
 *   options    { value, label }[] — two or more.
 *   value      the selected value (controlled).
 *   onChange   (value) => void
 *   size?      "md" = 40px track, 13.5px labels (D03) · "sm" = 36px track, 13px labels (D11, M09). Default "md".
 *   ariaLabel  name for the group (screen readers).
 *   className  extra classes for the track.
 *
 * Track: --card fill, --input stroke. Selected thumb: --accent, slides between options.
 */
export default function JkSegmented<T extends string>({
  options, value, onChange, size = "md", ariaLabel, className,
}: {
  options: { value: T; label: React.ReactNode }[];
  value: T;
  onChange: (value: T) => void;
  size?: "md" | "sm";
  ariaLabel?: string;
  className?: string;
}) {
  const id = useId();
  const reduce = useReducedMotion();
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border border-input bg-card p-[3px]",
        size === "md" ? "h-10" : "h-9",
        className,
      )}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative h-full whitespace-nowrap rounded-full font-medium transition-colors duration-200",
              size === "md" ? "px-[22px] text-[13.5px]" : "px-[21px] text-[13px]",
              on ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {on && (
              <motion.span
                layoutId={`jk-seg-${id}`}
                aria-hidden
                className="absolute inset-0 rounded-full bg-accent"
                transition={reduce ? { duration: 0 } : { type: "tween", duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
