# Convex Auth Setup Guide (Password Provider) for Next.js

This guide shows you exactly how to set up Convex Auth with the `convex_user_id` system for seamless subscription management.

## Step 1: Install Dependencies

```bash
npm install convex @convex-dev/auth
```

## Step 2: Create Convex Configuration Files

### 2.1 Create `convex/convex.config.ts`

```typescript
import { defineApp } from "convex/server";

export default defineApp();
```

### 2.2 Create `convex/auth.config.ts`

```typescript
export default {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL,
      applicationID: "convex",
    },
  ],
};
```

## Step 3: Set Up Authentication (`convex/auth.ts`)

```typescript
import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      profile(params) {
        const email = params.email as string;
        const name = (params.name as string) || email.split('@')[0];
        const username = (params.username as string) || email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '_');
        
        return {
          email,
          name,
          username,
        };
      },
    }),
  ],
});

// CRITICAL: currentUser query MUST return convex_user_id
export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const userId = await getAuthUserId(ctx);
    const user = userId ? await ctx.db.get(userId) : null;

    const convexUserId = (user as any)?.convex_user_id || userId;

    return {
      _id: identity.subject,
      subject: identity.subject,
      name: (user as any)?.name ?? identity.name,
      email: (user as any)?.email ?? identity.email,
      username: (user as any)?.username ?? null,
      tokenIdentifier: identity.tokenIdentifier,
      lastSignInAt: (user as any)?.lastSignInAt ?? null,
      convex_user_id: convexUserId, // CRITICAL: Must include
    };
  },
});

// CRITICAL: Ensures convex_user_id is set for authenticated user
export const ensureConvexUserId = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db.get(userId);
    if (user && !(user as any).convex_user_id) {
      await ctx.db.patch(userId, {
        convex_user_id: userId,
      });
      return { updated: true };
    }

    return { updated: false };
  },
});

// Updates last sign in and ensures convex_user_id
export const updateLastSignIn = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db.get(userId);
    if (user && !(user as any).convex_user_id) {
      await ctx.db.patch(userId, {
        convex_user_id: userId,
        lastSignInAt: Date.now(),
      });
    } else {
      await ctx.db.patch(userId, {
        lastSignInAt: Date.now(),
      });
    }

    return { success: true };
  },
});
```

## Step 4: Set Up HTTP Routes (`convex/http.ts`)

```typescript
import { httpRouter } from "convex/server";
import { auth } from "./auth";

const http = httpRouter();

auth.addHttpRoutes(http);

export default http;
```

## Step 5: Set Up Database Schema (`convex/schema.ts`)

```typescript
import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

const schema = defineSchema({
  ...authTables, // CRITICAL: Include Convex Auth tables
  
  // Extend users table with convex_user_id
  users: defineTable({
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    image: v.optional(v.string()),
    isAnonymous: v.optional(v.boolean()),
    username: v.optional(v.string()),
    resumePreferences: v.optional(v.array(v.string())),
    lastSignInAt: v.optional(v.number()),
    convex_user_id: v.optional(v.string()), // CRITICAL: For subscription matching
  })
    .index("email", ["email"])
    .index("by_convex_user_id", ["convex_user_id"]), // CRITICAL: Index for subscriptions

  // Subscriptions table (uses convex_user_id in userId field)
  subscriptions: defineTable({
    userId: v.string(), // Stores convex_user_id, NOT identity.subject
    name: v.optional(v.string()), // User's name for debugging (populated from Stripe customer)
    stripeSubscriptionId: v.string(),
    stripeCustomerId: v.string(),
    planId: v.string(),
    status: v.string(),
    currentPeriodStart: v.number(),
    currentPeriodEnd: v.number(),
    trialEnd: v.optional(v.number()),
    cancelAtPeriodEnd: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"]) // Indexed by convex_user_id
    .index("by_stripe_subscription", ["stripeSubscriptionId"]),
});

export default schema;
```

## Step 6: Create Subscription Queries (`convex/subscriptions.ts`)

