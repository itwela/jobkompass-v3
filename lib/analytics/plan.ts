/**
 * Map a public Stripe price id to the plan slug already used in the app.
 * Used only to label checkout success. Never returns the price id itself.
 */

export type MappedPlan = {
  plan_id: "starter" | "plus" | "plus-annual" | "pro" | "pro-annual";
  interval: "month" | "year" | "one_time";
};

export function planFromPriceId(
  priceId: string,
  env: Record<string, string | undefined> = process.env
): MappedPlan | null {
  const table: Array<[string | undefined, MappedPlan]> = [
    [env.NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID, { plan_id: "starter", interval: "one_time" }],
    [env.NEXT_PUBLIC_STRIPE_PLUS_PRICE_ID, { plan_id: "plus", interval: "month" }],
    [env.NEXT_PUBLIC_STRIPE_PLUS_ANNUAL_PRICE_ID, { plan_id: "plus-annual", interval: "year" }],
    [env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID, { plan_id: "pro", interval: "month" }],
    [env.NEXT_PUBLIC_STRIPE_PRO_ANNUAL_PRICE_ID, { plan_id: "pro-annual", interval: "year" }],
  ];
  for (const [id, mapped] of table) {
    if (id && id === priceId) return mapped;
  }
  return null;
}
