# Stripe Integration Setup Guide

This guide shows you exactly how to set up Stripe subscriptions with Convex, including cancellation handling and billing management.

## Step 1: Install Stripe

```bash
npm install stripe
```

## Step 2: Environment Variables

Add to `.env.local`:

```bash
# Stripe API Keys
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# Stripe Price IDs (get these from Stripe Dashboard → Products)
NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID=price_xxx
NEXT_PUBLIC_STRIPE_PLUS_PRICE_ID=price_xxx
NEXT_PUBLIC_STRIPE_PRO_PRICE_ID=price_xxx
NEXT_PUBLIC_STRIPE_PLUS_ANNUAL_PRICE_ID=price_xxx
NEXT_PUBLIC_STRIPE_PRO_ANNUAL_PRICE_ID=price_xxx

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000  # or https://yourdomain.com
```

## Step 3: Stripe Dashboard Setup

### 3.1 Create Products and Prices

1. Go to Stripe Dashboard → Products
2. Create these products:
   - **7-Day Starter**: $2.99 one-time payment
   - **Plus Plan**: $9.99/month recurring (3-day trial)
   - **Pro Plan**: $19.99/month recurring (3-day trial)
   - **Plus Annual**: $89.99/year recurring (7-day trial)
   - **Pro Annual**: $179.99/year recurring (7-day trial)
3. Copy each Price ID and add to `.env.local`

### 3.2 Configure Webhooks

1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://yourdomain.com/api/stripe/webhook`
   - For local: `stripe listen --forward-to localhost:3000/api/stripe/webhook`
3. Select these events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Copy the Webhook Signing Secret to `.env.local` as `STRIPE_WEBHOOK_SECRET`

### 3.3 Configure Customer Portal

1. Go to Stripe Dashboard → Settings → Billing → Customer portal
2. Enable Customer Portal
3. Allow customers to:
   - Update payment method
   - Cancel subscription
   - Update subscription (plan changes)
   - View invoices
4. Set return URL: `http://localhost:3000/settings` (or production URL)

## Step 4: Create API Endpoints

### 4.1 Checkout Endpoint (`app/api/stripe/checkout/route.ts`)

```typescript
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-12-15.clover",
});

export async function POST(request: NextRequest) {
  try {
    const { priceId, userId, email, customerId } = await request.json();
    
    if (!priceId) {
      return NextResponse.json({ error: "Price ID is required" }, { status: 400 });
    }
    
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    
    // Get or create customer
    let customer: Stripe.Customer;
    if (customerId) {
      customer = await stripe.customers.retrieve(customerId) as Stripe.Customer;
    } else if (email) {
      const existingCustomers = await stripe.customers.list({ email, limit: 1 });
      customer = existingCustomers.data.length > 0 
        ? existingCustomers.data[0]
        : await stripe.customers.create({
            email,
            metadata: { userId: userId || "" },
          });
    } else {
      return NextResponse.json({ error: "Email or customer ID required" }, { status: 400 });
    }
    
    // Determine if recurring
    const price = await stripe.prices.retrieve(priceId);
    const isRecurring = price.type === "recurring";
    
    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: isRecurring ? "subscription" : "payment",
      success_url: `${baseUrl}/stripe/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/pricing`,
      metadata: { userId: userId || "" },
      subscription_data: isRecurring ? {
        metadata: { userId: userId || "" },
      } : undefined,
    });
    
    return NextResponse.json({
      checkoutUrl: session.url,
      sessionId: session.id,
    });
  } catch (error: any) {
    console.error("Stripe checkout error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
```

### 4.2 Customer Portal Endpoint (`app/api/stripe/portal/route.ts`)