```typescript
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// Get user's subscription - uses convex_user_id
export const getUserSubscription = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    // Get user record to get convex_user_id
    const user = await ctx.db.get(userId);
    if (!user) {
      return null;
    }

    const convexUserId = (user as any).convex_user_id || userId;

    // Find subscription by convex_user_id
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", convexUserId))
      .first();
    
    return subscription;
  },
});

// Update subscription with userId (for webhooks)
export const updateSubscriptionWithUserId = mutation({
  args: {
    userId: v.string(), // May be Convex ID, identity.subject, or convex_user_id
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
    // Resolve convex_user_id from userId
    let convexUserId = args.userId;
    
    // Handle old format: "convexId|tokenIdentifier"
    if (args.userId.includes('|')) {
      const parts = args.userId.split('|');
      convexUserId = parts[0];
    }
    
    // Try to get user by userId as Convex ID
    try {
      const user = await ctx.db.get(convexUserId as any);
      if (user && (user as any).convex_user_id) {
        convexUserId = (user as any).convex_user_id;
      } else if (user) {
        convexUserId = user._id;
      }
    } catch (e) {
      // Try to find user by convex_user_id
      const userByConvexId = await ctx.db
        .query("users")
        .withIndex("by_convex_user_id", (q) => q.eq("convex_user_id", convexUserId))
        .first();
      
      if (userByConvexId) {
        convexUserId = (userByConvexId as any).convex_user_id || userByConvexId._id;
      }
    }
    
    // Find or create subscription
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_stripe_subscription", (q) => 
        q.eq("stripeSubscriptionId", args.stripeSubscriptionId)
      )
      .first();
    
    if (subscription) {
      await ctx.db.patch(subscription._id, {
        userId: convexUserId,
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
      const now = Date.now();
      await ctx.db.insert("subscriptions", {
        userId: convexUserId,
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

// Update subscription from webhook (fallback when userId not available)
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
      throw new Error("Subscription not found");
    }
  },
});
```

## Step 7: Create Convex Provider (`providers/jkConvexProvider.tsx`)

```typescript
'use client';

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ConvexAuthNextjsProvider } from "@convex-dev/auth/nextjs";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function JkConvexProviders({ children }: { children: React.ReactNode }) {
  return (
    <ConvexProvider client={convex}>
      <ConvexAuthNextjsProvider client={convex}>
        {children}
      </ConvexAuthNextjsProvider>
    </ConvexProvider>
  );
}
```

## Step 8: Create Auth Provider (`providers/jkAuthProvider.tsx`)

```typescript
'use client'

import { createContext, useContext, ReactNode } from 'react';
import { useConvexAuth } from 'convex/react';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';

interface User {
  _id: string;
  email?: string;
  name?: string;
  username?: string;
  tokenIdentifier: string;
  subject?: string;
  convex_user_id?: string; // CRITICAL: Include convex_user_id
}

interface AuthContextType {
  user: User | null | undefined;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function JkAuthProvider({ children }: { children: ReactNode }) {
  const { isLoading: convexAuthLoading, isAuthenticated } = useConvexAuth();
  const user = useQuery(api.auth.currentUser, isAuthenticated ? {} : "skip");

  const isLoading = convexAuthLoading || (isAuthenticated && user === undefined);

  return (
    <AuthContext.Provider value={{ 
      user,
      isAuthenticated: isAuthenticated && user !== null,
      isLoading
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within JkAuthProvider');
  }
  return context;
}
```

## Step 9: Create Subscription Provider (`providers/jkSubscriptionProvider.tsx`)

```typescript
'use client'

import { createContext, useContext, ReactNode, useEffect } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'

interface SubscriptionContextType {
  subscription: any | null
  isLoading: boolean
  isFree: boolean
  isStarter: boolean
  isPlus: boolean
  isPro: boolean
  isPlusAnnual: boolean
  isProAnnual: boolean
  hasActiveSubscription: boolean
  isTrialing: boolean
  planId: string | null
}

const SubscriptionContext = createContext<SubscriptionContextType | null>(null)

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const subscription = useQuery(api.subscriptions.getUserSubscription)
  const ensureConvexUserId = useMutation(api.auth.ensureConvexUserId)
  
  const planId = subscription?.planId || null
  const status = subscription?.status || null
  
  // CRITICAL: Ensure convex_user_id is set on mount
  useEffect(() => {
    ensureConvexUserId().catch(console.error)
  }, [ensureConvexUserId])
  
  const value: SubscriptionContextType = {
    subscription,
    isLoading: subscription === undefined,
    isFree: !subscription || planId === 'free',
    isStarter: planId === 'starter' && (status === 'active' || status === 'trialing'),
    isPlus: (planId === 'plus' || planId === 'plus-annual') && (status === 'active' || status === 'trialing'),
    isPro: (planId === 'pro' || planId === 'pro-annual') && (status === 'active' || status === 'trialing'),
    isPlusAnnual: planId === 'plus-annual' && (status === 'active' || status === 'trialing'),
    isProAnnual: planId === 'pro-annual' && (status === 'active' || status === 'trialing'),
    hasActiveSubscription: status === 'active' || status === 'trialing',
    isTrialing: status === 'trialing',
    planId,
  }

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  )
}

export const useSubscription = () => {
  const ctx = useContext(SubscriptionContext)
  if (!ctx) {
    throw new Error('useSubscription must be used within SubscriptionProvider')
  }
  return ctx
}
```

