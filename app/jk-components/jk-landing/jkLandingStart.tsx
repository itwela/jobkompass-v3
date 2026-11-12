'use client'

import Link from "next/link";
import { trackCtaClicked } from "@/lib/analytics/client";
import JkGetStartedButton from "../jkGetStartedButton";
import { LandingContainer, Reveal } from "./jkLandingShell";

export default function JkLandingStart() {
  return (
    <section className="relative isolate overflow-hidden bg-background" aria-labelledby="start-heading">
      <LandingContainer className="relative z-10 flex flex-col items-center pt-20 text-center lg:absolute lg:inset-x-0 lg:top-0 lg:pt-[176px]">
        <Reveal className="flex flex-col items-center">
          <h2 id="start-heading" className="text-[clamp(30px,7.4vw,72px)] font-medium leading-[1.1] tracking-[-0.022em] text-on-fill lg:text-[72px] lg:leading-[80px]">
            <span className="block">Try us on the next job</span><span className="block">you apply to.</span>
          </h2>
          <p className="mt-5 max-w-4xl text-balance text-[clamp(15px,2.1vw,19px)] text-on-fill/90 lg:text-[19px]">
            The free plan writes 3 resumes or cover letters a month. Paste one posting and judge the result yourself.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <JkGetStartedButton size="lg" className="jk-fx jk-fx-cream h-[52px] px-[26px] text-[15.5px]" surface="hero" label="Get started free" />
            <Link href="/free-resume-generator" onClick={() => trackCtaClicked({ cta: "free_generator", surface: "midpage" })}>
              <span className="jk-fx jk-fx-navy inline-flex h-[52px] items-center rounded-full border border-on-fill/35 bg-on-fill/10 px-[26px] text-[15.5px] font-medium text-on-fill "><span className="relative z-[2]">Try the free generator</span></span>
            </Link>
          </div>
        </Reveal>
      </LandingContainer>
      {/* Same construction as the hero: a dark band, then the painting at its own shape. */}
      <div aria-hidden className="hidden h-[150px] lg:block" />
      <div aria-hidden className="jk-painting pointer-events-none relative -z-10 -mt-[8%] w-full lg:mt-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/v4/harbour-night.webp" alt="" loading="lazy" draggable={false} className="absolute inset-0 hidden size-full select-none object-cover dark:block" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/v4/harbour-day.webp" alt="" loading="lazy" draggable={false} className="absolute inset-0 block size-full select-none object-cover dark:hidden" />
        <div className="absolute inset-x-0 top-0 h-[220px] bg-gradient-to-b from-background to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-[160px] bg-gradient-to-b from-transparent to-background" />
      </div>
    </section>
  );
}
