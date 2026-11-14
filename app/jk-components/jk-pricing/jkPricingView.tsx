'use client'

import { Button } from "@/components/ui/button";
import JkBillingSwitch from "../jkBillingSwitch";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import JkPublicHeader from "../jkPublicHeader";
import JkArt, { type JkArtName } from "../jkArt";
import JkFooter from "../jkFooter";
import JkEnter from "../jkEnter";
import { JkTick, type JkTone } from "../jkBars";
import { plans, type Plan } from "../jkPricing";
import { freePlan } from "../jkPlanCards";

/**
 * The pricing page, built to the D18 (1440) and M19 (390) FigCraft frames.
 * Three subscription columns (Free, Plus, Pro), Starter as a one-time strip,
 * a compare table, three short answers. Checkout logic lives in JkPricing and
 * comes in through props, so this file is layout only.
 */

type Tier = { plan: Plan; tone: JkTone; ship: JkArtName; eyebrow: string; features: string[] };

// Built when the page renders, not when the module loads: jkPricing imports this file,
// so reading `plans` at import time would hit the circular import before it is initialised.
function getTiers(): { tiers: Tier[]; starter: Plan } {
  const plus = plans.find((p) => p.id === "plus")!;
  const pro = plans.find((p) => p.id === "pro")!;
  const starter = plans.find((p) => p.id === "starter")!;
  return {
    starter,
    tiers: [
      { plan: freePlan, tone: 1, ship: "ship1", eyebrow: "Free includes:", features: freePlan.features },
      { plan: plus, tone: 3, ship: "ship3", eyebrow: "Everything in Free, plus:", features: plus.features },
      { plan: pro, tone: 4, ship: "ship4", eyebrow: "Everything in Plus, plus:", features: pro.features.filter((f) => f !== "Everything in Plus") },
    ],
  };
}
const PHONE_ORDER = ["pro", "plus", "free"];

const COMPARE: { label: string; free: string | boolean; plus: string | boolean; pro: string | boolean }[] = [
  { label: "AI documents", free: "3 a month", plus: "60 a month", pro: "180 a month" },
  { label: "Tracked jobs", free: "10", plus: "100", pro: "Unlimited" },
  { label: "Unlimited edits", free: true, plus: true, pro: true },
  { label: "Resume templates", free: "Jake", plus: "Jake, Joseph", pro: "Jake, Joseph, Mar" },
  { label: "Chrome extension", free: false, plus: true, pro: true },
  { label: "jk CLI and agent access", free: false, plus: false, pro: true },
  { label: "Priority support", free: false, plus: false, pro: true },
];

const ANSWERS: { q: string; a: string; tone: JkTone }[] = [
  { q: "Can I cancel?", a: "Yes. You keep access until the period ends.", tone: 2 },
  { q: "What counts as an AI document?", a: "Each resume or cover letter JobKompass writes.", tone: 3 },
  { q: "Do my jobs disappear if I downgrade?", a: "No. They stay saved. Adding new ones pauses at the limit.", tone: 4 },
];

export interface JkPricingViewProps {
  isAnnual: boolean;
  onAnnualChange: (annual: boolean) => void;
  /** Label for a plan's button ("Start 3-day free trial", "Current plan", …). */
  actionLabel: (plan: Plan) => string;
  actionDisabled: (plan: Plan) => boolean;
  loadingPlanId: string | null;
  onSelect: (plan: Plan) => void;
}

function priceFor(plan: Plan, annual: boolean) {
  if (plan.id === "free") return { price: "$0", unit: "" };
  if (plan.isOneTime) return { price: plan.oneTimePrice ?? "", unit: "one-time" };
  const p = annual ? plan.pricing!.annual : plan.pricing!.monthly;
  return { price: p.price, unit: annual ? "/year" : "/month" };
}

