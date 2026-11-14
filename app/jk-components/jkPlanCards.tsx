'use client'

import { useState } from "react";
import JkBillingSwitch from "./jkBillingSwitch";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { plans, type Plan } from "./jkPricing";
import { JkTick } from "./jkBars";
import JkArt, { type JkArtName } from "./jkArt";

/** One ship per tier, smallest boat to full-rigged ship. */
const TIER_SHIP: Record<string, JkArtName> = { free: "ship1", starter: "ship2", plus: "ship3", pro: "ship4" };

/** The free tier, in the same words the pricing page uses for it. */
export const freePlan: Plan = {
  id: "free",
  name: "Free",
  description: "For trying it out",
  features: ["3 AI documents per month", "Unlimited edits", "Track up to 10 jobs", "Basic templates"],
};

export function planPrice(plan: Plan, isAnnual: boolean): { price: string; unit: string; note?: string } {
  if (plan.id === "free") return { price: "$0", unit: "" };
  if (plan.isOneTime) return { price: plan.oneTimePrice ?? "", unit: "one-time" };
  if (!plan.pricing) return { price: "", unit: "" };
  const p = isAnnual ? plan.pricing.annual : plan.pricing.monthly;
  return { price: p.price, unit: isAnnual ? "/year" : "/month", note: `${p.trialDays}-day free trial` };
}

interface JkPlanCardsProps {
  /** Plan id the signed-in user is on, if any. */
  current?: string | null;
  /** columns: every plan side by side. single: paid plans stacked, for modals and narrow panels. */
  layout?: "columns" | "single";
  includeFree?: boolean;
  /** Show each tier's ship painting at the top of its card. */
  showArt?: boolean;
  isAnnual?: boolean;
  onAnnualChange?: (annual: boolean) => void;
  /** The button (or link) for a plan. The caller owns checkout and analytics. */
  renderAction: (plan: Plan, opts: { isAnnual: boolean; highlighted: boolean }) => React.ReactNode;
  className?: string;
}

/** The one paywall block: landing, /pricing, upgrade modal and Settings all render this. */
export default function JkPlanCards({ current, layout = "columns", includeFree = true, showArt = false, isAnnual, onAnnualChange, renderAction, className }: JkPlanCardsProps) {
  const [localAnnual, setLocalAnnual] = useState(false);
  const annual = isAnnual ?? localAnnual;
  const setAnnual = (v: boolean) => (onAnnualChange ? onAnnualChange(v) : setLocalAnnual(v));
  const list = includeFree ? [freePlan, ...plans] : plans;

  return (
    <div className={className}>
      <JkBillingSwitch annual={annual} onChange={setAnnual} className={showArt ? "mb-5 lg:mb-6" : "mb-6"} />

      <div className={cn("grid gap-3 xl:gap-2.5", showArt && "gap-3.5", layout === "columns" ? (includeFree ? "sm:grid-cols-2 xl:grid-cols-4" : "md:grid-cols-3") : "grid-cols-1")}>
        {list.map((plan, i) => {
          const highlighted = Boolean(plan.popular);
          const { price, unit, note } = planPrice(plan, annual);
          const isCurrent = current != null && (current === plan.id || current === `${plan.id}-annual`);
          return (
            <div
              key={plan.id}
              data-plan-card
              className={cn(
                "relative flex flex-col overflow-hidden rounded-modal border",
                showArt && "max-lg:rounded-[26px]",
                highlighted ? "jk-glow border-plan" : "border-border-strong/70 bg-card",
              )}
            >
              {showArt && TIER_SHIP[plan.id] && (
                // The whole ship in a 162px spot at the card's top right, faded on every side (M00).
                // Never cropped into a wide band: that zooms the painting.
                <div className="absolute right-[3px] top-1.5 size-[162px] xl:relative xl:right-auto xl:top-auto xl:mx-auto xl:-mb-3 xl:mt-1.5 xl:size-[180px]">
                  <JkArt name={TIER_SHIP[plan.id]} variant="spot" live hoverHost="[data-plan-card]" />
                </div>
              )}
              {(isCurrent || highlighted) && (
                <span className={cn(showArt && !isCurrent && "hidden", "jk-eyebrow absolute right-4 top-4 rounded-full px-2.5 py-1", isCurrent ? "border border-input bg-background/80 text-muted-foreground" : "bg-background/80 font-medium text-plan-text")}>
                  {isCurrent ? "Your plan" : "Most used"}
                </span>
              )}
              <div className={cn("relative flex flex-1 flex-col p-5 pt-4", showArt && "pb-4 pt-[22px]")}>
              <p className={cn("mb-2 flex items-center gap-2.5 font-medium text-foreground", showArt && "mb-0 gap-[11px] text-base")}>
                <JkTick tone={(Math.min(i + (includeFree ? 1 : 2), 4)) as 1 | 2 | 3 | 4} className="h-3.5" />
                {plan.name}
                {showArt && highlighted && !isCurrent && (
                  <span className="ml-1.5 flex h-[18px] items-center rounded-full bg-plan/20 px-[7px] font-mono text-[9.5px] font-bold uppercase tracking-[0.8px] text-plan-text">Most used</span>
                )}
              </p>
              <p className={cn("flex items-baseline gap-1.5", showArt && "mt-[11px] gap-1")}>
                <span className={cn("text-5xl font-medium tracking-tight text-foreground", showArt && "text-[40px] leading-[48px] tracking-[-1px]")}>{price}</span>
                {unit && <span className={cn("font-mono text-xs text-subtle-foreground", showArt && "text-[11.5px]")}>{unit}</span>}
              </p>
              <p className={cn("mt-2 min-h-10 text-sm text-muted-foreground", showArt && "relative mt-1.5 min-h-[76px] max-w-[165px] text-[13px] leading-[19px] xl:min-h-[38px] xl:max-w-none")}>
                {plan.description}
                {note ? `. ${note}.` : ""}
              </p>
              <ul className={cn("my-5 flex-1 space-y-2.5 border-t border-border pt-5", showArt && "mb-[22px] mt-[18px] space-y-[7px] pt-2.5", showArt && highlighted && "border-border-strong")}>
                {plan.features.map((f) => (
                  <li key={f} className={cn("flex items-start gap-2.5 text-sm text-foreground", showArt && "items-center gap-[11px] text-[13.5px] leading-[19px]")}>
                    <Check className={cn("mt-0.5 size-4 shrink-0", highlighted ? "text-plan-text" : "text-ok")} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              {renderAction(plan, { isAnnual: annual, highlighted })}
              </div>
            </div>
          );
        })}
      </div>
      <p className={cn("jk-eyebrow mt-4 text-subtle-foreground", showArt && "mt-[19px] text-[9px] tracking-[1.2px] lg:mt-4 lg:text-[0.6875rem] lg:tracking-[0.14em]")}>Every plan includes unlimited edits · Cancel anytime</p>
    </div>
  );
}
