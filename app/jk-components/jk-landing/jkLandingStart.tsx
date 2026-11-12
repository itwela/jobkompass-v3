'use client'

import Link from "next/link";
import { trackCtaClicked } from "@/lib/analytics/client";
import JkGetStartedButton from "../jkGetStartedButton";
import { LandingContainer, Reveal } from "./jkLandingShell";

export default function JkLandingStart() {
  return (
    <section className="relative isolate overflow-hidden bg-background pb-[calc(56.25vw-190px)] lg:h-[calc(150px+56.25vw)] lg:pb-0" aria-labelledby="start-heading">
      {/* Same construction as the hero: the painting at its own shape, anchored to the bottom. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 aspect-[16/9]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/v4/harbour-night.webp" alt="" loading="lazy" draggable={false} className="hidden size-full select-none object-cover dark:block" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/v4/harbour-day.webp" alt="" loading="lazy" draggable={false} className="block size-full select-none object-cover dark:hidden" />
        <div className="absolute inset-x-0 top-0 h-[220px] bg-gradient-to-b from-background to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-[160px] bg-gradient-to-b from-transparent to-background" />
      </div>
      <LandingContainer className="flex flex-col items-center pt-24 text-center lg:pt-[176px]">
        <Reveal className="flex flex-col items-center">
          <h2 id="start-heading" className="text-[44px] font-medium leading-[1.08] tracking-[-1px] text-on-fill sm:text-[64px] lg:text-[72px] lg:leading-[80px] lg:tracking-[-1.6px]">
            Try us on the next job <br className="hidden sm:block" />you apply to.
          </h2>
          <p className="mt-5 max-w-4xl text-base text-on-fill/90 sm:text-[19px]">
            The free plan writes 3 resumes or cover letters a month. Paste one posting and judge the result yourself.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <JkGetStartedButton size="lg" className="h-[52px] px-[26px] text-[15.5px]" surface="hero" label="Get started free" />
            <Link href="/free-resume-generator" onClick={() => trackCtaClicked({ cta: "free_generator", surface: "midpage" })}>
              <span className="inline-flex h-[52px] items-center rounded-full border border-on-fill/35 bg-on-fill/10 px-[26px] text-[15.5px] font-medium text-on-fill transition-colors hover:bg-on-fill/20">Try the free generator</span>
            </Link>
          </div>
        </Reveal>
      </LandingContainer>
    </section>
  );
}
