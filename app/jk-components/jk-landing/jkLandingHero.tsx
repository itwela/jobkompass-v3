'use client'

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import JkGetStartedButton from "../jkGetStartedButton";
import JkPaintingLoop from "../jkPaintingLoop";
import JkLandingHeroNotes from "./jkLandingHeroNotes";
import { HERO_LOOP_FRAGMENT, HERO_LOOP_SECONDS, HERO_LOOP_SPACE } from "./jkHeroLoopShader";

/**
 * Hero, measured from the v4.5 frame (1440 x 1100): a 290px sky band, then the
 * painting at its own 16:9 shape across the full width, with the copy laid
 * over both. On wider windows the copy keeps its size and the painting grows
 * (see .jk-painting in globals.css).
 */
export default function JkLandingHero() {
  return (
    <section data-enter className="relative isolate overflow-hidden bg-sky" aria-labelledby="hero-heading">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[292px] bg-gradient-to-b from-sky-top to-sky" />

      <div className="relative z-10 mx-auto max-w-[1440px] px-5 pt-[122px] text-center lg:absolute lg:inset-x-0 lg:top-0 lg:px-0 lg:pt-[150px]">
        <a href="#cli" style={{ "--i": 0 } as React.CSSProperties} className="jk-enter group inline-flex h-[30px] max-w-full items-center gap-2.5 rounded-full border border-hero-ink/25 bg-hero-ink/10 pl-1 pr-4 text-xs font-medium lg:h-[34px] lg:gap-[11px] lg:pl-[5px] lg:pr-[11px] lg:text-[13.5px] text-hero-ink transition-colors hover:bg-hero-ink/15">
          <span className="flex h-[22px] w-10 shrink-0 items-center justify-center rounded-full bg-plan font-mono text-[9px] lg:h-6 lg:w-11 lg:text-[9.5px] font-bold tracking-[0.6px] text-plan-foreground">NEW</span>
          <span className="truncate lg:hidden">jk CLI: let your AI agent run the search</span>
          <span className="hidden truncate lg:inline">jk CLI is here: let your AI agent run your job search</span>
          <ArrowRight className="hidden size-3.5 lg:block shrink-0 transition-transform group-hover:translate-x-0.5" />
        </a>
        {/* 80px at 1440 and scaling down with the window, so the two-line break always holds. */}
        <h1 id="hero-heading" style={{ "--i": 1 } as React.CSSProperties} className="jk-enter mt-[14px] text-[42px] font-medium leading-[46px] tracking-[-1.1px] text-hero-ink max-[359px]:text-[36px] max-[359px]:leading-10 sm:text-[clamp(48px,7.4vw,80px)] sm:leading-[1.06] sm:tracking-[-0.022em] lg:mt-[13px] lg:text-[80px] lg:leading-[84px] lg:tracking-[-0.022em]">
          <span className="block">A tailored resume</span>
          <span className="block sm:hidden">for every job</span>
          <span className="block sm:hidden">you apply to</span>
          <span className="hidden sm:block">for every job you apply to</span>
        </h1>
        <p style={{ "--i": 2 } as React.CSSProperties} className="jk-enter mx-auto mt-[18px] max-w-[310px] text-balance text-[14.5px] leading-[22px] text-hero-ink/85 sm:max-w-[460px] sm:text-[17px] sm:leading-[25px] lg:hidden">
          Paste a posting. JobKompass writes the resume and keeps your whole search in one list.
        </p>
        <p style={{ "--i": 2 } as React.CSSProperties} className="jk-enter mx-auto mt-[18px] hidden max-w-[720px] text-balance text-[19px] leading-[27px] text-hero-ink/85 lg:block">
          Paste a posting. JobKompass saves the job, writes the resume and cover letter for it, <br className="hidden lg:block" />and keeps your whole search in one list.
        </p>
        <div style={{ "--i": 3 } as React.CSSProperties} className="jk-enter mt-[18px] flex items-center justify-center gap-2 lg:mt-[28px] lg:gap-3">
          <JkGetStartedButton size="lg" className="jk-fx jk-fx-cream h-[50px] px-7 text-[15.5px] lg:h-[52px] lg:px-[26px]" surface="hero" label="Get started free" />
          <Link href="/pricing" className="jk-fx jk-fx-navy inline-flex h-[50px] shrink-0 items-center rounded-full border border-input bg-secondary px-7 text-[15.5px] font-medium text-hero-ink lg:h-[52px] lg:border-hero-ink/35 lg:bg-hero-ink/10 lg:px-[26px]">
            <span className="relative z-[2]">See pricing</span>
          </Link>
        </div>

        {/* Two pieces of the app, pinned either side of the buttons, each playing a short loop. */}
        <JkLandingHeroNotes />
      </div>

      {/* Sky band (desktop), then the painting at its own shape. */}
      <div aria-hidden className="hidden h-[290px] lg:block" />
      {/* Phone (M00): the painting at 818x460, right edge on the screen edge so the lighthouse shows, starting 134px above the buttons' bottom. */}
      {/* Grows with the window: never narrower than 818px (the phone crop), never narrower than the screen, always 16:9. */}
      <div aria-hidden className="pointer-events-none relative -z-10 -mt-[134px] flex w-full justify-end overflow-hidden lg:hidden">
        <div className="relative aspect-video w-[max(818px,100%)] shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/v4/hero-night.webp" alt="" fetchPriority="high" draggable={false} className="absolute inset-0 hidden size-full select-none object-cover dark:block" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/v4/hero-day.webp" alt="" draggable={false} className="absolute inset-0 block size-full select-none object-cover dark:hidden" />
          <JkPaintingLoop src="/images/v4/hero-night.webp" fragment={HERO_LOOP_FRAGMENT} loopSeconds={HERO_LOOP_SECONDS} space={HERO_LOOP_SPACE} className="absolute inset-0 hidden size-full dark:block" />
          <JkPaintingLoop src="/images/v4/hero-day.webp" fragment={HERO_LOOP_FRAGMENT} loopSeconds={HERO_LOOP_SECONDS} space={HERO_LOOP_SPACE} setup={(gl, U) => gl.uniform1f(U("u_day"), 1)} className="absolute inset-0 block size-full dark:hidden" />
        </div>
        <div className="absolute inset-x-0 top-0 h-[150px] bg-gradient-to-b from-sky to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-[141px] bg-gradient-to-b from-transparent to-background" />
      </div>
      <div aria-hidden className="jk-painting pointer-events-none relative -z-10 hidden w-full lg:block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/v4/hero-night.webp" alt="" fetchPriority="high" draggable={false} className="absolute inset-0 hidden size-full select-none object-cover dark:block" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/v4/hero-day.webp" alt="" draggable={false} className="absolute inset-0 block size-full select-none object-cover dark:hidden" />
        <JkPaintingLoop src="/images/v4/hero-night.webp" fragment={HERO_LOOP_FRAGMENT} loopSeconds={HERO_LOOP_SECONDS} space={HERO_LOOP_SPACE} className="absolute inset-0 hidden size-full dark:block" />
          <JkPaintingLoop src="/images/v4/hero-day.webp" fragment={HERO_LOOP_FRAGMENT} loopSeconds={HERO_LOOP_SECONDS} space={HERO_LOOP_SPACE} setup={(gl, U) => gl.uniform1f(U("u_day"), 1)} className="absolute inset-0 block size-full dark:hidden" />
        <div className="absolute inset-x-0 top-0 h-[150px] bg-gradient-to-b from-sky to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-[200px] bg-gradient-to-b from-transparent to-background" />
      </div>
    </section>
  );
}
