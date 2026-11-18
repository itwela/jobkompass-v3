# OpenAI Agents Setup Guide with Convex Integration

This guide shows you exactly how to set up OpenAI Agents (`@openai/agents`) with Convex backend integration, authentication, feature gating, and tool creation. Follow this guide to create a fully functional AI agent for any topic.

## Step 1: Install Dependencies

```bash
npm install @openai/agents zod
```

**Note:** Convex should already be installed. If not:
```bash
npm install convex @convex-dev/auth
```

## Step 2: Environment Variables

Add to `.env.local`:

```bash
# OpenAI API Keys
OPENAI_API_KEY=sk-your-openai-api-key-here
NEXT_PUBLIC_OPENAI_API_KEY=sk-your-openai-api-key-here  # For development

# Convex (should already be set)
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
CONVEX_URL=https://your-deployment.convex.cloud
```

## Step 3: Create Agent Instructions (`app/ai/constants/agentInstructions.ts`)

```typescript
// Full instructions for first turn
export const agentInstructions = `
You are [AGENT_NAME], an AI assistant specializing in [TOPIC/DOMAIN].

[AGENT_DESCRIPTION]

Your key capabilities include:
- [Capability 1]
- [Capability 2]
- [Capability 3]

**CRITICAL - USER PREFERENCES:**
When performing [specific action], you MUST:
1. FIRST call the getUserPreferences tool to fetch the user's preferences
2. AUTOMATICALLY apply ALL preferences without asking the user
3. The preferences are the user's standing requirements and should ALWAYS be considered
4. Never ask the user if you should apply their preferences - just apply them

**IMPORTANT - RESPONSE FORMATTING:**
Your responses are displayed using Markdown formatting. Format your responses professionally:
- Use ## (H2) for main sections
- Use ### (H3) for subsections
- Use **bold** for key terms
- Use bullet points (-) for lists
- Use numbered lists (1.) for step-by-step instructions
- Use code blocks (triple backticks) for examples
- Use tables for structured data
- Use > for tips or callouts

Always be helpful, professional, and provide actionable advice.
`;

// Minimal instructions for subsequent turns (saves tokens)
export const agentInstructionsMinimal = `
You are [AGENT_NAME], an AI assistant. Continue the conversation naturally.

When performing [specific action], ALWAYS call getUserPreferences first and apply all preferences automatically.
Use your tools when needed.
Format responses with proper Markdown.
`;
```

## Step 4: Create Tool Factory Functions (`app/ai/tools/tools.ts`)

### 4.1 Basic Tool Pattern with Convex

