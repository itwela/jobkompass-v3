import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// Helper to get username from authenticated user (for queries - read-only)
async function getUsername(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (!userId) return null;
  
  const user = await ctx.db.get(userId);
  if (!user) return null;
  
  // If user doesn't have a username, generate a temporary one
  // (Note: This won't be saved, just used for this request)
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

// List all threads for a user
export const list = query({
  args: {},
  handler: async (ctx) => {
    const username = await getUsername(ctx);
    if (!username) return [];

    return await ctx.db
      .query("threads")
      .withIndex("by_username_and_updated", (q) => 
        q.eq("username", username)
      )
      .order("desc")
      .collect();
  },
});

// Get a specific thread with its messages
export const get = query({
  args: {
    threadId: v.id("threads"),
  },
  handler: async (ctx, args) => {
    const username = await getUsername(ctx);
    if (!username) return null;

    const thread = await ctx.db.get(args.threadId);
    if (!thread || thread.username !== username) {
      return null;
    }

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_thread_and_created", (q) => 
        q.eq("threadId", args.threadId)
      )
      .order("asc")
      .collect();

    return {
      thread,
      messages,
    };
  },
});

// Create a new thread
export const create = mutation({
  args: {
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const username = await getOrCreateUsername(ctx);
    if (!username) throw new Error("Not authenticated");

    const now = Date.now();
    return await ctx.db.insert("threads", {
      username,
      title: args.title,
      createdAt: now,
      updatedAt: now,
      lastMessageAt: now,
      messageCount: 0,
    });
  },
});

// Add a message to a thread
export const addMessage = mutation({
  args: {
    threadId: v.id("threads"),
    role: v.string(),
    content: v.string(),
    toolCalls: v.optional(v.array(v.object({
      name: v.string(),
      arguments: v.any(),
      result: v.any(),
    }))),
  },
  handler: async (ctx, args) => {
    const username = await getOrCreateUsername(ctx);
    if (!username) throw new Error("Not authenticated");

    // Verify thread ownership
    const thread = await ctx.db.get(args.threadId);
    if (!thread || thread.username !== username) {
      throw new Error("Not authorized");
    }

    const now = Date.now();

    // Add message
    const messageId = await ctx.db.insert("messages", {
      threadId: args.threadId,
      username,
      role: args.role,
      content: args.content,
      createdAt: now,
      toolCalls: args.toolCalls,
    });

    // Update thread metadata
    await ctx.db.patch(args.threadId, {
      updatedAt: now,
      lastMessageAt: now,
      messageCount: thread.messageCount + 1,
    });

    return messageId;
  },
});

// Update thread title
export const updateTitle = mutation({
  args: {
    threadId: v.id("threads"),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const username = await getOrCreateUsername(ctx);
    if (!username) throw new Error("Not authenticated");

    const thread = await ctx.db.get(args.threadId);
    if (!thread || thread.username !== username) {
      throw new Error("Not authorized");
    }

    await ctx.db.patch(args.threadId, {
      title: args.title,
      updatedAt: Date.now(),
    });
  },
});

// Delete a thread and all its messages
export const remove = mutation({
  args: {
    threadId: v.id("threads"),
  },
  handler: async (ctx, args) => {
    const username = await getOrCreateUsername(ctx);
    if (!username) throw new Error("Not authenticated");

    const thread = await ctx.db.get(args.threadId);
    if (!thread || thread.username !== username) {
      throw new Error("Not authorized");
    }

    // Delete all messages in the thread
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .collect();

    for (const message of messages) {
      await ctx.db.delete(message._id);
    }

    // Delete the thread
    await ctx.db.delete(args.threadId);
  },
});

// Mark a thread as having exceeded the context window
export const markContextWindowExceeded = mutation({
  args: {
    threadId: v.id("threads"),
    exceeded: v.boolean(),
  },
  handler: async (ctx, args) => {
    const username = await getOrCreateUsername(ctx);
    if (!username) throw new Error("Not authenticated");

    const thread = await ctx.db.get(args.threadId);
    if (!thread || thread.username !== username) {
      throw new Error("Not authorized");
    }

    await ctx.db.patch(args.threadId, {
      contextWindowExceeded: args.exceeded,
      updatedAt: Date.now(),
    });
  },
});

