'use client'

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/providers/jkAuthProvider";
import { trackCtaClicked } from "@/lib/analytics/client";
import JkPlanCards from "../jkPlanCards";
import { LandingContainer, Reveal, SectionHeading } from "./jkLandingShell";

export default function JkLandingPricing() {
  const { isAuthenticated } = useAuth();
  return (
    <section id="pricing" className="scroll-mt-24 lg:border-t lg:border-border lg:py-28" aria-labelledby="pricing-heading">
      <LandingContainer>
        <SectionHeading id="pricing-heading" title={<>Start free. Pay when <br className="lg:hidden" />the search gets busy.</>} className="mb-3.5 lg:mb-8" />
        <Reveal>
          <JkPlanCards
            showArt
            renderAction={(plan, { highlighted }) =>
              plan.id === "free" ? (
                <Link href={isAuthenticated ? "/app" : "/auth"} onClick={() => { if (!isAuthenticated) trackCtaClicked({ cta: "signup", surface: "hero" }); }}>
                  <Button variant="secondary" size="lg" className="jk-fx jk-fx-navy h-[46px] w-full bg-transparent text-[15px] lg:h-11 lg:text-sm"><span className="relative z-[2]">Get started</span></Button>
                </Link>
              ) : (
                <Link href="/pricing">
                  <Button variant={highlighted ? "plan" : "secondary"} size="lg" className={highlighted ? "jk-fx jk-fx-gold h-[46px] w-full text-[15px] lg:h-11 lg:text-sm" : "jk-fx jk-fx-navy h-[46px] w-full bg-transparent text-[15px] lg:h-11 lg:text-sm"}><span className="relative z-[2]">{plan.isOneTime ? "Start" : "Start free trial"}</span></Button>
                </Link>
              )
            }
          />
        </Reveal>
      </LandingContainer>
    </section>
  );
}
