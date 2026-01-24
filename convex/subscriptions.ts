import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// Get user's subscription
export const getUserSubscription = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    
    return await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
  },
});

// Create subscription (called from webhook)
export const createSubscription = mutation({
  args: {
    userId: v.string(),
    stripeSubscriptionId: v.string(),
    stripeCustomerId: v.string(),
    planId: v.string(),
    status: v.string(),
    currentPeriodStart: v.number(),
    currentPeriodEnd: v.number(),
    trialEnd: v.optional(v.number()),
    cancelAtPeriodEnd: v.boolean(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("subscriptions", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Update subscription from webhook
export const updateSubscriptionFromWebhook = mutation({
  args: {
    stripeSubscriptionId: v.string(),
    status: v.string(),
    planId: v.string(),
    currentPeriodStart: v.number(),
    currentPeriodEnd: v.number(),
    trialEnd: v.optional(v.number()),
    cancelAtPeriodEnd: v.boolean(),
  },
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_stripe_subscription", (q) => 
        q.eq("stripeSubscriptionId", args.stripeSubscriptionId)
      )
      .first();
    
    if (subscription) {
      await ctx.db.patch(subscription._id, {
        status: args.status,
        planId: args.planId,
        currentPeriodStart: args.currentPeriodStart,
        currentPeriodEnd: args.currentPeriodEnd,
        trialEnd: args.trialEnd,
        cancelAtPeriodEnd: args.cancelAtPeriodEnd,
        updatedAt: Date.now(),
      });
    } else {
      // If subscription doesn't exist, we might need userId from webhook
      // This is a fallback - ideally webhook should include userId
      throw new Error("Subscription not found");
    }
  },
});

// Update subscription with userId (for webhooks that include it)
export const updateSubscriptionWithUserId = mutation({
  args: {
    userId: v.string(),
    stripeSubscriptionId: v.string(),
    stripeCustomerId: v.string(),
    status: v.string(),
    planId: v.string(),
    currentPeriodStart: v.number(),
    currentPeriodEnd: v.number(),
    trialEnd: v.optional(v.number()),
    cancelAtPeriodEnd: v.boolean(),
  },
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_stripe_subscription", (q) => 
        q.eq("stripeSubscriptionId", args.stripeSubscriptionId)
      )
      .first();
    
    if (subscription) {
      await ctx.db.patch(subscription._id, {
        status: args.status,
        planId: args.planId,
        currentPeriodStart: args.currentPeriodStart,
        currentPeriodEnd: args.currentPeriodEnd,
        trialEnd: args.trialEnd,
        cancelAtPeriodEnd: args.cancelAtPeriodEnd,
        updatedAt: Date.now(),
      });
    } else {
      // Create new subscription if it doesn't exist
      const now = Date.now();
      await ctx.db.insert("subscriptions", {
        userId: args.userId,
        stripeSubscriptionId: args.stripeSubscriptionId,
        stripeCustomerId: args.stripeCustomerId,
        planId: args.planId,
        status: args.status,
        currentPeriodStart: args.currentPeriodStart,
        currentPeriodEnd: args.currentPeriodEnd,
        trialEnd: args.trialEnd,
        cancelAtPeriodEnd: args.cancelAtPeriodEnd,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

// Cancel subscription
export const cancelSubscription = mutation({
  args: {
    stripeSubscriptionId: v.string(),
  },
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_stripe_subscription", (q) => 
        q.eq("stripeSubscriptionId", args.stripeSubscriptionId)
      )
      .first();
    
    if (subscription) {
      await ctx.db.patch(subscription._id, {
        status: "canceled",
        updatedAt: Date.now(),
      });
    }
  },
});

// Get referral by referrer
export const getReferralsByReferrer = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    
    return await ctx.db
      .query("referrals")
      .withIndex("by_referrer", (q) => q.eq("referrerUserId", userId))
      .collect();
  },
});

// Create referral
export const createReferral = mutation({
  args: {
    referrerUserId: v.string(),
    referredUserId: v.string(),
    paddleReferralId: v.optional(v.string()),
    status: v.string(),
    rewardAmount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("referrals", {
      ...args,
      createdAt: now,
    });
  },
});

// Update referral
export const updateReferral = mutation({
  args: {
    referralId: v.id("referrals"),
    status: v.string(),
    rewardAmount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { referralId, ...updates } = args;
    await ctx.db.patch(referralId, updates);
  },
});

