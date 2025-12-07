import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// Helper to get username from authenticated user (for queries - read-only)
async function getUsername(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (!userId) return null;
  
  const user = await ctx.db.get(userId);
  if (!user) return null;
  
  // If user doesn't have a username, generate a temporary one
  if (!user.username) {
    const email = user.email || '';
    return email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '_') || `user_${userId.slice(0, 8)}`;
  }
  
  return user.username;
}

// Helper to get or create username from authenticated user (for mutations)
async function getOrCreateUsername(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (!userId) return null;
  
  const user = await ctx.db.get(userId);
  if (!user) return null;
  
  // If user doesn't have a username, generate one and save it
  if (!user.username) {
    const email = user.email || '';
    const generatedUsername = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '_') || `user_${userId.slice(0, 8)}`;
    
    // Update user with generated username
    await ctx.db.patch(userId, { username: generatedUsername });
    
    return generatedUsername;
  }
  
  return user.username;
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const username = await getUsername(ctx);
    if (!username) return null;

    // Get resources by username (new) or userId (legacy)
    const identity = await ctx.auth.getUserIdentity();
    const allResources = await ctx.db.query("resources").collect();
    
    return allResources.filter(resource => 
      resource.username === username || resource.userId === identity?.tokenIdentifier
    );
  },
});

export const add = mutation({
  args: {
    type: v.string(),
    title: v.string(),
    url: v.string(),
    description: v.optional(v.string()),
    notes: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const username = await getOrCreateUsername(ctx);
    if (!username) throw new Error("Not authenticated");

    const now = Date.now();
    return await ctx.db.insert("resources", {
      username,
      ...args,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("resources"),
    type: v.string(),
    title: v.string(),
    url: v.string(),
    description: v.optional(v.string()),
    notes: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const username = await getOrCreateUsername(ctx);
    if (!username) throw new Error("Not authenticated");

    const { id, ...updates } = args;
    
    // Verify ownership (check both username and userId for backward compatibility)
    const resource = await ctx.db.get(id);
    const identity = await ctx.auth.getUserIdentity();
    if (!resource || (resource.username !== username && resource.userId !== identity?.tokenIdentifier)) {
      throw new Error("Not authorized");
    }

    await ctx.db.patch(id, {
      ...updates,
      username, // Update to use username
      updatedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: {
    id: v.id("resources"),
  },
  handler: async (ctx, args) => {
    const username = await getOrCreateUsername(ctx);
    if (!username) throw new Error("Not authenticated");

    // Verify ownership (check both username and userId for backward compatibility)
    const resource = await ctx.db.get(args.id);
    const identity = await ctx.auth.getUserIdentity();
    if (!resource || (resource.username !== username && resource.userId !== identity?.tokenIdentifier)) {
      throw new Error("Not authorized");
    }

    await ctx.db.delete(args.id);
  },
});

// Internal mutation for agent to add resources (bypasses auth since HTTP action handles it)
export const addInternal = internalMutation({
  args: {
    userId: v.optional(v.string()), // Legacy field
    username: v.optional(v.string()),
    type: v.string(),
    title: v.string(),
    url: v.string(),
    description: v.optional(v.string()),
    notes: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("resources", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Public mutation for agent tool to add resources with userId
export const addForAgent = mutation({
  args: {
    userId: v.optional(v.string()), // Legacy field
    username: v.optional(v.string()),
    type: v.string(),
    title: v.string(),
    url: v.string(),
    description: v.optional(v.string()),
    notes: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Note: This is a special mutation for the agent
    // Prefer username, fall back to userId for legacy support
    const now = Date.now();
    return await ctx.db.insert("resources", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
  },
});

