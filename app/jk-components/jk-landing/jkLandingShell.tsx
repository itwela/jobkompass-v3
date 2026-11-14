'use client'

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { type JkTone } from "../jkBars";

/** Page-width container shared by every landing section. */
export function LandingContainer({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-[1248px] px-5 sm:px-6", className)}>{children}</div>;
}

/** Sets data-playing on the element while it is on screen, so its CSS loops only run when seen. */
export function useOnScreen<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) el.setAttribute("data-playing", ""); else el.removeAttribute("data-playing"); }, { threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}

/** Fades content up the first time it scrolls into view. */
export function Reveal({ className, delay = 0, children }: { className?: string; delay?: number; children: React.ReactNode }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

/** Eyebrow, heading and optional lead paragraph that open a section. */
export function SectionHeading({ id, title, lead, leadAlways, className }: { id?: string; eyebrow?: string; tone?: JkTone; title: React.ReactNode; lead?: string; leadAlways?: boolean; className?: string }) {
  return (
    <Reveal className={cn("mb-7 lg:mb-12", className)}>
      {/* Phone sizes from M00: 11px eyebrow with a 3x14 tick, 34/40 heading at -0.8px. */}
      <h2 id={id} className="text-[34px] font-medium leading-10 tracking-[-0.8px] text-foreground md:text-[44px] md:leading-[50px] lg:text-balance lg:text-[52px] lg:leading-[1.19] lg:tracking-[-0.022em]">{title}</h2>
      {lead && <p className={cn("mt-4 max-w-3xl text-pretty text-base text-muted-foreground lg:block lg:text-lg", !leadAlways && "hidden")}>{lead}</p>}
    </Reveal>
  );
}

/** Raised panel used for mock UI inside landing cards. */
export function MockPanel({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div aria-hidden className={cn("rounded-2xl border border-border bg-background p-4", className)}>{children}</div>;
}
