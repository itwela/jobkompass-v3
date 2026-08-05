/**
 * Plan tiers as comparable ranks. Every paywall in the app is a rank comparison
 * against this module.
 *
 * Deliberately free of Convex imports: this is loaded by Convex functions, by
 * Next.js route handlers, and by vitest, so it must stay plain TypeScript.
 */

export type PlanRank = 0 | 1 | 2 | 3;

export const RANK_FREE = 0 as const;
export const RANK_STARTER = 1 as const;
export const RANK_PLUS = 2 as const;
export const RANK_PRO = 3 as const;

/** The shape read off a `subscriptions` row. Loose on purpose so callers can pass raw docs. */
export interface PlanSubscriptionLike {
  planId?: string | null;
  status?: string | null;
}

const PLAN_RANKS: Record<string, PlanRank> = {
  free: RANK_FREE,
  starter: RANK_STARTER,
  plus: RANK_PLUS,
  "plus-annual": RANK_PLUS,
  pro: RANK_PRO,
  "pro-annual": RANK_PRO,
};

/**
 * `past_due` counts as active: a failed card retry should not kill someone's
 * access for the days Stripe spends retrying.
 */
const ACTIVE_STATUSES = new Set(["active", "trialing", "past_due"]);

const RANK_LABELS: Record<PlanRank, string> = {
  [RANK_FREE]: "Free",
  [RANK_STARTER]: "Starter",
  [RANK_PLUS]: "Plus",
  [RANK_PRO]: "Pro",
};

export function planRank(sub: PlanSubscriptionLike | null | undefined): PlanRank {
  const planId = (sub?.planId ?? "free").toLowerCase();
  const status = (sub?.status ?? "").toLowerCase();
  const rank = PLAN_RANKS[planId] ?? RANK_FREE;
  if (rank === RANK_FREE) return RANK_FREE;
  // An empty status on a paid plan is honored: older subscription rows were
  // written without one. Mirrors convex/usage.ts:203.
  if (status === "") return rank;
  return ACTIVE_STATUSES.has(status) ? rank : RANK_FREE;
}

export function meetsTier(
  sub: PlanSubscriptionLike | null | undefined,
  minRank: PlanRank
): boolean {
  return planRank(sub) >= minRank;
}

/**
 * The pre-existing "Pro never demotes" rule, extracted verbatim from
 * convex/usage.ts:186 so job limits keep behaving exactly as they do today.
 *
 * This intentionally ignores `status` and therefore disagrees with `planRank`.
 * That divergence is the point: job limits forgive a lapsed Pro, paywalls do
 * not. Do not "reconcile" these two functions.
 */
export function hasProPlanEver(sub: PlanSubscriptionLike | null | undefined): boolean {
  const planId = (sub?.planId ?? "free").toLowerCase();
  return planId === "pro" || planId === "pro-annual";
}

export function rankLabel(rank: PlanRank): string {
  return RANK_LABELS[rank];
}