```typescript
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-12-15.clover",
});

export async function POST(request: NextRequest) {
  try {
    const { customerId } = await request.json();
    
    if (!customerId) {
      return NextResponse.json({ error: "Customer ID is required" }, { status: 400 });
    }
    
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${baseUrl}/settings`,
    });
    
    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error("Stripe portal error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create portal session" },
      { status: 500 }
    );
  }
}
```

### 4.3 Webhook Endpoint (`app/api/stripe/webhook/route.ts`)

```typescript
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-12-15.clover",
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

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
          
          const priceId = subscription.items.data[0]?.price.id || "";
          const planId = mapPriceIdToPlanId(priceId);
          
          const subData = subscription as any;
          await convex.mutation(api.subscriptions.updateSubscriptionWithUserId, {
            userId: userId || "",
            name: customerName, // Store customer name for debugging
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
        
        // Get userId from subscription metadata first, then customer metadata
        let userId: string | undefined = subscription.metadata?.userId;
        
        // Get customer name for debugging
        let customerName: string | undefined;
        
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
        
        // Handle cancellation
        const isCanceling = !!(subData.cancel_at || subscription.cancel_at_period_end);
        const cancelAtPeriodEnd = subscription.cancel_at_period_end || !!subData.cancel_at;
        
        let status = subscription.status;
        if (subData.canceled_at) {
          status = "canceled";
        }
        
        if (userId) {
          await convex.mutation(api.subscriptions.updateSubscriptionWithUserId, {
            userId: userId,
            name: customerName, // Store customer name for debugging
            stripeSubscriptionId: subscription.id,
            stripeCustomerId: subscription.customer as string,
            status: status === "active" || status === "trialing" ? "active" : status,
            planId,
            currentPeriodStart: subData.current_period_start * 1000,
            currentPeriodEnd: subData.current_period_end * 1000,
            trialEnd: subData.trial_end ? subData.trial_end * 1000 : undefined,
            cancelAtPeriodEnd: cancelAtPeriodEnd,
          });
        } else {
          await convex.mutation(api.subscriptions.updateSubscriptionFromWebhook, {
            stripeSubscriptionId: subscription.id,
            status: status === "active" || status === "trialing" ? "active" : status,
            planId,
            currentPeriodStart: subData.current_period_start * 1000,
            currentPeriodEnd: subData.current_period_end * 1000,
            trialEnd: subData.trial_end ? subData.trial_end * 1000 : undefined,
            cancelAtPeriodEnd: cancelAtPeriodEnd,
          });
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
  if (priceId === process.env.NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID) return "starter";
  if (priceId === process.env.NEXT_PUBLIC_STRIPE_PLUS_ANNUAL_PRICE_ID) return "plus-annual";
  if (priceId === process.env.NEXT_PUBLIC_STRIPE_PRO_ANNUAL_PRICE_ID) return "pro-annual";
  if (priceId === process.env.NEXT_PUBLIC_STRIPE_PLUS_PRICE_ID) return "plus";
  if (priceId === process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID) return "pro";
  return "free";
}
```

## Step 5: Frontend Implementation

### 5.1 Pricing Page Button Logic

In your pricing component, use this logic:

```typescript
const getButtonText = (plan: Plan) => {
  // Show "Renew Today" if current plan and canceled
  if (isCurrentPlan(plan) && subscription?.status === 'canceled') {
    return 'Renew Today'
  }
  if (isCurrentPlan(plan)) return 'Current Plan'
  // ... other cases
}

// Button disabled state
disabled={
  isLoading || 
  loadingPlan === plan.id || 
  (isCurrentPlan(plan) && subscription?.status !== 'canceled')
}
```

### 5.2 Sidebar Badge for Canceled Subscriptions

```typescript
// In sidebar user menu
{planId && planId !== 'free' && (
  <span 
    className="px-2 py-0.5 rounded-full text-xs font-medium"
    style={
      subscription?.status === 'canceled'
        ? { backgroundColor: 'var(--chart-4)', color: 'var(--foreground)' }
        : // ... other styles
    }
  >
    {subscription?.status === 'canceled' ? (
      planId === 'pro' || planId === 'pro-annual' ? 'Renew Pro' : 'Renew Plus'
    ) : (
      // ... normal plan display
    )}
  </span>
)}
```

### 5.3 Settings Page - Manage Billing

```typescript
const handleManageBilling = async () => {
  if (!subscription?.stripeCustomerId) {
    toast.error('No billing information found')
    return
  }

  const res = await fetch('/api/stripe/portal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customerId: subscription.stripeCustomerId }),
  })

  const data = await res.json()
  if (data.url) {
    window.location.href = data.url
  }
}
```

## Step 6: Plan ID Mapping

**Plan IDs used in Convex:**
- `"free"` - No subscription
- `"starter"` - One-time 7-day starter
- `"plus"` - Monthly Plus plan
- `"plus-annual"` - Annual Plus plan
- `"pro"` - Monthly Pro plan
- `"pro-annual"` - Annual Pro plan

**Important:** The `mapPriceIdToPlanId` function must match your environment variables exactly.

## Step 7: Monthly vs Annual Plan Display

When showing "Current Plan" on pricing page, check exact billing period:

```typescript
const isCurrentPlan = (plan: Plan) => {
  if (plan.id === 'starter') return planId === 'starter'
  if (plan.id === 'plus') {
    return isAnnual ? planId === 'plus-annual' : planId === 'plus'
  }
  if (plan.id === 'pro') {
    return isAnnual ? planId === 'pro-annual' : planId === 'pro'
  }
  return plan.id === planId
}
```

This ensures monthly Plus users don't see "Current Plan" on annual Plus card.

## Step 8: Handling Canceled Subscriptions in UI

### 8.1 Settings Page - Thank You Message

Show plan name even when subscription is canceled:

```typescript
const getPlanDisplayName = () => {
  // Use planId directly, not isPro/isPlus flags
  if (planId === 'pro-annual') return 'Pro Annual'
  if (planId === 'pro') return 'Pro'
  if (planId === 'plus-annual') return 'Plus Annual'
  if (planId === 'plus') return 'Plus'
  if (planId === 'starter') return 'Starter'
  return 'Free'
}

// Display logic
{planId && planId !== 'free' && (
  <div>
    <p>Thank you for being a <span>{getPlanDisplayName()}</span> member! 🎉</p>
    {subscription?.status === 'canceled' && (
      <p>
        Your subscription is canceled. 
        <Link href="/pricing">Renew today</Link> to continue enjoying all benefits.
      </p>
    )}
  </div>
)}
```

**Key:** Check `planId !== 'free'` NOT `!isFree` - this ensures canceled subscriptions still show the thank you message.

### 8.2 Subscription Provider Logic

The subscription provider should check planId directly:

```typescript
const value: SubscriptionContextType = {
  subscription,
  isLoading: subscription === undefined,
  isFree: !subscription || planId === 'free', // Only free if no subscription OR planId is 'free'
  isStarter: planId === 'starter' && (status === 'active' || status === 'trialing'),
  isPlus: (planId === 'plus' || planId === 'plus-annual') && (status === 'active' || status === 'trialing'),
  isPro: (planId === 'pro' || planId === 'pro-annual') && (status === 'active' || status === 'trialing'),
  isPlusAnnual: planId === 'plus-annual' && (status === 'active' || status === 'trialing'),
  isProAnnual: planId === 'pro-annual' && (status === 'active' || status === 'trialing'),
  hasActiveSubscription: status === 'active' || status === 'trialing',
  isTrialing: status === 'trialing',
  planId, // Always available, even if canceled
}
```

## Step 9: Webhook Cancellation Handling (Detailed)

The webhook must handle all cancellation scenarios:

```typescript
case "customer.subscription.updated": {
  const subscription = event.data.object as Stripe.Subscription;
  
  // Get userId - try subscription metadata first, then customer metadata
  let userId: string | undefined = subscription.metadata?.userId;
  if (!userId && subscription.customer) {
    try {
      const customer = await stripe.customers.retrieve(subscription.customer as string);
      userId = (customer as any).metadata?.userId;
    } catch (e) {
      console.error("Failed to retrieve customer:", e);
    }
  }
  
  // Handle old format: "convexId|tokenIdentifier"
  if (userId && userId.includes('|')) {
    const parts = userId.split('|');
    userId = parts[0]; // Extract Convex ID
  }
  
  const subData = subscription as any;
  
  // Determine cancellation status
  const cancelAtPeriodEnd = subscription.cancel_at_period_end || !!subData.cancel_at;
  let status = subscription.status;
  
  // If canceled_at is present, status is canceled
  if (subData.canceled_at) {
    status = "canceled";
  }
  
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
  
  // Update subscription with all cancellation info
  await convex.mutation(api.subscriptions.updateSubscriptionWithUserId, {
    userId: userId || "",
    name: customerName, // Store customer name for debugging
    stripeSubscriptionId: subscription.id,
    stripeCustomerId: subscription.customer as string,
    status: status === "active" || status === "trialing" ? "active" : status,
    planId: mapPriceIdToPlanId(subscription.items.data[0]?.price.id || ""),
    currentPeriodStart: subData.current_period_start * 1000,
    currentPeriodEnd: subData.current_period_end * 1000,
    trialEnd: subData.trial_end ? subData.trial_end * 1000 : undefined,
    cancelAtPeriodEnd: cancelAtPeriodEnd,
  });
  break;
}
```

**Important cancellation fields:**
- `cancel_at`: Timestamp when subscription will be canceled
- `cancel_at_period_end`: Boolean - true if canceling at period end
- `canceled_at`: Timestamp when subscription was canceled (if already canceled)
- `status`: Will be "canceled" if `canceled_at` is present

## Step 10: Usage Stats Display

Show usage stats in settings and sidebar:

```typescript
// In settings page
{planId && planId !== 'free' && (
  <div>
    <h3>Usage This Month</h3>
    <div>
      <span>AI-Generated Documents</span>
      <span>{usage.documentsUsed} / {usage.documentsLimit}</span>
      <div className="progress-bar" style={{
        width: `${(usage.documentsUsed / usage.documentsLimit) * 100}%`
      }} />
    </div>
    <div>
      <span>Jobs Tracked</span>
      <span>{usage.jobsUsed}{usage.jobsLimit !== null ? ` / ${usage.jobsLimit}` : ' (Unlimited)'}</span>
      {usage.jobsLimit !== null && (
        <div className="progress-bar" style={{
          width: `${(usage.jobsUsed / usage.jobsLimit) * 100}%`
        }} />
      )}
    </div>
  </div>
)}
```

**Note:** Documents are counted monthly only. Jobs are total count (not monthly).

## That's It!

Your Stripe integration is now set up with:
- ✅ Checkout flow
- ✅ Webhook handling (including detailed cancellation handling)
- ✅ Customer portal for billing management
- ✅ Frontend display for canceled subscriptions
- ✅ Plan change handling
- ✅ Monthly/annual plan distinction
- ✅ Thank you message showing plan even when canceled
- ✅ Renewal prompts for canceled subscriptions
- ✅ Usage stats display
