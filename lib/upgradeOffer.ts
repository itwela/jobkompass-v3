/**
 * What the Upgrade modal (D15 / M17) says for a given locked feature: which plan unlocks it,
 * the headline that names the feature, and what that plan adds over the current one
 * ("180 AI documents a month, up from 60"). Pure so it can be tested; limits are passed in
 * from hooks/useFeatureAccess.ts PLAN_LIMITS, prices come from jkPricing.tsx `plans`.
 */

export type JkPaidTarget = "plus" | "pro";

export interface JkPlanLimits {
  documentsPerMonth: number;
  jobsLimit: number | null;
}

export interface JkUpgradeOffer {
  /** Plan to offer, or null when the person is already on the top plan. */
  target: JkPaidTarget | null;
  headline: string;
  /** Plan name for "You are on {current}." */
  currentName: string;
  adds: string[];
}

const NAMES: Record<string, string> = { free: "Free", starter: "Starter", plus: "Plus", pro: "Pro" };

/** "plus-annual" -> "plus" */
export function basePlanId(planId?: string | null): string {
  const id = (planId || "free").toLowerCase().replace(/-annual$/, "");
  return NAMES[id] ? id : "free";
}

export function planName(planId?: string | null): string {
  return NAMES[basePlanId(planId)];
}

const RANK: Record<string, number> = { free: 0, starter: 1, plus: 2, pro: 3 };

/** One tier up, for limits: Free/Starter -> Plus, Plus -> Pro, Pro -> none. */
function nextTier(current: string): JkPaidTarget | null {
  return RANK[current] < RANK.plus ? "plus" : RANK[current] < RANK.pro ? "pro" : null;
}

function addsFor(target: JkPaidTarget, current: string, limits: Record<string, JkPlanLimits>): string[] {
  const cur = limits[current] ?? limits.free;
  const tgt = limits[target];
  const docs = `${tgt.documentsPerMonth} AI documents a month, up from ${cur.documentsPerMonth}`;
  const jobs = tgt.jobsLimit === null
    ? cur.jobsLimit === null ? null : `Unlimited tracked jobs, up from ${cur.jobsLimit}`
    : cur.jobsLimit !== null && cur.jobsLimit >= tgt.jobsLimit ? null : `Track up to ${tgt.jobsLimit} jobs, up from ${cur.jobsLimit}`;
  if (target === "pro") {
    return ["jk CLI and agent access", docs, jobs, "Mar resume template", "Priority support"].filter(Boolean) as string[];
  }
  return [
    docs,
    jobs,
    RANK[current] < RANK.starter ? "Joseph resume template" : null,
    "Chrome extension",
    RANK[current] < RANK.starter ? "Search across your jobs, documents and chats" : null,
  ].filter(Boolean) as string[];
}

/**
 * @param feature   the feature that was blocked, as the callers name it ("Job tracking",
 *                  "AI-generated documents", "Search functionality", "jk CLI", "Mar resume template" …)
 * @param requiredPlan force the plan to offer (e.g. a template's minimum plan)
 */
export function upgradeOffer(
  feature: string,
  currentPlanId: string | null | undefined,
  limits: Record<string, JkPlanLimits>,
  requiredPlan?: JkPaidTarget,
): JkUpgradeOffer {
  const current = basePlanId(currentPlanId);
  const currentName = NAMES[current];
  const f = feature.toLowerCase();
  const at = (t: JkPaidTarget | null): JkPaidTarget | null => (t && RANK[current] >= RANK[t] ? nextTier(current) : t);

  let target: JkPaidTarget | null;
  let headline: string;
  if (f === "" || f === "plans") {
    target = requiredPlan ?? nextTier(current);
    headline = target ? `Upgrade to ${NAMES[target]}` : "You're on Pro";
  } else if (f.includes("cli") || f.includes("agent")) {
    target = at(requiredPlan ?? "pro");
    headline = "The jk CLI is part of Pro";
  } else if (f.includes("extension")) {
    target = at(requiredPlan ?? "plus");
    headline = `The Chrome extension is part of ${target ? NAMES[target] : "Plus"}`;
  } else if (f.includes("search")) {
    target = at(requiredPlan ?? "plus");
    headline = `Search is part of ${target ? NAMES[target] : "Plus"}`;
  } else if (f.includes("template")) {
    target = at(requiredPlan ?? "pro");
    const name = feature.replace(/\s*resume template/i, "").replace(/\s*template/i, "").trim();
    headline = `The ${name} template is part of ${target ? NAMES[target] : "Pro"}`;
  } else if (f.includes("document")) {
    target = requiredPlan ?? nextTier(current);
    headline = target
      ? `${limits[target].documentsPerMonth} AI documents a month with ${NAMES[target]}`
      : `You've used this month's ${limits[current].documentsPerMonth} AI documents`;
  } else if (f.includes("job")) {
    target = requiredPlan ?? (current === "free" ? "plus" : nextTier(current) && "pro");
    headline = target
      ? limits[target].jobsLimit === null ? "Track every job with Pro" : `Track up to ${limits[target].jobsLimit} jobs with ${NAMES[target]}`
      : "You've reached your job limit";
  } else {
    target = at(requiredPlan ?? nextTier(current));
    headline = target ? `${feature} is part of ${NAMES[target]}` : feature;
  }

  return { target, headline, currentName, adds: target ? addsFor(target, current, limits) : [] };
}

/** "Nov 19" — the day a trial that starts now ends. */
export function trialEndLabel(days: number, now: Date = new Date()): string {
  const d = new Date(now);
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** "$179.99" -> 179.99 */
export function priceNumber(price: string): number {
  return Number(price.replace(/[^0-9.]/g, ""));
}

export function formatUsd(n: number): string {
  return `$${n.toFixed(2)}`;
}
