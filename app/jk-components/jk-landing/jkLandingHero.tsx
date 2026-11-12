'use client'

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import JkGetStartedButton from "../jkGetStartedButton";
import JkPaintingLoop from "../jkPaintingLoop";
import { HERO_LOOP_FRAGMENT, HERO_LOOP_SECONDS } from "./jkHeroLoopShader";

/**
 * Hero, measured from the v4.5 frame (1440 x 1100): a 290px sky band, then the
 * painting at its own 16:9 shape across the full width, with the copy laid
 * over both. On wider windows the copy keeps its size and the painting grows
 * (see .jk-painting in globals.css).
 */
export default function JkLandingHero() {
  return (
    <section className="relative isolate overflow-hidden bg-sky" aria-labelledby="hero-heading">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[292px] bg-gradient-to-b from-sky-top to-sky" />

      <div className="relative z-10 mx-auto max-w-[1440px] px-5 pt-[112px] text-center lg:absolute lg:inset-x-0 lg:top-0 lg:px-0 lg:pt-[150px]">
        <a href="#cli" className="group inline-flex h-[34px] max-w-full items-center gap-[11px] rounded-full border border-on-fill/25 bg-on-fill/10 pl-[5px] pr-[11px] text-[13.5px] font-medium text-on-fill transition-colors hover:bg-on-fill/15">
          <span className="flex h-6 w-11 shrink-0 items-center justify-center rounded-full bg-plan font-mono text-[9.5px] font-bold tracking-[0.6px] text-plan-foreground">NEW</span>
          <span className="truncate">jk CLI is here: let your AI agent run your job search</span>
          <ArrowRight className="size-3.5 shrink-0 transition-transform group-hover:translate-x-0.5" />
        </a>
        {/* 80px at 1440 and scaling down with the window, so the two-line break always holds. */}
        <h1 id="hero-heading" className="mt-[13px] text-[clamp(30px,7.2vw,80px)] font-medium leading-[1.05] tracking-[-0.022em] text-on-fill lg:text-[80px] lg:leading-[84px]">
          <span className="block">A tailored resume</span>
          <span className="block">for every job you apply to</span>
        </h1>
        <p className="mx-auto mt-[18px] max-w-[720px] text-balance text-[clamp(15px,2.1vw,19px)] leading-[1.42] text-on-fill/85 lg:text-[19px] lg:leading-[27px]">
          Paste a posting. JobKompass saves the job, writes the resume and cover letter for it, <br className="hidden lg:block" />and keeps your whole search in one list.
        </p>
        <div className="mt-[28px] flex flex-wrap items-center justify-center gap-3">
          <JkGetStartedButton size="lg" className="jk-fx jk-fx-cream h-[52px] px-[26px] text-[15.5px]" surface="hero" label="Get started free" />
          <Link href="/pricing" className="jk-fx jk-fx-navy inline-flex h-[52px] items-center rounded-full border border-on-fill/35 bg-on-fill/10 px-[26px] text-[15.5px] font-medium text-on-fill">
            <span className="relative z-[2]">See pricing</span>
          </Link>
        </div>

        {/* Two notes from the product, pinned either side of the buttons. */}
        <div aria-hidden className="absolute left-24 top-[474px] hidden h-[84px] w-[268px] rounded-[18px] border border-on-fill/20 bg-background/60 px-5 pt-[15px] text-left xl:block">
          <p className="font-mono text-[9.5px] font-medium uppercase tracking-[1.2px] text-bar-4">Saved to My Jobs</p>
          <p className="mt-[5px] text-[15.5px] font-medium leading-[18px] text-on-fill">GTM AI Solutions Engineer</p>
          <p className="mt-1 text-[13px] leading-[15px] text-on-fill/75">PTC (via Mondo)</p>
        </div>
        <div aria-hidden className="absolute right-24 top-[468px] hidden h-24 w-[262px] rounded-[18px] border border-on-fill/20 bg-background/60 px-5 pt-[15px] text-left xl:block">
          <div className="flex items-center justify-between">
            <p className="text-[15px] font-medium leading-[18px] text-on-fill">Must-haves matched</p>
            <p className="font-mono text-xs font-medium text-bar-4">8/10</p>
          </div>
          <div className="mt-[19px] flex justify-between">
            {Array.from({ length: 10 }, (_, i) => (
              <span key={i} className={i < 8 ? "size-3 rounded-full bg-bar-4" : "size-3 rounded-full bg-border-strong"} />
            ))}
          </div>
          <p className="mt-[10px] font-mono text-[9.5px] uppercase tracking-[1px] text-on-fill/75">Resume written · 1 page</p>
        </div>
      </div>

      {/* Sky band (desktop), then the painting at its own shape. */}
      <div aria-hidden className="hidden h-[290px] lg:block" />
      <div aria-hidden className="jk-painting pointer-events-none relative -z-10 -mt-[12%] w-full lg:mt-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/v4/hero-night.webp" alt="" fetchPriority="high" draggable={false} className="absolute inset-0 hidden size-full select-none object-cover dark:block" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/v4/hero-day.webp" alt="" draggable={false} className="absolute inset-0 block size-full select-none object-cover dark:hidden" />
        <JkPaintingLoop src="/images/v4/hero-night.webp" fragment={HERO_LOOP_FRAGMENT} loopSeconds={HERO_LOOP_SECONDS} className="absolute inset-0 hidden size-full dark:block" />
        <div className="absolute inset-x-0 top-0 h-[150px] bg-gradient-to-b from-sky to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-[200px] bg-gradient-to-b from-transparent to-background" />
      </div>
    </section>
  );
}
