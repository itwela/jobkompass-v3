import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_default", {
  apiVersion: "2024-11-20.acacia",
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "whsec_default";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        
        if (session.mode === "subscription" && session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(
            session.subscription as string
          );
          
          // Map Stripe price ID to plan ID
          const priceId = subscription.items.data[0]?.price.id || "";
          const planId = mapPriceIdToPlanId(priceId);
          
          await convex.mutation(api.subscriptions.updateSubscriptionWithUserId, {
            userId: userId || "",
            stripeSubscriptionId: subscription.id,
            stripeCustomerId: subscription.customer as string,
            status: subscription.status === "active" || subscription.status === "trialing" ? "active" : subscription.status,
            planId,
            currentPeriodStart: subscription.current_period_start * 1000,
            currentPeriodEnd: subscription.current_period_end * 1000,
            trialEnd: subscription.trial_end ? subscription.trial_end * 1000 : undefined,
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
          });
        }
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const priceId = subscription.items.data[0]?.price.id || "";
        const planId = mapPriceIdToPlanId(priceId);
        
        await convex.mutation(api.subscriptions.updateSubscriptionFromWebhook, {
          stripeSubscriptionId: subscription.id,
          status: subscription.status === "active" || subscription.status === "trialing" ? "active" : subscription.status,
          planId,
          currentPeriodStart: subscription.current_period_start * 1000,
          currentPeriodEnd: subscription.current_period_end * 1000,
          trialEnd: subscription.trial_end ? subscription.trial_end * 1000 : undefined,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
        });
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("Webhook processing error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function mapPriceIdToPlanId(priceId: string): string {
  // Map Stripe price IDs to your plan IDs
  if (priceId.includes("starter")) return "starter";
  if (priceId.includes("plus_annual") || priceId.includes("plus-annual")) return "plus-annual";
  if (priceId.includes("pro_annual") || priceId.includes("pro-annual")) return "pro-annual";
  if (priceId.includes("plus")) return "plus";
  if (priceId.includes("pro")) return "pro";
  return "free";
}

