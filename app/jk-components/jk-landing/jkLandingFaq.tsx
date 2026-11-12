'use client'

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import JkArt from "../jkArt";
import { JkEyebrow } from "../jkBars";
import { faqData } from "./jkLandingData";
import { LandingContainer, Reveal } from "./jkLandingShell";

export default function JkLandingFaq() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <section id="faq" className="scroll-mt-24 border-t border-border py-20 sm:py-28" aria-labelledby="faq-heading">
      <LandingContainer className="grid gap-10 lg:grid-cols-[2fr_3fr]">
        <Reveal>
          <JkEyebrow tone={2}>06 / FAQ</JkEyebrow>
          <h2 id="faq-heading" className="mt-4 text-4xl font-medium tracking-tight sm:text-5xl">
            <span className="text-foreground">Questions</span><br />
            <span className="text-subtle-foreground">people ask</span>
          </h2>
          <JkArt name="step4" variant="spot" className="mt-6 hidden max-w-[320px] lg:block" />
        </Reveal>
        <Reveal delay={0.06}>
          <ul className="divide-y divide-border border-y border-border">
            {faqData.map((item, i) => {
              const isOpen = open === i;
              return (
                <li key={item.question}>
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : i)}
                    aria-expanded={isOpen}
                    aria-controls={`faq-answer-${i}`}
                    className="flex w-full items-center justify-between gap-6 py-5 text-left text-lg text-foreground"
                  >
                    {item.question}
                    <Plus className={cn("size-4 shrink-0 text-muted-foreground transition-transform duration-200", isOpen && "rotate-45")} />
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        id={`faq-answer-${i}`}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                        className="overflow-hidden"
                      >
                        <p className="max-w-2xl pb-6 leading-relaxed text-muted-foreground">{item.answer}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </li>
              );
            })}
          </ul>
        </Reveal>
      </LandingContainer>
    </section>
  );
}