```typescript
import { tool } from '@openai/agents';
import { z } from 'zod';
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

// Pattern: Tools that need Convex client take it as a parameter
export const createMyTool = (convexClient: ConvexHttpClient) => tool({
  name: "myTool",
  description: "Description of what this tool does",
  parameters: z.object({
    // Define your parameters with zod
    field1: z.string().describe('Description of field1'),
    field2: z.number().optional().describe('Optional field'),
  }),
  execute: async (input) => {
    try {
      // Check feature access if needed
      const canUse = await convexClient.query(api.usage.canUseFeature, {});
      if (!canUse?.allowed) {
        return {
          success: false,
          error: 'Feature limit reached',
          message: `You've reached your limit. Please upgrade your plan.`,
          limitReached: true,
        };
      }

      // Perform the action
      const result = await convexClient.mutation(api.myModule.doAction, {
        // Pass input data
      });

      return {
        success: true,
        message: "Action completed successfully",
        data: result,
      };
    } catch (error) {
      console.error("Tool error:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: errorMessage,
        message: "Failed to complete action",
      };
    }
  },
});
```

### 4.2 Tool with Feature Gating

```typescript
export const createFeatureGatedTool = (convexClient: ConvexHttpClient) => tool({
  name: "createDocument",
  description: "Create a document (checks limits before executing)",
  parameters: z.object({
    content: z.string().describe('Document content'),
  }),
  execute: async (input) => {
    try {
      // ALWAYS check limits before executing
      const canGenerate = await convexClient.query(api.usage.canGenerateDocument, {});
      if (!canGenerate?.allowed) {
        return {
          success: false,
          error: 'Document limit reached',
          message: `You've reached your limit of ${canGenerate.limit} documents this month. Please upgrade your plan.`,
          limitReached: true,
        };
      }

      // Proceed with action
      const result = await convexClient.mutation(api.documents.create, {
        content: input.content,
      });

      return {
        success: true,
        message: "Document created successfully",
        documentId: result,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: "Failed to create document",
      };
    }
  },
});
```

### 4.3 Always-Available Usage Tool

```typescript
// This tool should always be available - no feature gating
export const createGetUserUsageTool = (convexClient: ConvexHttpClient) => tool({
  name: "getUserUsage",
  description: "Get the user's current usage statistics. Always available. Use this to check limits before generating documents or adding items.",
  parameters: z.object({}),
  execute: async () => {
    try {
      const usage = await convexClient.query(api.usage.getUserUsage);
      
      if (!usage) {
        return {
          success: false,
          message: "Unable to fetch usage statistics.",
        };
      }

      // Get subscription to determine limits
      const subscription = await convexClient.query(api.subscriptions.getUserSubscription);
      const planId = subscription?.planId || "free";

      const PLAN_LIMITS: Record<string, { documentsPerMonth: number; itemsLimit: number | null }> = {
        free: { documentsPerMonth: 3, itemsLimit: 10 },
        starter: { documentsPerMonth: 10, itemsLimit: 100 },
        plus: { documentsPerMonth: 60, itemsLimit: 100 },
        "plus-annual": { documentsPerMonth: 60, itemsLimit: 100 },
        pro: { documentsPerMonth: 180, itemsLimit: null },
        "pro-annual": { documentsPerMonth: 180, itemsLimit: null },
      };

      const limits = PLAN_LIMITS[planId] || PLAN_LIMITS.free;

      return {
        success: true,
        usage: {
          documentsUsed: usage.documentsGeneratedThisMonth || 0,
          documentsLimit: limits.documentsPerMonth,
          documentsRemaining: Math.max(0, limits.documentsPerMonth - (usage.documentsGeneratedThisMonth || 0)),
          itemsCount: usage.itemsCount || 0,
          itemsLimit: limits.itemsLimit,
          itemsRemaining: limits.itemsLimit === null ? null : Math.max(0, limits.itemsLimit - (usage.itemsCount || 0)),
          planId,
        },
        message: `Current usage: ${usage.documentsGeneratedThisMonth || 0}/${limits.documentsPerMonth} documents this month, ${usage.itemsCount || 0}${limits.itemsLimit === null ? '' : `/${limits.itemsLimit}`} items.`,
      };
    } catch (error) {
      return {
        success: false,
        message: "Failed to fetch usage statistics.",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
});
```

### 4.4 Tool That Adds Data (with convex_user_id)

```typescript
export const createAddItemTool = (convexClient: ConvexHttpClient) => tool({
  name: "addItem",
  description: "Add an item to the user's collection",
  parameters: z.object({
    title: z.string().describe('Item title'),
    description: z.string().optional().describe('Item description'),
  }),
  execute: async (input) => {
    try {
      // Check feature access
      const canAdd = await convexClient.query(api.usage.canAddItem, {});
      if (!canAdd?.allowed) {
        return {
          success: false,
          message: `You've reached your limit of ${canAdd.limit} items. Please upgrade your plan.`,
          error: 'Item limit reached',
          limitReached: true,
        };
      }

      // Get user's convex_user_id for the agent tool
      const user = await convexClient.query(api.auth.currentUser);
      if (!user) {
        return {
          success: false,
          message: "Please sign in to add items.",
          error: "Not authenticated",
        };
      }

      const convexUserId = user.convex_user_id || user._id;

      // Use addForAgent mutation that requires userId
      const itemId = await convexClient.mutation(api.items.addForAgent, {
        userId: convexUserId, // CRITICAL: Pass convex_user_id
        title: input.title,
        description: input.description ?? undefined,
      });

      return {
        success: true,
        message: "Item added successfully",
        itemId,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        message: errorMessage.toLowerCase().includes("not authenticated")
          ? "Please sign in to add items."
          : "Failed to add item. Try again once you're signed in.",
        error: errorMessage,
      };
    }
  },
});
```

## Step 5: Create API Route (`app/api/chat/route.ts`)

```typescript
import {
  Agent,
  AgentInputItem,
  assistant,
  run,
  user,
  webSearchTool,
  withTrace,
  Tool
} from '@openai/agents';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { agentInstructions, agentInstructionsMinimal } from '@/app/ai/constants/agentInstructions';
import { 
  createGetUserUsageTool,
  createMyTool,
  createFeatureGatedTool,
  createAddItemTool,
} from '@/app/ai/tools/tools';
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { setDefaultOpenAIKey, setTracingExportApiKey } from '@openai/agents';

// Set OpenAI API key
setDefaultOpenAIKey(process.env.NODE_ENV === 'production' 
  ? process.env.OPENAI_API_KEY! 
  : process.env.NEXT_PUBLIC_OPENAI_API_KEY!
);
setTracingExportApiKey(process.env.NODE_ENV === 'production' 
  ? process.env.OPENAI_API_KEY! 
  : process.env.NEXT_PUBLIC_OPENAI_API_KEY!
);

// Request schema
const ChatRequestSchema = z.object({
  message: z.string(),
  file: z.object({
    name: z.string(),
    type: z.string(),
    size: z.number(),
    base64: z.string(),
  }).nullable().optional(),
  history: z.array(z.any()).optional().default([]),
  agentId: z.string().optional(),
  userId: z.string().optional(),
  username: z.string().optional(),
  contextIds: z.array(z.string()).optional(), // For context attachments
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, file, history = [], agentId, userId, username, contextIds } = ChatRequestSchema.parse(body);

    // Set up Convex client with authentication
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL;
    if (!convexUrl) {
      throw new Error("CONVEX_URL not configured");
    }

    const convexToken = await convexAuthNextjsToken();
    const convexClient = new ConvexHttpClient(convexUrl);
    if (convexToken) {
      convexClient.setAuth(convexToken);
    } else {
      convexClient.clearAuth();
    }

    // Create tool instances with Convex client
    // CRITICAL: Always put getUserUsageTool first - it's always available
    const toolInstancesWithConvexClient = [
      createGetUserUsageTool(convexClient), // Always available - check usage first
      createMyTool(convexClient),
      createFeatureGatedTool(convexClient),
      createAddItemTool(convexClient),
      // Add more tools here...
    ];

    // Tools that don't need Convex client
    const normalTools = [
      webSearchTool(),
      // Add other tools here...
    ];

    const tools = [...toolInstancesWithConvexClient, ...normalTools];

    // Use minimal instructions for subsequent turns to save tokens
    const isFirstTurn = history.length <= 2;
    const hasContextAttachments = contextIds?.length;
    
    // Build context-aware instructions
    let contextInstructions = isFirstTurn ? agentInstructions : agentInstructionsMinimal;
    
    if (hasContextAttachments) {
      contextInstructions += "\n\n[[CONTEXT_ATTACHMENTS]]";
      contextInstructions += `\nThe user has attached the following items to this message: ${contextIds.join(', ')}`;
      contextInstructions += "\nIf relevant, use the appropriate tool to fetch details. Don't fetch context unnecessarily if it was already discussed.";
    }

    // Create the agent
    const myAgent = new Agent({
      name: 'MyAgent',
      instructions: contextInstructions,
      handoffDescription: 'MyAgent - [Description of what the agent does]',
      tools: tools as Tool<unknown>[],
      model: "gpt-5-mini", // or "gpt-4.1", "gpt-4.1-mini"
    });

    // Convert history format
    const convertedHistory: AgentInputItem[] = history.map((item: any) => {
      if (item.role === 'user') {
        return user(item.content);
      } else if (item.role === 'assistant') {
        return assistant(item.content);
      }
      return user(item.content);
    });

    // Add user context if provided
    const effectiveUsername = username?.trim();
    const userContextMessage = effectiveUsername
      ? user(`[[user_profile]]\nusername: ${effectiveUsername}`)
      : null;

    const historyAlreadyHasContext = convertedHistory.some(
      (item: any) =>
        item?.type === 'message' &&
        item?.role === 'user' &&
        typeof item.content === 'string' &&
        item.content.includes('[[user_profile]]')
    );

    const conversationalHistory: AgentInputItem[] = [...convertedHistory];
    if (userContextMessage && !historyAlreadyHasContext) {
      conversationalHistory.unshift(userContextMessage);
    }

    // Build user message with image support
    let userMessage: AgentInputItem;
    
    if (file) {
      const isImage = file.type.startsWith('image/');
      if (isImage) {
        const contentParts: any[] = [];
        if (message.trim()) {
          contentParts.push({
            type: 'input_text',
            text: message,
          });
        }
        contentParts.push({
          type: 'input_image',
          image: `data:${file.type};base64,${file.base64}`,
        });
        userMessage = {
          role: 'user',
          content: contentParts,
        } as AgentInputItem;
      } else {
        userMessage = user(message);
      }
    } else {
      userMessage = user(message);
    }

    const updatedHistory: AgentInputItem[] = [...conversationalHistory, userMessage];

    // Run the agent
    const result = await withTrace('Agent Chat Session', async () => {
      return await run(myAgent, updatedHistory, {
        maxTurns: 67, // Limit turns to prevent infinite loops
      });
    });

    // Extract tool calls from result
    const toolCalls: Array<{name: string, arguments: any, result?: any}> = [];
    if (result.history) {
      const callResults = new Map();
      
      // Collect function call results
      for (const item of result.history) {
        if (item.type === 'function_call_result') {
          callResults.set(item.callId, item.output);
        }
      }
      
      // Collect function calls and match with results
      for (const item of result.history) {
        if (item.type === 'function_call') {
          toolCalls.push({
            name: item.name,
            arguments: typeof item.arguments === 'string' ? JSON.parse(item.arguments) : item.arguments,
            result: callResults.get(item.callId)
          });
        } else if (item.type === 'hosted_tool_call') {
          toolCalls.push({
            name: item.name,
            arguments: item.providerData?.action || {},
            result: item.status === 'completed' ? 'Completed successfully' : item.status
          });
        }
      }
    }

    const fullMessage = result.finalOutput || 'No response generated';

    // Stream the response
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        
        const sendChunk = (chunk: any) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
        };

        try {
          const words = fullMessage.split(' ');
          
          // Send initial metadata
          sendChunk({
            type: 'start',
            agentName: result.lastAgent?.name || myAgent.name,
            lastAgentId: result.lastAgent?.name.toLowerCase().replace(/\s+/g, '-') || agentId,
            toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
          });

          // Stream words with delay
          for (let i = 0; i < words.length; i++) {
            const chunk = {
              type: 'token',
              content: i === 0 ? words[i] : ` ${words[i]}`,
            };
            sendChunk(chunk);
            await new Promise(resolve => setTimeout(resolve, 30)); // 30ms delay
          }

          sendChunk({ type: 'done' });
          controller.close();
        } catch (error) {
          console.error('Streaming error:', error);
          controller.error(error);
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error: any) {
    console.error('Agent API error:', error);
    
    // Handle context length exceeded
    const isContextLengthExceeded = 
      error?.code === 'context_length_exceeded' || 
      error?.message?.includes('context window') ||
      error?.message?.includes('context_length_exceeded');
    
    if (isContextLengthExceeded) {
      return NextResponse.json(
        {
          success: false,
          error: 'context_length_exceeded',
          errorCode: 'CONTEXT_LENGTH_EXCEEDED',
          message: 'This conversation has exceeded the maximum context length. Please start a new conversation.',
          agentName: 'MyAgent',
          history: [],
        },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        message: 'Sorry, I encountered an error processing your request.',
        agentName: 'MyAgent',
        history: [],
      },
      { status: 500 }
    );
  }
}

// GET endpoint for agent info
export async function GET() {
  try {
    const agent = {
      id: 'myagent',
      name: 'MyAgent',
      description: 'AI Assistant - [Description]',
      capabilities: ['capability1', 'capability2'],
      tools: [
        {
          name: 'myTool',
          description: 'Description of tool',
          parameters: ['param1', 'param2']
        }
      ]
    };

    return NextResponse.json({
      success: true,
      data: agent,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch agent information' },
      { status: 500 }
    );
  }
}
```

## Step 6: Create Convex Mutations for Agent Tools

In your Convex files (e.g., `convex/items.ts`):

```typescript
import { mutation } from "./_generated/server";
import { v } from "convex/values";

// Mutation specifically for agent tools - requires userId (convex_user_id)
export const addForAgent = mutation({
  args: {
    userId: v.string(), // Required: convex_user_id
    title: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // userId must be the convex_user_id
    const { userId, ...itemData } = args;
    const now = Date.now();
    return await ctx.db.insert("items", {
      userId, // Use convex_user_id as the sole identifier
      ...itemData,
      createdAt: now,
      updatedAt: now,
    });
  },
});
```

## Step 7: Frontend Integration

### 7.1 Chat Component

```typescript
'use client'

import { useState } from 'react';
import { useAuth } from '@/providers/jkAuthProvider';

export default function ChatComponent() {
  const [message, setMessage] = useState('');
  const [history, setHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();

  const handleSend = async () => {
    if (!message.trim() || isLoading) return;

    setIsLoading(true);
    const userMessage = { role: 'user', content: message };
    setHistory(prev => [...prev, userMessage]);
    setMessage('');

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          history,
          userId: user?.convex_user_id || user?._id,
          username: user?.username,
        }),
      });

      if (!response.ok) throw new Error('Request failed');

      // Handle streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'token') {
                // Append token to message
                setHistory(prev => {
                  const last = prev[prev.length - 1];
                  if (last?.role === 'assistant') {
                    return [...prev.slice(0, -1), { ...last, content: last.content + data.content }];
                  }
                  return [...prev, { role: 'assistant', content: data.content }];
                });
              } else if (data.type === 'done') {
                setIsLoading(false);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      setIsLoading(false);
    }
  };

  return (
    <div>
      {/* Chat UI */}
      <div>
        {history.map((msg, i) => (
          <div key={i}>
            <strong>{msg.role}:</strong> {msg.content}
          </div>
        ))}
      </div>
      <input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyPress={(e) => e.key === 'Enter' && handleSend()}
        placeholder="Type your message..."
      />
      <button onClick={handleSend} disabled={isLoading}>
        Send
      </button>
    </div>
  );
}
```

## Step 8: Key Patterns and Best Practices

### 8.1 Tool Creation Pattern

**Always follow this pattern for Convex-integrated tools:**

```typescript
export const createMyTool = (convexClient: ConvexHttpClient) => tool({
  name: "toolName",
  description: "Clear description",
  parameters: z.object({
    // Use zod for validation
    field: z.string().describe('Description'),
  }),
  execute: async (input) => {
    try {
      // 1. Check feature access if needed
      // 2. Get user's convex_user_id if needed
      // 3. Call Convex mutations/queries
      // 4. Return structured response
    } catch (error) {
      // Return error response
    }
  },
});
```

### 8.2 Feature Gating in Tools

**Always check limits before executing actions:**

```typescript
// In tool execute function
const canUse = await convexClient.query(api.usage.canUseFeature, {});
if (!canUse?.allowed) {
  return {
    success: false,
    error: 'Limit reached',
    message: `You've reached your limit. Please upgrade.`,
    limitReached: true,
  };
}
```

### 8.3 Getting User ID in Tools

**Always use convex_user_id:**

```typescript
const user = await convexClient.query(api.auth.currentUser);
if (!user) {
  return { success: false, message: "Please sign in", error: "Not authenticated" };
}

