'use client'

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import JkArt from "../jkArt";
import JkGetStartedButton from "../jkGetStartedButton";
import { LandingContainer, Reveal } from "./jkLandingShell";

export default function JkLandingHero() {
  return (
    <section className="relative isolate overflow-hidden" aria-labelledby="hero-heading">
      {/* Night sky above the painting, then the painting itself, full width. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-20 bg-gradient-to-b from-accent via-accent to-background" />
      <JkArt name="hero" fade="y" position="center bottom" className="top-auto -z-10 h-[68%] sm:h-[78%]" />

      <LandingContainer className="relative flex min-h-[760px] flex-col pb-56 pt-16 sm:min-h-[1040px] sm:pt-24">
        <Reveal className="mx-auto flex max-w-5xl flex-col items-center text-center">
          <a href="#cli" className="group mb-6 inline-flex items-center gap-2.5 rounded-full border border-border-strong bg-background/50 py-1 pl-1 pr-3.5 text-sm text-foreground backdrop-blur transition-colors hover:bg-background/70">
            <span className="jk-eyebrow rounded-full bg-plan px-2 py-0.5 font-medium text-plan-foreground">New</span>
            jk CLI is here: let your AI agent run your job search
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </a>
          <h1 id="hero-heading" className="text-5xl font-medium leading-[1.04] tracking-tight text-foreground sm:text-7xl lg:text-[5.75rem]">
            A tailored resume <br className="hidden sm:block" />for every job you apply to
          </h1>
          <p className="mt-6 max-w-[46rem] text-balance text-base text-foreground/85 sm:text-xl">
            Paste a posting. JobKompass saves the job, writes the resume and cover letter for it, and keeps your whole search in one list.
          </p>
        </Reveal>

        {/* Buttons sit between two notes from the product, as in the reference. */}
        <div className="relative mt-9 flex items-center justify-center">
          <div aria-hidden className="absolute left-0 top-1/2 hidden w-[268px] -translate-y-1/2 rounded-2xl border border-border-strong bg-background/70 px-5 py-4 backdrop-blur xl:block">
            <p className="jk-eyebrow text-bar-4">Saved to My Jobs</p>
            <p className="mt-1.5 font-medium text-foreground">GTM AI Solutions Engineer</p>
            <p className="text-sm text-muted-foreground">PTC (via Mondo)</p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <JkGetStartedButton size="lg" className="h-13 px-7 text-base" surface="hero" label="Get started free" />
            <Link href="/pricing">
              <Button size="lg" variant="secondary" className="h-13 border-border-strong bg-accent/80 px-7 text-base backdrop-blur">See pricing</Button>
            </Link>
          </div>
          <div aria-hidden className="absolute right-0 top-1/2 hidden w-[264px] -translate-y-1/2 rounded-2xl border border-border-strong bg-background/70 px-5 py-4 backdrop-blur xl:block">
            <div className="flex items-center justify-between">
              <p className="font-medium text-foreground">Must-haves matched</p>
              <p className="font-mono text-xs text-bar-4">8/10</p>
            </div>
            <div className="mt-3 flex justify-between">
              {Array.from({ length: 10 }, (_, i) => (
                <span key={i} className={i < 8 ? "size-2.5 rounded-full bg-bar-4" : "size-2.5 rounded-full bg-border-strong"} />
              ))}
            </div>
            <p className="jk-eyebrow mt-3 text-muted-foreground">Resume written · 1 page</p>
          </div>
        </div>
      </LandingContainer>
    </section>
  );
}
