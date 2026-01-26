import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_default", {
  apiVersion: "2025-12-15.clover",
});

export async function POST(request: NextRequest) {
  try {
    const { priceId, userId, email, customerId } = await request.json();
    
    if (!priceId) {
      return NextResponse.json({ error: "Price ID is required" }, { status: 400 });
    }
    
    // Build success and cancel URLs
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
      (process.env.NEXT_PUBLIC_VERCEL_URL 
        ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` 
        : "http://localhost:3000");
    
    // Create or retrieve customer
    let customer: Stripe.Customer;
    if (customerId) {
      customer = await stripe.customers.retrieve(customerId) as Stripe.Customer;
    } else if (email) {
      // Try to find existing customer by email
      const existingCustomers = await stripe.customers.list({
        email,
        limit: 1,
      });
      
      if (existingCustomers.data.length > 0) {
        customer = existingCustomers.data[0];
      } else {
        // Create new customer
        customer = await stripe.customers.create({
          email,
          metadata: {
            userId: userId || "",
          },
        });
      }
    } else {
      return NextResponse.json({ error: "Email or customer ID required" }, { status: 400 });
    }
    
    // Retrieve the price to determine if it's recurring
    const price = await stripe.prices.retrieve(priceId);
    const isRecurring = price.type === "recurring";
    
    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: isRecurring ? "subscription" : "payment",
      success_url: `${baseUrl}/stripe/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/pricing`,
      metadata: {
        userId: userId || "",
      },
      // Enable trial if it's a subscription
      subscription_data: isRecurring ? {
        metadata: {
          userId: userId || "",
        },
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