## Step 10: Set Up Root Layout (`app/layout.tsx`)

```typescript
import type { Metadata } from "next";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import { JkConvexProviders } from "@/providers/jkConvexProvider";
import { JkAuthProvider } from "@/providers/jkAuthProvider";
import { SubscriptionProvider } from "@/providers/jkSubscriptionProvider";
import "./globals.css";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ConvexAuthNextjsServerProvider>
      <JkConvexProviders>
        <JkAuthProvider>
          <SubscriptionProvider>
            <html lang="en">
              <body>
                {children}
              </body>
            </html>
          </SubscriptionProvider>
        </JkAuthProvider>
      </JkConvexProviders>
    </ConvexAuthNextjsServerProvider>
  );
}
```

## Step 11: Environment Variables

Add to `.env.local`:

```bash
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
CONVEX_DEPLOYMENT=dev:your-deployment
```

## Step 12: Using Auth in Components

### Sign In/Sign Up Form

```typescript
'use client'

import { useState } from 'react';
import { useAuthActions } from "@convex-dev/auth/react";
import { useAuth } from "@/providers/jkAuthProvider";

export default function AuthForm() {
  const { signIn } = useAuthActions();
  const { user, isAuthenticated } = useAuth();
  const [signInStep, setSignInStep] = useState<"signIn" | "signUp">("signIn");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    await signIn("password", formData);
  };

  return (
    <form onSubmit={handleSubmit}>
      <input name="email" type="email" required />
      <input name="password" type="password" required />
      <input name="flow" type="hidden" value={signInStep} />
      <button type="submit">
        {signInStep === "signIn" ? "Sign in" : "Sign up"}
      </button>
    </form>
  );
}
```

### Using convex_user_id in Checkout

```typescript
const { user } = useAuth();

// Always use convex_user_id for Stripe checkout
const userId = (user as any)?.convex_user_id || user?._id || user?.subject;

await fetch('/api/stripe/checkout', {
  method: 'POST',
  body: JSON.stringify({
    priceId: 'price_xxx',
    userId: userId, // Pass convex_user_id
    email: user?.email,
  }),
});
```

## Step 13: Generate Types and Deploy

```bash
npx convex dev
```

This generates TypeScript types and pushes your schema to Convex.

## Step 14: Using convex_user_id for ALL Data (Jobs, Resources, Threads, Messages)

**CRITICAL:** All user-related data must use `convex_user_id` stored in the `userId` field, NOT username or tokenIdentifier.

### Jobs Example (`convex/jobs.ts`)

```typescript
export const add = mutation({
  args: { /* job fields */ },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");

    const convexUserId = (user as any).convex_user_id || userId;

    // Store with convex_user_id
    return await ctx.db.insert("jobs", {
      userId: convexUserId, // Use convex_user_id as the sole identifier
      ...args,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const user = await ctx.db.get(userId);
    if (!user) return null;

    const convexUserId = (user as any).convex_user_id || userId;

    // Query by convex_user_id only
    return await ctx.db
      .query("jobs")
      .withIndex("by_user", (q) => q.eq("userId", convexUserId))
      .collect();
  },
});
```

### Resources, Threads, Messages - Same Pattern

All data operations follow this pattern:
1. Get `userId` from `getAuthUserId(ctx)`
2. Get user record and extract `convex_user_id`
3. Store/query using `convex_user_id` in `userId` field
4. **Never use username or tokenIdentifier for data queries**

## Step 15: Username Editing (`convex/auth.ts`)

Add username editing to `updateUserProfile`:

