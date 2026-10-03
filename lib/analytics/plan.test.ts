import { describe, expect, it } from "vitest";
import { planFromPriceId } from "./plan";

describe("planFromPriceId", () => {
  const env = {
    NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID: "price_starter",
    NEXT_PUBLIC_STRIPE_PLUS_PRICE_ID: "price_plus",
    NEXT_PUBLIC_STRIPE_PLUS_ANNUAL_PRICE_ID: "price_plus_year",
    NEXT_PUBLIC_STRIPE_PRO_PRICE_ID: "price_pro",
    NEXT_PUBLIC_STRIPE_PRO_ANNUAL_PRICE_ID: "price_pro_year",
  };

  it("maps known public price ids to plan slugs", () => {
    expect(planFromPriceId("price_starter", env)).toEqual({ plan_id: "starter", interval: "one_time" });
    expect(planFromPriceId("price_plus_year", env)).toEqual({ plan_id: "plus-annual", interval: "year" });
    expect(planFromPriceId("price_pro", env)).toEqual({ plan_id: "pro", interval: "month" });
  });

  it("returns null for an unknown price so the id is not forwarded", () => {
    expect(planFromPriceId("price_live_secret", env)).toBeNull();
  });
});
