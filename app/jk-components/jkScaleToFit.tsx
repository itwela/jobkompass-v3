'use client'

import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Lays its children out in a square `base` px wide, then scales them to fill
 * the parent's width. Used for mock UI drawn at one size and shown at another.
 */
export default function JkScaleToFit({ base, className, children }: { base: number; className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setScale(e.contentRect.width / base));
    ro.observe(el);
    return () => ro.disconnect();
  }, [base]);
  return (
    <div ref={ref} className={cn("relative size-full overflow-hidden", className)}>
      <div className="absolute left-0 top-0 origin-top-left" style={{ width: base, height: base, transform: `scale(${scale})` }}>
        {children}
      </div>
    </div>
  );
}
