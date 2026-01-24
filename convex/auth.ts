import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

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

export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const userId = await getAuthUserId(ctx);
    const user = userId ? await ctx.db.get(userId) : null;

    return {
      _id: identity.subject,
      subject: identity.subject,
      name: (user as any)?.name ?? identity.name,
      email: (user as any)?.email ?? identity.email,
      username: (user as any)?.username ?? null,
      tokenIdentifier: identity.tokenIdentifier,
      lastSignInAt: (user as any)?.lastSignInAt ?? null,
    };
  },
});

export const getPublicProfileById = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId as Id<"users">);
    if (!user) {
      return null;
    }

    return {
      _id: args.userId,
      username: (user as any)?.username ?? null,
      name: (user as any)?.name ?? null,
      email: (user as any)?.email ?? null,
    };
  },
});

export const updateUserProfile = mutation({
  args: {
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    resumePreferences: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const updateData: any = {};
    if (args.name !== undefined) updateData.name = args.name;
    if (args.email !== undefined) updateData.email = args.email;
    if (args.resumePreferences !== undefined) updateData.resumePreferences = args.resumePreferences;

    await ctx.db.patch(userId, updateData);
    return { success: true };
  },
});

export const getResumePreferences = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const user = await ctx.db.get(userId);
    if (!user) {
      return null;
    }

    return (user as any)?.resumePreferences ?? [];
  },
});

export const updateResumePreferences = mutation({
  args: {
    preferences: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found");
    }

    await ctx.db.patch(userId, {
      resumePreferences: args.preferences,
    });

    return { success: true };
  },
});

export const updateLastSignIn = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await ctx.db.patch(userId, {
      lastSignInAt: Date.now(),
    });

    return { success: true };
  },
});

export const shouldRedirectToPricing = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return false;
    }

    const user = await ctx.db.get(userId);
    if (!user) {
      return false;
    }

    const lastSignInAt = (user as any)?.lastSignInAt;
    
    // If never signed in before, don't redirect (first time user)
    if (!lastSignInAt) {
      return false;
    }

    // Import time periods - we'll need to check this on the client side
    // since we can't import client constants in server code
    // Return the timestamp and let client decide
    return {
      lastSignInAt,
      currentTime: Date.now(),
    };
  },
});
