# Stripe Integration Setup Guide

This guide will help you complete the Stripe integration setup.

## 1. Environment Variables

Add these to your `.env.local` file:

```bash
# Stripe API Keys
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# Stripe Price IDs (replace these with your actual Price IDs from Stripe Dashboard)
NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID=price_starter_default      # Starter plan (one-time)
NEXT_PUBLIC_STRIPE_PLUS_PRICE_ID=price_plus_default            # Plus plan (monthly)
NEXT_PUBLIC_STRIPE_PRO_PRICE_ID=price_pro_default              # Pro plan (monthly)
NEXT_PUBLIC_STRIPE_PLUS_ANNUAL_PRICE_ID=price_plus_annual_default    # Plus (annual)
NEXT_PUBLIC_STRIPE_PRO_ANNUAL_PRICE_ID=price_pro_annual_default      # Pro (annual)

# App URL (for redirects)
NEXT_PUBLIC_APP_URL=http://localhost:3000  # for development
# or https://yourdomain.com for production
```

## 2. Stripe Dashboard Setup

### Create Products and Prices

1. Go to Stripe Dashboard → Products
2. Create products with the following prices:
   - **7-Day Starter**: $2.99 one-time payment
   - **Plus Plan**: $9.99/month recurring (3-day trial)
   - **Pro Plan**: $19.99/month recurring (3-day trial)
   - **Plus Annual**: $89.99/year recurring (7-day trial)
   - **Pro Annual**: $179.99/year recurring (7-day trial)
3. Copy the Price IDs and add them to your `.env.local` file

### Configure Webhooks

1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://yourdomain.com/api/stripe/webhook`
   - For local development, use [Stripe CLI](https://stripe.com/docs/stripe-cli) to forward webhooks:
     ```bash
     stripe listen --forward-to localhost:3000/api/stripe/webhook
     ```
3. Select events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Copy the **Webhook Signing Secret** and add it to your `.env.local` as `STRIPE_WEBHOOK_SECRET`

## 3. Install Stripe Package

```bash
npm install stripe
```

## 4. Testing

### Test Mode
1. Use Stripe test mode API keys
2. Use test cards from [Stripe documentation](https://stripe.com/docs/testing)
3. Test webhook delivery using Stripe CLI

### Production
1. Switch to production API keys
2. Update webhook URL to production domain
3. Test with real payment methods

## 5. Next Steps

- [ ] Create products in Stripe dashboard
- [ ] Set up webhooks
- [ ] Add environment variables
- [ ] Update price IDs in code
- [ ] Test checkout flow
- [ ] Test webhook delivery
- [ ] Implement feature gating where needed

## Troubleshooting

### Webhooks not working
- Check webhook URL is accessible
- Verify webhook secret matches
- Check Stripe dashboard for delivery logs
- Review server logs for errors

### Checkout not working
- Verify API key is correct
- Check price IDs are valid
- Ensure environment matches (test vs production)
- Check browser console for errors

### Subscriptions not syncing
- Verify webhook is receiving events
- Check Convex logs for mutation errors
- Ensure userId is being passed in metadata
- Verify subscription queries are working

