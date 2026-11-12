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

/** Pointer-follow and click ripple for .jk-fx buttons, delegated from the page wrapper. */
function fxTarget(e: React.SyntheticEvent): HTMLElement | null {
  return e.target instanceof Element ? e.target.closest<HTMLElement>(".jk-fx") : null;
}
const clampFx = (v: number) => Math.max(-1.5, Math.min(1.5, v));

function onFxMove(e: React.PointerEvent) {
  const b = fxTarget(e);
  if (!b) return;
  const r = b.getBoundingClientRect();
  const x = e.clientX - r.left;
  const y = e.clientY - r.top;
  b.style.setProperty("--mx", `${clampFx((x - r.width / 2) * 0.02).toFixed(2)}px`);
  b.style.setProperty("--my", `${clampFx((y - r.height / 2) * 0.04).toFixed(2)}px`);
  b.style.setProperty("--px", `${x}px`);
  b.style.setProperty("--py", `${y}px`);
}
function onFxOut(e: React.PointerEvent) {
  const b = fxTarget(e);
  if (!b || (e.relatedTarget instanceof Node && b.contains(e.relatedTarget))) return;
  b.style.setProperty("--mx", "0px");
  b.style.setProperty("--my", "0px");
}
function onFxClick(e: React.MouseEvent) {
  const b = fxTarget(e);
  if (!b) return;
  const r = b.getBoundingClientRect();
  const s = document.createElement("span");
  s.className = "jk-rip";
  s.style.left = `${e.clientX ? e.clientX - r.left : r.width / 2}px`;
  s.style.top = `${e.clientY ? e.clientY - r.top : r.height / 2}px`;
  b.appendChild(s);
  setTimeout(() => s.remove(), 720);
}

/** The landing page: one component per section, composed in reading order. */
export default function JkLandingPage() {
  return (
    <div className="jk-landing relative" onPointerMove={onFxMove} onPointerOut={onFxOut} onClick={onFxClick}>
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
    </div>
  );
}
