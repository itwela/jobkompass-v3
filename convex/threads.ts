import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// List all threads for a user
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    // Get user to access convex_user_id
    const user = await ctx.db.get(userId);
    if (!user) return [];

    const convexUserId = (user as any).convex_user_id || userId;

    // Get threads by userId (convex_user_id) only
    const allThreads = await ctx.db.query("threads").collect();
    return allThreads.filter(thread => 
      (thread as any).userId === convexUserId
    ).sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

// Get a specific thread with its messages
export const get = query({
  args: {
    threadId: v.id("threads"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    // Get user to access convex_user_id
    const user = await ctx.db.get(userId);
    if (!user) return null;

    const convexUserId = (user as any).convex_user_id || userId;

    const thread = await ctx.db.get(args.threadId);
    // Verify ownership by userId (convex_user_id)
    if (!thread || ((thread as any).userId && (thread as any).userId !== convexUserId)) {
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
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");

    const convexUserId = (user as any).convex_user_id || userId;
    const username = (user as any).username || `user_${userId.slice(0, 8)}`; // Keep username for schema compatibility

    const now = Date.now();
    return await ctx.db.insert("threads", {
      userId: convexUserId, // Use convex_user_id as the sole identifier
      username, // Keep for schema compatibility
      title: args.title,
      createdAt: now,
      updatedAt: now,
      lastMessageAt: now,
      messageCount: 0,
    } as any);
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
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Get user to access convex_user_id
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");

    const convexUserId = (user as any).convex_user_id || userId;

    // Verify thread ownership by userId (convex_user_id)
    const thread = await ctx.db.get(args.threadId);
    if (!thread || ((thread as any).userId && (thread as any).userId !== convexUserId)) {
      throw new Error("Not authorized");
    }

    const now = Date.now();

    // Add message
    const messageId = await ctx.db.insert("messages", {
      threadId: args.threadId,
      userId: convexUserId, // Use convex_user_id
      role: args.role,
      content: args.content,
      createdAt: now,
      toolCalls: args.toolCalls,
    } as any);

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
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Get user to access convex_user_id
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");

    const convexUserId = (user as any).convex_user_id || userId;

    const thread = await ctx.db.get(args.threadId);
    // Verify ownership by userId (convex_user_id)
    if (!thread || ((thread as any).userId && (thread as any).userId !== convexUserId)) {
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
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Get user to access convex_user_id
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");

    const convexUserId = (user as any).convex_user_id || userId;

    const thread = await ctx.db.get(args.threadId);
    // Verify ownership by userId (convex_user_id)
    if (!thread || ((thread as any).userId && (thread as any).userId !== convexUserId)) {
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
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Get user to access convex_user_id
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");

    const convexUserId = (user as any).convex_user_id || userId;

    const thread = await ctx.db.get(args.threadId);
    // Verify ownership by userId (convex_user_id)
    if (!thread || ((thread as any).userId && (thread as any).userId !== convexUserId)) {
      throw new Error("Not authorized");
    }

    await ctx.db.patch(args.threadId, {
      contextWindowExceeded: args.exceeded,
      updatedAt: Date.now(),
    });
  },
});

