import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import Google from "@auth/core/providers/google";
import { query, mutation, type MutationCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { ResendOTPPasswordReset } from "./authPasswordReset";
import { decideLink, EMAIL_TAKEN_MESSAGE } from "./authLinking";

/** Where OAuth may send people back to: the live site, or a local dev server. */
function allowedRedirect(redirectTo: string): string {
  const site = (process.env.SITE_URL || "").replace(/\/$/, "");
  if (redirectTo.startsWith("/") || redirectTo.startsWith("?")) return `${site}${redirectTo}`;
  const allowed = [site, "http://localhost:3000"].filter(Boolean);
  if (allowed.some((origin) => redirectTo === origin || redirectTo.startsWith(`${origin}/`) || redirectTo.startsWith(`${origin}?`))) {
    return redirectTo;
  }
  throw new Error(`Invalid redirectTo ${redirectTo}`);
}

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
      reset: ResendOTPPasswordReset,
    }),
    // Needs AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET on the deployment, and
    // <CONVEX_SITE_URL>/api/auth/callback/google as an authorised redirect URI.
    Google({
      profile(p) {
        return { id: p.sub, name: p.name, email: p.email, image: p.picture, emailVerified: p.email_verified === true };
      },
    }),
  ],
  callbacks: {
    redirect: async ({ redirectTo }) => allowedRedirect(redirectTo),
    // See convex/authLinking.ts for why this exists.
    async createOrUpdateUser(ctx, args) {
      const db = ctx.db as unknown as MutationCtx["db"];
      const profile = args.profile as Record<string, unknown>;
      const rawEmail = typeof profile.email === "string" ? profile.email.trim() : "";
      let sameEmail: any = null;
      if (rawEmail) {
        for (const candidate of new Set([rawEmail, rawEmail.toLowerCase()])) {
          sameEmail = await db.query("users").withIndex("email", (q) => q.eq("email", candidate)).first();
          if (sameEmail) break;
        }
      }
      const decision = decideLink({
        existingUserId: args.existingUserId,
        type: args.type,
        emailVerified: profile.emailVerified === true,
        userWithSameEmail: sameEmail?._id ?? null,
      });
      if (decision.kind === "existing") return decision.userId as Id<"users">;
      if (decision.kind === "refuse") throw new ConvexError(EMAIL_TAKEN_MESSAGE);
      const name = typeof profile.name === "string" ? profile.name : undefined;
      const image = typeof profile.image === "string" ? profile.image : undefined;
      if (decision.kind === "link") {
        const patch: Record<string, unknown> = {};
        if (!sameEmail.name && name) patch.name = name;
        if (!sameEmail.image && image) patch.image = image;
        if (Object.keys(patch).length) await db.patch(sameEmail._id, patch);
        return decision.userId as Id<"users">;
      }
      const username = typeof profile.username === "string"
        ? profile.username
        : rawEmail ? rawEmail.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "_") : undefined;
      return await db.insert("users", {
        email: rawEmail || undefined,
        name: name ?? (rawEmail ? rawEmail.split("@")[0] : undefined),
        username,
        image,
        ...(args.type === "oauth" && profile.emailVerified === true ? { emailVerificationTime: Date.now() } : {}),
      });
    },
  },
});

export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const userId = await getAuthUserId(ctx);
    const user = userId ? await ctx.db.get(userId) : null;

    // Ensure convex_user_id is set
    const convexUserId = (user as any)?.convex_user_id || userId;

    return {
      _id: identity.subject,
      subject: identity.subject,
      name: (user as any)?.name ?? identity.name,
      email: (user as any)?.email ?? identity.email,
      username: (user as any)?.username ?? null,
      tokenIdentifier: identity.tokenIdentifier,
      lastSignInAt: (user as any)?.lastSignInAt ?? null,
      convex_user_id: convexUserId, // Include convex_user_id for checkout
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
    username: v.optional(v.string()),
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

    // Validate username if provided
    if (args.username !== undefined) {
      // Sanitize username
      const sanitizedUsername = args.username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
      if (sanitizedUsername.length < 3) {
        throw new Error("Username must be at least 3 characters");
      }
      if (sanitizedUsername.length > 30) {
        throw new Error("Username must be less than 30 characters");
      }
      
      // Check if username is already taken by another user
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

    // Ensure convex_user_id is set
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

// Ensure convex_user_id is set for the current user
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

// Get convex_user_id for the current user (for checkout)
export const getConvexUserId = query({
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

    // Ensure convex_user_id is set
    if (!(user as any).convex_user_id) {
      // Return userId as fallback, but it should be set by ensureConvexUserId
      return userId;
    }

    return (user as any).convex_user_id;
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
