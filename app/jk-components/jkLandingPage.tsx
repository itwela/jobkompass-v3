'use client'

import JkPublicHeader from "./jkPublicHeader";
import JkFooter from "./jkFooter";
import JkLandingHero from "./jk-landing/jkLandingHero";
import JkLandingSurfaces from "./jk-landing/jkLandingSurfaces";
import JkLandingSteps from "./jk-landing/jkLandingSteps";
import JkLandingApp from "./jk-landing/jkLandingApp";
import JkLandingFreeGenerator from "./jk-landing/jkLandingFreeGenerator";
import JkLandingCli from "./jk-landing/jkLandingCli";
import JkLandingPricing from "./jk-landing/jkLandingPricing";
import JkLandingFaq from "./jk-landing/jkLandingFaq";
import JkLandingStart from "./jk-landing/jkLandingStart";

/** The landing page: one component per section, composed in reading order. */
export default function JkLandingPage() {
  return (
    <>
      <JkPublicHeader showPricing showNav overlay />
      <main className="flex min-h-screen flex-col bg-background" role="main">
        <JkLandingHero />
        <JkLandingSurfaces />
        <JkLandingSteps />
        <JkLandingApp />
        <JkLandingFreeGenerator />
        <JkLandingCli />
        <JkLandingPricing />
        <JkLandingFaq />
        <JkLandingStart />
        <JkFooter />
      </main>
    </>
  );
}
