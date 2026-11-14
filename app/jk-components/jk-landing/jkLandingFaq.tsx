'use client'

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import JkArt from "../jkArt";
import { faqData } from "./jkLandingData";
import { LandingContainer, Reveal } from "./jkLandingShell";

export default function JkLandingFaq() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <section id="faq" data-enter className="scroll-mt-24 pt-[55px] lg:border-t lg:border-border lg:py-28" aria-labelledby="faq-heading">
      <LandingContainer className="grid gap-[18px] lg:grid-cols-[2fr_3fr] lg:gap-10">
        <Reveal>
          <h2 id="faq-heading" className="text-[34px] font-medium leading-10 tracking-[-0.8px] md:text-[44px] md:leading-[50px] lg:text-5xl lg:leading-none lg:tracking-tight">
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
                <li key={item.question} style={{ "--i": i + 2 } as React.CSSProperties} className="jk-enter">
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : i)}
                    aria-expanded={isOpen}
                    aria-controls={`faq-answer-${i}`}
                    className="flex min-h-[58px] w-full items-center justify-between gap-6 py-3 text-left text-[15.5px] font-medium text-foreground lg:min-h-0 lg:py-5 lg:text-lg lg:font-normal"
                  >
                    {item.question}
                    <Plus className={cn("size-3.5 shrink-0 lg:size-4 text-muted-foreground transition-transform duration-200", isOpen && "rotate-45")} />
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
                        <p className="max-w-2xl pb-5 text-sm leading-relaxed text-muted-foreground lg:pb-6 lg:text-base">{item.answer}</p>
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
