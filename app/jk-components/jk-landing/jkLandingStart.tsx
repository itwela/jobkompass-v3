'use client'

import Link from "next/link";
import { trackCtaClicked } from "@/lib/analytics/client";
import JkGetStartedButton from "../jkGetStartedButton";
import JkSceneLoop from "../jkSceneLoop";
import { LandingContainer, Reveal } from "./jkLandingShell";

export default function JkLandingStart() {
  return (
    <section className="relative isolate overflow-hidden bg-background pt-10 lg:pt-0" aria-labelledby="start-heading">
      {/* Phone and tablet (M00): copy laid over the harbour painting, one primary button and a text link. */}
      <div className="relative h-[520px] sm:h-[600px] lg:hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/v4/harbour-night.webp" alt="" loading="lazy" draggable={false} className="absolute inset-0 hidden size-full select-none object-cover object-[38%_100%] dark:block" />
          <JkSceneLoop scene="harbour" className="absolute inset-0 hidden size-full dark:block" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/v4/harbour-day.webp" alt="" loading="lazy" draggable={false} className="absolute inset-0 block size-full select-none object-cover object-[38%_100%] dark:hidden" />
          <JkSceneLoop scene="harbour" day className="absolute inset-0 block size-full dark:hidden" />
          <div className="absolute inset-x-0 top-0 h-[220px] bg-gradient-to-b from-background to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-[121px] bg-gradient-to-b from-transparent to-background" />
        </div>
        <Reveal className="flex flex-col items-center px-5 pt-[42px] text-center">
          <h2 className="text-[36px] font-medium leading-[44px] tracking-[-0.9px] text-hero-ink max-[359px]:text-[32px] max-[359px]:leading-10 sm:text-[52px] sm:leading-[58px] sm:tracking-[-0.022em]">
            Try us on the next<br />job you apply to.
          </h2>
          <p className="mt-[18px] max-w-[310px] text-[14.5px] leading-[1.5] text-hero-ink/90 sm:max-w-[480px] sm:text-[17px]">
            The free plan writes 3 resumes or cover letters a month. Paste one posting and judge the result yourself.
          </p>
          <JkGetStartedButton size="lg" className="jk-fx jk-fx-cream mt-5 h-[50px] px-7 text-[15.5px]" surface="hero" label="Get started free" />
          <Link href="/free-resume-generator" onClick={() => trackCtaClicked({ cta: "free_generator", surface: "midpage" })} className="mt-[18px] text-[13.5px] font-medium text-hero-ink underline underline-offset-2">
            Or try the free generator without an account
          </Link>
        </Reveal>
      </div>
      <LandingContainer className="relative z-10 hidden flex-col items-center text-center lg:absolute lg:inset-x-0 lg:top-0 lg:flex lg:pt-[176px]">
        <Reveal className="flex flex-col items-center">
          <h2 id="start-heading" className="text-[72px] font-medium leading-[80px] tracking-[-0.022em] text-hero-ink">
            <span className="block">Try us on the next job</span><span className="block">you apply to.</span>
          </h2>
          <p className="mt-5 max-w-4xl text-balance text-[19px] text-hero-ink/90">
            The free plan writes 3 resumes or cover letters a month. Paste one posting and judge the result yourself.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <JkGetStartedButton size="lg" className="jk-fx jk-fx-cream h-[52px] px-[26px] text-[15.5px]" surface="hero" label="Get started free" />
            <Link href="/free-resume-generator" onClick={() => trackCtaClicked({ cta: "free_generator", surface: "midpage" })}>
              <span className="jk-fx jk-fx-navy inline-flex h-[52px] items-center rounded-full border border-hero-ink/35 bg-hero-ink/10 px-[26px] text-[15.5px] font-medium text-hero-ink "><span className="relative z-[2]">Try the free generator</span></span>
            </Link>
          </div>
        </Reveal>
      </LandingContainer>
      {/* Same construction as the hero: a dark band, then the painting at its own shape. */}
      <div aria-hidden className="hidden h-[150px] lg:block" />
      <div aria-hidden className="jk-painting pointer-events-none relative -z-10 hidden w-full lg:block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/v4/harbour-night.webp" alt="" loading="lazy" draggable={false} style={{ objectPosition: "38% 100%" }} className="absolute inset-0 hidden size-full select-none object-cover dark:block" />
        <JkSceneLoop scene="harbour" className="absolute inset-0 hidden size-full dark:block" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/v4/harbour-day.webp" alt="" loading="lazy" draggable={false} className="absolute inset-0 block size-full select-none object-cover dark:hidden" />
        <JkSceneLoop scene="harbour" day className="absolute inset-0 block size-full dark:hidden" />
        <div className="absolute inset-x-0 top-0 h-[220px] bg-gradient-to-b from-background to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-[160px] bg-gradient-to-b from-transparent to-background" />
      </div>
    </section>
  );
}
