import { query } from "./_generated/server";

export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    
    if (!identity) {
      return null;
    }

    return {
      _id: identity.subject,
      email: identity.email,
      name: identity.name,
      tokenIdentifier: identity.tokenIdentifier,
    };
  },
});