```typescript
export const updateUserProfile = mutation({
  args: {
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    username: v.optional(v.string()),
    resumePreferences: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");

    // Validate username if provided
    if (args.username !== undefined) {
      const sanitizedUsername = args.username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
      if (sanitizedUsername.length < 3 || sanitizedUsername.length > 30) {
        throw new Error("Username must be 3-30 characters");
      }
      
      // Check if username is already taken
      const existingUser = await ctx.db
        .query("users")
        .withIndex("by_username", (q) => q.eq("username", sanitizedUsername))
        .first();
      
      if (existingUser && existingUser._id !== userId) {
        throw new Error("Username is already taken");
      }
    }

    const updateData: any = {};
    if (args.name !== undefined) updateData.name = args.name;
    if (args.email !== undefined) updateData.email = args.email;
    if (args.username !== undefined) updateData.username = args.username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
    if (args.resumePreferences !== undefined) updateData.resumePreferences = args.resumePreferences;

    await ctx.db.patch(userId, updateData);
    return { success: true };
  },
});
```

**Schema requirement:** Add `by_username` index to users table:
```typescript
users: defineTable({ /* ... */ })
  .index("email", ["email"])
  .index("by_username", ["username"]) // Add this
  .index("by_convex_user_id", ["convex_user_id"]),
```

## Step 16: Usage Tracking (Monthly Only) (`convex/usage.ts`)

Usage tracking must only count documents from the current month:

```typescript
export const getUserUsage = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const user = await ctx.db.get(userId);
    if (!user) return null;

    const convexUserId = (user as any).convex_user_id || userId;

    // Get current month start timestamp
    const now = Date.now();
    const currentMonth = new Date(now);
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);
    const monthStart = currentMonth.getTime();

    // Count AI-generated documents this month ONLY
    const allResumes = await ctx.db
      .query("resumes")
      .withIndex("by_user", (q) => q.eq("userId", convexUserId))
      .collect();

    const allCoverLetters = await ctx.db
      .query("coverLetters")
      .withIndex("by_user", (q) => q.eq("userId", convexUserId))
      .collect();

    // Filter by month - CRITICAL: Only count this month
    const generatedResumesThisMonth = allResumes.filter(
      (r) => r.fileId && r.createdAt >= monthStart
    ).length;

    const generatedCoverLettersThisMonth = allCoverLetters.filter(
      (c) => c.fileId && c.createdAt >= monthStart
    ).length;

    const documentsGeneratedThisMonth =
      generatedResumesThisMonth + generatedCoverLettersThisMonth;

    // Jobs are total count (not monthly)
    const allJobs = await ctx.db
      .query("jobs")
      .withIndex("by_user", (q) => q.eq("userId", convexUserId))
      .collect();

    return {
      documentsGeneratedThisMonth, // Only this month
      jobsCount: allJobs.length, // Total count
      monthStart,
    };
  },
});
```

## Step 17: Thank You Message Logic (Settings Page)

Show plan name even if subscription is canceled:

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

// In JSX
{planId && planId !== 'free' && (
  <div>
    <p>Thank you for being a <span>{getPlanDisplayName()}</span> member! 🎉</p>
    {subscription?.status === 'canceled' && (
      <p>Your subscription is canceled. <Link href="/pricing">Renew today</Link> to continue.</p>
    )}
  </div>
)}
```

## Key Points

1. **Always use `getAuthUserId(ctx)`** to get Convex user ID in mutations/queries
2. **Always get `convex_user_id` from user record** before storing data
3. **Always call `ensureConvexUserId()`** on signup/signin (done automatically in SubscriptionProvider)
4. **Always use `convex_user_id`** for ALL user-related data (subscriptions, jobs, resources, threads, messages)
5. **Never use username or tokenIdentifier** for data queries - only for display
6. **Usage tracking must filter by month** - only count documents created this month
7. **Plan display uses planId directly** - not subscription status flags

## That's It!

Your Convex Auth setup is complete with:
- ✅ Password authentication
- ✅ `convex_user_id` system for consistent user identification
- ✅ All data operations using `convex_user_id` (jobs, resources, threads, messages)
- ✅ Subscription queries using `convex_user_id`
- ✅ Username editing with validation
- ✅ Monthly usage tracking (documents only count this month)
- ✅ Seamless signup/subscription flow
