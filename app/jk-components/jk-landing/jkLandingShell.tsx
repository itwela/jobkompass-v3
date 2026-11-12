'use client'

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { JkEyebrow, type JkTone } from "../jkBars";

/** Page-width container shared by every landing section. */
export function LandingContainer({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-[1232px] px-5 sm:px-8", className)}>{children}</div>;
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
export function SectionHeading({ id, eyebrow, tone, title, lead, className }: { id?: string; eyebrow: string; tone: JkTone; title: React.ReactNode; lead?: string; className?: string }) {
  return (
    <Reveal className={cn("mb-10 sm:mb-12", className)}>
      <JkEyebrow tone={tone}>{eyebrow}</JkEyebrow>
      <h2 id={id} className="mt-4 text-balance text-3xl font-medium tracking-tight text-foreground sm:text-5xl">{title}</h2>
      {lead && <p className="mt-4 max-w-3xl text-base text-muted-foreground sm:text-lg">{lead}</p>}
    </Reveal>
  );
}

/** Raised panel used for mock UI inside landing cards. */
export function MockPanel({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div aria-hidden className={cn("rounded-2xl border border-border bg-background p-4", className)}>{children}</div>;
}
