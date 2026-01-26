import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_default", {
  apiVersion: "2025-12-15.clover",
});

export async function POST(request: NextRequest) {
  try {
    const { customerId } = await request.json();
    
    if (!customerId) {
      return NextResponse.json({ error: "Customer ID is required" }, { status: 400 });
    }
    
    // Build return URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
      (process.env.NEXT_PUBLIC_VERCEL_URL 
        ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` 
        : "http://localhost:3000");
    
    // Create customer portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${baseUrl}/app`, // Return to main app page (settings is a mode, not a route)
    });
    
    return NextResponse.json({
      url: session.url,
    });
  } catch (error: any) {
    console.error("Stripe portal error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create portal session" },
      { status: 500 }
    );
  }
}