function ActionButton({ plan, gold, view, className }: { plan: Plan; gold?: boolean; view: JkPricingViewProps; className?: string }) {
  const loading = view.loadingPlanId === plan.id;
  return (
    <Button
      type="button"
      size="lg"
      variant={gold ? "plan" : "secondary"}
      onClick={() => view.onSelect(plan)}
      disabled={view.actionDisabled(plan)}
      className={cn(gold ? "jk-fx jk-fx-gold" : "jk-fx jk-fx-navy bg-transparent", className)}
    >
      <span className="relative z-[2]">{loading ? "Opening checkout…" : view.actionLabel(plan)}</span>
    </Button>
  );
}

function TierCard({ tier, view }: { tier: Tier; view: JkPricingViewProps }) {
  const { plan } = tier;
  const isPro = plan.id === "pro";
  const { price, unit } = priceFor(plan, view.isAnnual);
  return (
    <div
      data-plan-card
      className={cn(
        "relative flex flex-col rounded-[22px] border px-[18px] pb-6 pt-4 transition-colors lg:rounded-3xl lg:px-6 lg:pb-8 lg:pt-5",
        isPro ? "jk-glow border-plan" : "border-input bg-card hover:border-border-strong",
      )}
    >
      {isPro && (
        <span className="absolute left-1/2 top-0 hidden h-[22px] -translate-x-1/2 -translate-y-1/2 items-center rounded-full bg-plan px-[19px] font-mono text-[9.5px] font-bold uppercase tracking-[0.8px] text-plan-foreground min-[1100px]:flex">
          Most used
        </span>
      )}
      {/* The whole ship, top right, faded on every side. */}
      <div className="absolute right-3.5 top-2 size-[106px] max-[359px]:size-[84px] lg:right-5 lg:top-3 lg:size-[122px]">
        <JkArt name={tier.ship} variant="spot" live hoverHost="[data-plan-card]" />
      </div>

      <p className="relative flex items-center gap-[11px] text-[15px] font-medium text-foreground">
        <JkTick tone={tier.tone} className="h-3.5" />
        {plan.name}
        {isPro && (
          <span className="ml-1.5 flex h-[18px] items-center rounded-full bg-plan/20 px-2 font-mono text-[9.5px] font-bold uppercase tracking-[0.8px] text-plan-text min-[1100px]:hidden">
            Most used
          </span>
        )}
      </p>
      <p className="relative mt-1.5 flex items-baseline gap-2 lg:mt-2">
        <span className="text-[38px] font-medium leading-[46px] tracking-[-1px] text-foreground lg:text-[44px] lg:leading-[52px] lg:tracking-[-1.2px]">{price}</span>
        {unit && <span className="font-mono text-[11.5px] text-subtle-foreground lg:text-xs">{unit}</span>}
      </p>
      <p className="relative mt-0.5 max-w-[calc(100%-112px)] text-[13.5px] text-muted-foreground lg:mt-1 lg:max-w-[calc(100%-128px)]">{plan.description}</p>

      <ActionButton plan={plan} gold={isPro} view={view} className="relative mt-[13px] h-12 w-full text-[15px] lg:h-[46px] lg:text-[14.5px]" />

      <div className={cn("relative mt-5 border-t pt-[18px] lg:mt-6", isPro ? "border-border-strong" : "border-border")}>
        <p className={cn("font-mono text-[9.5px] font-medium uppercase tracking-[1.2px] lg:text-[10px]", isPro ? "text-muted-foreground" : "text-subtle-foreground")}>{tier.eyebrow}</p>
        <ul className="mt-2 space-y-[7px] lg:mt-[9px] lg:space-y-[9px]">
          {tier.features.map((f) => (
            <li key={f} className="flex items-center gap-[11px] text-[13.5px] leading-[19px] text-foreground">
              <Check className={cn("size-3.5 shrink-0", isPro ? "text-plan-text" : "text-ok")} strokeWidth={2.25} />
              {f}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function StarterStrip({ view, starter }: { view: JkPricingViewProps; starter: Plan }) {
  return (
    <div data-plan-card className="relative flex flex-col gap-4 rounded-[22px] border border-input bg-card px-[18px] py-6 transition-colors hover:border-border-strong md:flex-row md:items-center md:gap-6 md:rounded-3xl md:py-0 md:pl-3.5 md:pr-6 lg:h-[104px]">
      <div className="relative hidden size-[92px] shrink-0 md:block">
        <JkArt name="ship2" variant="spot" live hoverHost="[data-plan-card]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-[11px] text-base font-medium text-foreground lg:text-[17px]">
          <JkTick tone={2} className="h-3.5" />
          {starter.name}
          <span className="hidden h-[18px] items-center rounded-full bg-muted px-[7px] font-mono text-[9.5px] font-bold uppercase tracking-[0.8px] text-muted-foreground md:flex">One-time</span>
        </p>
        <p className="mt-2 max-w-[calc(100%-84px)] text-[13.5px] text-muted-foreground md:mt-[9px] md:max-w-none">
          A week of full access, no commitment.<span className="hidden lg:inline"> 10 AI documents, 100 tracked jobs, Jake and Joseph templates.</span>
        </p>
      </div>
      {/* Phones: price sits top right of the strip (M19). */}
      <div className="absolute right-[18px] top-5 text-right md:static md:flex md:items-center md:gap-[22px]">
        <p className="text-2xl font-medium tracking-[-0.5px] text-foreground md:text-[32px] md:tracking-[-0.8px]">{starter.oneTimePrice}</p>
        <p className="font-mono text-[9px] uppercase tracking-[0.8px] text-subtle-foreground md:hidden">One-time</p>
      </div>
      <ActionButton plan={starter} view={view} className="h-[46px] w-full shrink-0 text-[15px] md:h-11 md:w-[146px] md:text-[14.5px]" />
    </div>
  );
}

function Cell({ v, pro }: { v: string | boolean; pro?: boolean }) {
  if (v === true) return <Check className={cn("mx-auto size-4", pro ? "text-plan-text" : "text-ok")} strokeWidth={2.25} />;
  if (v === false) return <Minus className="mx-auto size-3.5 text-border-strong" />;
  return <span className={cn("text-[13.5px]", pro ? "text-foreground" : "text-muted-foreground")}>{v}</span>;
}

// D18: label column fills, then three 220px columns (Free 650, Plus 870, Pro 1090) and a 10px gutter.
const COMPARE_GRID = "grid grid-cols-[1fr_repeat(3,minmax(150px,220px))_10px] items-center";

function Compare() {
  return (
    <section data-enter aria-labelledby="compare-heading" className="mt-11 hidden min-[900px]:block">
      <h2 id="compare-heading" className="text-[28px] font-medium tracking-[-0.5px] text-foreground">Compare plans</h2>
      <div role="table" className="relative mt-5">
        {/* Pro column highlight. */}
        <div aria-hidden className={cn(COMPARE_GRID, "pointer-events-none absolute inset-0")}>
          <div className="jk-glow col-start-4 h-full rounded-[18px] border border-plan" />
        </div>
        <div role="row" className={cn(COMPARE_GRID, "relative h-14")}>
          <span />
          {["Free", "Plus", "Pro"].map((h) => (
            <span key={h} role="columnheader" className="text-center text-[15px] font-medium text-foreground">{h}</span>
          ))}
        </div>
        {COMPARE.map((r) => (
          <div key={r.label} role="row" style={{ "--i": COMPARE.indexOf(r) + 1 } as React.CSSProperties} className={cn(COMPARE_GRID, "jk-enter relative h-12")}>
            {/* Row rule runs under the label, Free and Plus only, stopping at the Pro column. */}
            <span aria-hidden className="absolute left-0 right-[230px] top-0 border-t border-border" />
            <span role="rowheader" className="text-[14.5px] text-foreground">{r.label}</span>
            <span role="cell" className="text-center"><Cell v={r.free} /></span>
            <span role="cell" className="text-center"><Cell v={r.plus} /></span>
            <span role="cell" className="text-center"><Cell v={r.pro} pro /></span>
          </div>
        ))}
        <div aria-hidden className="h-[18px]" />
      </div>
    </section>
  );
}

export default function JkPricingView(view: JkPricingViewProps) {
  const { tiers: TIERS, starter } = getTiers();
  const phoneTiers = PHONE_ORDER.map((id) => TIERS.find((t) => t.plan.id === id)!);
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <JkEnter />
      <JkPublicHeader showPricing showNav overlay />
      <main className="flex-1">
        {/* Painted sea band behind the header and title, fading into the page. */}
        <section data-enter className="relative isolate" aria-labelledby="pricing-heading">
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[300px] overflow-hidden lg:h-[330px]">
            <JkArt name="waves" fade="bottom" live />
            {/* D18: page colour at 30% over the painting so the header and title read clearly. */}
            <div className="absolute inset-0 bg-background/30" />
            <div className="absolute inset-x-0 bottom-0 h-[214px] bg-gradient-to-b from-transparent to-background" />
          </div>
          <div className="mx-auto max-w-[1248px] px-5 pt-[141px] sm:px-6 min-[1100px]:text-center lg:pt-[150px]">
            <h1 id="pricing-heading" style={{ "--i": 0 } as React.CSSProperties} className="jk-enter text-[34px] font-medium leading-10 tracking-[-0.8px] text-hero-ink max-[359px]:text-[29px] max-[359px]:leading-[35px] sm:text-[44px] sm:leading-[50px] lg:text-[52px] lg:leading-[62px] lg:tracking-[-1.14px]">
              Start free. Pay when <br className="lg:hidden" />the search gets busy.
            </h1>
            <JkBillingSwitch annual={view.isAnnual} onChange={view.onAnnualChange} style={{ "--i": 1 } as React.CSSProperties} className="jk-enter mt-[22px] lg:mt-6" />
          </div>
        </section>

        <div data-enter className="mx-auto max-w-[1248px] px-5 pt-[34px] sm:px-6 lg:pt-10">
          {/* Stacked, Pro first, until 1100px, where three columns fit price and ship side by side. */}
          <div className="grid gap-3 min-[1100px]:hidden">
            {phoneTiers.map((t, i) => <div key={t.plan.id} className="jk-enter" style={{ "--i": i + 2 } as React.CSSProperties}><TierCard tier={t} view={view} /></div>)}
          </div>
          <div className="hidden grid-cols-3 gap-4 min-[1100px]:grid">
            {TIERS.map((t, i) => <div key={t.plan.id} className="jk-enter" style={{ "--i": i + 2 } as React.CSSProperties}><TierCard tier={t} view={view} /></div>)}
          </div>
          <div className="jk-enter mt-3 lg:mt-4" style={{ "--i": 5 } as React.CSSProperties}><StarterStrip view={view} starter={starter} /></div>
          <p className="mt-[17px] font-mono text-[9px] uppercase tracking-[1.2px] text-subtle-foreground min-[1100px]:text-center lg:mt-[22px] lg:text-[10px]">
            Every plan includes unlimited edits · Cancel anytime
          </p>

          <Compare />

          <section data-enter aria-label="Common questions" className="mt-7 border-t border-border min-[900px]:mt-[52px] min-[900px]:grid min-[900px]:grid-cols-3 min-[900px]:gap-8 min-[900px]:pt-9">
            {ANSWERS.map((x) => (
              <div key={x.q} style={{ "--i": ANSWERS.indexOf(x) } as React.CSSProperties} className="jk-enter flex gap-[13px] border-b border-border py-[22px] min-[900px]:border-0 min-[900px]:py-0">
                <JkTick tone={x.tone} className="h-11 min-[900px]:h-3.5 min-[900px]:mt-1" />
                <div>
                  <p className="text-base font-medium text-foreground">{x.q}</p>
                  <p className="mt-1 text-sm leading-[21px] text-muted-foreground">{x.a}</p>
                </div>
              </div>
            ))}
          </section>

        </div>
        {/* A subtle rule at content width starts the footer off, at every width. */}
        <div className="mx-auto mt-6 max-w-[1248px] px-5 sm:px-6 min-[900px]:mt-16">
          <div aria-hidden className="h-px bg-gradient-to-r from-transparent via-border-strong/60 to-transparent" />
        </div>
        <div className="[&>footer]:border-t-0"><JkFooter /></div>
      </main>
    </div>
  );
}
