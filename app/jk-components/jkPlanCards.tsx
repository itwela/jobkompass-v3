'use client'

import { useState } from "react";
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
      <div className="mb-6 inline-flex rounded-full border border-border-strong/70 bg-card p-1 text-sm" role="group" aria-label="Billing period">
        {[false, true].map((v) => (
          <button
            key={String(v)}
            type="button"
            aria-pressed={annual === v}
            onClick={() => setAnnual(v)}
            className={cn("rounded-full px-4 py-1.5 transition-colors", annual === v ? "bg-accent font-medium text-foreground" : "text-muted-foreground hover:text-foreground")}
          >
            {v ? "Annual, save 25%" : "Monthly"}
          </button>
        ))}
      </div>

      <div className={cn("grid gap-3 xl:gap-2.5", layout === "columns" ? (includeFree ? "sm:grid-cols-2 xl:grid-cols-4" : "md:grid-cols-3") : "grid-cols-1")}>
        {list.map((plan, i) => {
          const highlighted = Boolean(plan.popular);
          const { price, unit, note } = planPrice(plan, annual);
          const isCurrent = current != null && (current === plan.id || current === `${plan.id}-annual`);
          return (
            <div
              key={plan.id}
              className={cn(
                "relative flex flex-col overflow-hidden rounded-modal border",
                highlighted ? "border-plan bg-accent/60" : "border-border-strong/70 bg-card",
              )}
            >
              {showArt && TIER_SHIP[plan.id] && (
                <div className="relative h-44 shrink-0">
                  <JkArt name={TIER_SHIP[plan.id]} fade="bottom" position="center 72%" />
                </div>
              )}
              {(isCurrent || highlighted) && (
                <span className={cn("jk-eyebrow absolute right-4 top-4 rounded-full px-2.5 py-1", isCurrent ? "border border-input bg-background/80 text-muted-foreground" : "bg-background/80 font-medium text-plan-text")}>
                  {isCurrent ? "Your plan" : "Most used"}
                </span>
              )}
              <div className="flex flex-1 flex-col p-5 pt-4">
              <p className="mb-2 flex items-center gap-2.5 font-medium text-foreground">
                <JkTick tone={(Math.min(i + (includeFree ? 1 : 2), 4)) as 1 | 2 | 3 | 4} className="h-3.5" />
                {plan.name}
              </p>
              <p className="flex items-baseline gap-1.5">
                <span className="text-5xl font-medium tracking-tight text-foreground">{price}</span>
                {unit && <span className="font-mono text-xs text-subtle-foreground">{unit}</span>}
              </p>
              <p className="mt-2 min-h-10 text-sm text-muted-foreground">
                {plan.description}
                {note ? `. ${note}.` : ""}
              </p>
              <ul className="my-5 flex-1 space-y-2.5 border-t border-border pt-5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-foreground">
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
      <p className="jk-eyebrow mt-4 text-subtle-foreground">Every plan includes unlimited edits · Cancel anytime</p>
    </div>
  );
}
