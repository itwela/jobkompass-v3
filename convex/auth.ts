import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { query } from "./_generated/server";
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
