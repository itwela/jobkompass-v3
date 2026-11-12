'use client'

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { trackCtaClicked } from "@/lib/analytics/client";
import JkArt from "../jkArt";
import JkGetStartedButton from "../jkGetStartedButton";
import { LandingContainer, Reveal } from "./jkLandingShell";

export default function JkLandingStart() {
  return (
    <section className="relative isolate overflow-hidden" aria-labelledby="start-heading">
      <JkArt name="harbour" fade="y" position="center bottom" className="-z-10" />
      <LandingContainer className="flex min-h-[640px] flex-col items-center pt-28 text-center sm:min-h-[960px] sm:pt-44">
        <Reveal className="flex flex-col items-center">
          <h2 id="start-heading" className="text-5xl font-medium leading-[1.08] tracking-tight text-foreground sm:text-7xl">
            Try us on the next job <br className="hidden sm:block" />you apply to.
          </h2>
          <p className="mt-5 max-w-4xl text-base text-foreground/90 sm:text-lg">
            The free plan writes 3 resumes or cover letters a month. Paste one posting and judge the result yourself.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <JkGetStartedButton size="lg" className="h-13 px-7 text-base" surface="hero" label="Get started free" />
            <Link href="/free-resume-generator" onClick={() => trackCtaClicked({ cta: "free_generator", surface: "midpage" })}>
              <Button size="lg" variant="secondary" className="h-13 border-border-strong bg-accent/70 px-7 text-base backdrop-blur">Try the free generator</Button>
            </Link>
          </div>
        </Reveal>
      </LandingContainer>
    </section>
  );
}
