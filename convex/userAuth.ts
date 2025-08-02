import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { ConvexError } from "convex/values";

// Get the current user if logged in
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }
    
    return {
      id: identity.subject,
      name: identity.name,
      email: identity.email,
      pictureUrl: identity.pictureUrl,
    };
  },
});

// Create or update a user in the database when they log in
export const createUser = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    tokenIdentifier: v.string(),
  },
  handler: async (ctx, args) => {

    // Create a new user
    const userId = await ctx.db.insert("users", {
      name: args.name,
      email: args.email,
      tokenIdentifier: args.tokenIdentifier,
      // pictureUrl is not in the schema, so we're not storing it
    });

    return userId;
    
  },
});
