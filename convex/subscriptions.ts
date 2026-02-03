import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// Get user's subscription
export const getUserSubscription = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    // Get the user record to get convex_user_id
    const user = await ctx.db.get(userId);
    if (!user) {
      return null;
    }

    // Get convex_user_id (should always be set)
    const convexUserId = (user as any).convex_user_id || userId;

    // Find subscription - try convexUserId first, then auth userId (subscriptions may be stored under either)
    let subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", convexUserId))
      .first();
    if (!subscription && convexUserId !== userId) {
      subscription = await ctx.db
        .query("subscriptions")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .first();
    }
    
    return subscription;
  },
});

// Create subscription (called from webhook)
export const createSubscription = mutation({
  args: {
    userId: v.string(),
    name: v.optional(v.string()),
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
    name: v.optional(v.string()),
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
    // Try to resolve convex_user_id from the userId passed
    // userId might be Convex user ID, identity.subject, convex_user_id, or old format like "convexId|tokenIdentifier"
    let convexUserId = args.userId;
    
    // Handle old format: "convexId|tokenIdentifier" - extract the convexId part
    if (args.userId.includes('|')) {
      const parts = args.userId.split('|');
      convexUserId = parts[0]; // Use the first part as potential convex_user_id
    }
    
    // Try to get user by userId as Convex ID
    try {
      const user = await ctx.db.get(convexUserId as any);
      if (user && (user as any).convex_user_id) {
        convexUserId = (user as any).convex_user_id;
      } else if (user) {
        // User exists but no convex_user_id set, use the Convex ID itself
        convexUserId = user._id;
      }
    } catch (e) {
      // userId is not a valid Convex ID, try to find user by convex_user_id
      const userByConvexId = await ctx.db
        .query("users")
        .withIndex("by_convex_user_id", (q) => q.eq("convex_user_id", convexUserId))
        .first();
      
      if (userByConvexId) {
        convexUserId = (userByConvexId as any).convex_user_id || userByConvexId._id;
      } else {
        // Last resort: try to find by email or other means if userId looks like an email
        // But for now, we'll use the convexUserId as-is and let the subscription update
        console.log(`[Subscription] Could not resolve userId ${args.userId} to convex_user_id, using as-is`);
      }
    }
    
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_stripe_subscription", (q) => 
        q.eq("stripeSubscriptionId", args.stripeSubscriptionId)
      )
      .first();
    
    if (subscription) {
      await ctx.db.patch(subscription._id, {
        userId: convexUserId, // Update to use convex_user_id
        name: args.name, // Update name if provided
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
        userId: convexUserId, // Store convex_user_id
        name: args.name, // Store name for debugging
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