const convexUserId = user.convex_user_id || user._id;

// Use in mutations
await convexClient.mutation(api.items.addForAgent, {
  userId: convexUserId, // CRITICAL
  // ... other fields
});
```

### 8.4 Tool Response Format

**Always return structured responses:**

```typescript
// Success
return {
  success: true,
  message: "Action completed successfully",
  data: result, // Optional
};

// Error
return {
  success: false,
  error: errorMessage,
  message: "User-friendly error message",
  limitReached: true, // If applicable
};
```

### 8.5 Instructions Strategy

**Use minimal instructions for subsequent turns:**

```typescript
const isFirstTurn = history.length <= 2;
const instructions = isFirstTurn ? agentInstructions : agentInstructionsMinimal;
```

This saves tokens and reduces costs.

## Step 9: Required Convex Setup

### 9.1 Usage Queries (`convex/usage.ts`)

You need these queries for feature gating:

```typescript
export const getUserUsage = query({
  // Returns usage stats (documents this month, items count, etc.)
});

export const canGenerateDocument = query({
  // Returns { allowed: boolean, reason?: string, limit?: number }
});

export const canAddItem = query({
  // Returns { allowed: boolean, reason?: string, limit?: number }
});
```

### 9.2 Agent Mutations

Create `addForAgent` mutations that:
- Require `userId` (convex_user_id) as first parameter
- Use `convex_user_id` stored in `userId` field
- Follow the same pattern as jobs/resources/threads

## Step 10: Testing Your Agent

1. **Test basic conversation:**
   - Send a simple message
   - Verify response streams correctly

2. **Test tool execution:**
   - Trigger a tool that requires authentication
   - Verify feature gating works
   - Check error handling

3. **Test feature limits:**
   - Exceed a limit
   - Verify tool returns limit reached message

4. **Test context attachments:**
   - Attach context IDs
   - Verify agent fetches context when relevant

## Key Points

1. **Always use `convex_user_id`** - Never use username or tokenIdentifier for data operations
2. **Feature gate all actions** - Check limits before executing in tools
3. **Always-available usage tool** - Put `getUserUsage` tool first, always available
4. **Structured tool responses** - Always return `{ success, message, error? }`
5. **Minimal instructions** - Use full instructions only on first turn
6. **Error handling** - Always wrap tool execution in try/catch
7. **Authentication** - Get Convex token and set on client before creating tools
8. **Streaming** - Use ReadableStream for word-by-word response streaming

## That's It!

Your OpenAI Agent setup is complete with:
- ✅ Convex backend integration
- ✅ Authentication handling
- ✅ Feature gating in tools
- ✅ Usage tracking
- ✅ Tool creation patterns
- ✅ Streaming responses
- ✅ Error handling
- ✅ Context management

Follow this guide to create a fully functional AI agent for any topic with Convex integration!

