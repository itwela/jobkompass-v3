import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_default", {
  apiVersion: "2025-12-15.clover",
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
          ) as Stripe.Subscription;
          
          // Get customer name for debugging
          let customerName: string | undefined;
          if (subscription.customer) {
            try {
              const customer = await stripe.customers.retrieve(subscription.customer as string);
              customerName = (customer as any).name || (customer as any).email || undefined;
            } catch (e) {
              console.error("Failed to retrieve customer name:", e);
            }
          }
          
          // Map Stripe price ID to plan ID
          const priceId = subscription.items.data[0]?.price.id || "";
          const planId = mapPriceIdToPlanId(priceId);
          
          const subData = subscription as any;
          await convex.mutation(api.subscriptions.updateSubscriptionWithUserId, {
            userId: userId || "",
            name: customerName,
            stripeSubscriptionId: subscription.id,
            stripeCustomerId: subscription.customer as string,
            status: subscription.status === "active" || subscription.status === "trialing" ? "active" : subscription.status,
            planId,
            currentPeriodStart: subData.current_period_start * 1000,
            currentPeriodEnd: subData.current_period_end * 1000,
            trialEnd: subData.trial_end ? subData.trial_end * 1000 : undefined,
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
        
        // Try to get userId from subscription metadata first (most reliable)
        let userId: string | undefined = subscription.metadata?.userId;
        
        // Get customer name for debugging
        let customerName: string | undefined;
        
        // Fallback: try customer metadata if not in subscription metadata
        if (subscription.customer) {
          try {
            const customer = await stripe.customers.retrieve(subscription.customer as string);
            if (!userId) {
              userId = (customer as any).metadata?.userId;
            }
            customerName = (customer as any).name || (customer as any).email || undefined;
          } catch (e) {
            console.error("Failed to retrieve customer:", e);
          }
        }
        
        const subData = subscription as any;
        
        // Determine cancellation status
        // If cancel_at is set, the subscription is scheduled to cancel (even if cancel_at_period_end is false)
        const isCanceling = !!(subData.cancel_at || subscription.cancel_at_period_end);
        const cancelAtPeriodEnd = subscription.cancel_at_period_end || !!subData.cancel_at;
        
        // Determine status - if canceled_at is set, status should be canceled
        let status = subscription.status;
        if (subData.canceled_at) {
          status = "canceled";
        } else if (subscription.status === "active" || subscription.status === "trialing") {
          status = isCanceling ? "active" : "active"; // Keep active but mark as canceling
        }
        
        console.log(`[Webhook] Processing subscription update:`, {
          subscriptionId: subscription.id,
          userId,
          planId,
          status,
          cancelAtPeriodEnd,
          cancelAt: subData.cancel_at,
          canceledAt: subData.canceled_at,
          subscriptionMetadata: subscription.metadata,
        });
        
        // If we have userId, use the mutation that includes it (ensures convex_user_id is used)
        if (userId) {
          try {
            await convex.mutation(api.subscriptions.updateSubscriptionWithUserId, {
              userId: userId,
              name: customerName,
              stripeSubscriptionId: subscription.id,
              stripeCustomerId: subscription.customer as string,
              status: status === "active" || status === "trialing" ? "active" : status,
              planId,
              currentPeriodStart: subData.current_period_start * 1000,
              currentPeriodEnd: subData.current_period_end * 1000,
              trialEnd: subData.trial_end ? subData.trial_end * 1000 : undefined,
              cancelAtPeriodEnd: cancelAtPeriodEnd,
            });
            console.log(`[Webhook] Successfully updated subscription with userId`);
          } catch (error: any) {
            console.error(`[Webhook] Error updating subscription with userId:`, error);
            throw error;
          }
        } else {
          // Fallback: update without userId (only updates existing subscription)
          try {
            await convex.mutation(api.subscriptions.updateSubscriptionFromWebhook, {
              stripeSubscriptionId: subscription.id,
              status: status === "active" || status === "trialing" ? "active" : status,
              planId,
              currentPeriodStart: subData.current_period_start * 1000,
              currentPeriodEnd: subData.current_period_end * 1000,
              trialEnd: subData.trial_end ? subData.trial_end * 1000 : undefined,
              cancelAtPeriodEnd: cancelAtPeriodEnd,
            });
            console.log(`[Webhook] Successfully updated subscription without userId`);
          } catch (error: any) {
            console.error(`[Webhook] Error updating subscription without userId:`, error);
            throw error;
          }
        }
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
  // Map Stripe price IDs to your plan IDs by comparing against environment variables
  if (priceId === process.env.NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID) return "starter";
  if (priceId === process.env.NEXT_PUBLIC_STRIPE_PLUS_ANNUAL_PRICE_ID) return "plus-annual";
  if (priceId === process.env.NEXT_PUBLIC_STRIPE_PRO_ANNUAL_PRICE_ID) return "pro-annual";
  if (priceId === process.env.NEXT_PUBLIC_STRIPE_PLUS_PRICE_ID) return "plus";
  if (priceId === process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID) return "pro";
  return "free";
}

