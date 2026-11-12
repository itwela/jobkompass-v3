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
    <section id="pricing" className="scroll-mt-24 border-t border-border py-20 sm:py-28" aria-labelledby="pricing-heading">
      <LandingContainer>
        <SectionHeading id="pricing-heading" eyebrow="05 / Pricing" tone={3} title="Start free. Pay when the search gets busy." className="mb-8" />
        <Reveal>
          <JkPlanCards
            showArt
            renderAction={(plan, { highlighted }) =>
              plan.id === "free" ? (
                <Link href={isAuthenticated ? "/app" : "/auth"} onClick={() => { if (!isAuthenticated) trackCtaClicked({ cta: "signup", surface: "hero" }); }}>
                  <Button variant="secondary" size="lg" className="w-full bg-transparent">Get started</Button>
                </Link>
              ) : (
                <Link href="/pricing">
                  <Button variant={highlighted ? "plan" : "secondary"} size="lg" className={highlighted ? "w-full" : "w-full bg-transparent"}>{plan.isOneTime ? "Start" : "Start free trial"}</Button>
                </Link>
              )
            }
          />
        </Reveal>
      </LandingContainer>
    </section>
  );
}
