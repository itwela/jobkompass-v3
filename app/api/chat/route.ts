import {
  Agent,
  AgentInputItem,
  assistant,
  run,
  user,
  webSearchTool,
  withTrace
} from '@openai/agents';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { jobKompassDescription, resumeBestPractices, jobKompassInstructions } from '@/app/ai/constants/file';
import { createAddToResourcesTool, createAddToJobsTool, createResumeJakeTemplateTool, createGetUserResumesTool, createGetUserJobsTool } from '@/app/ai/tools/file';
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { setDefaultOpenAIKey, setTracingExportApiKey } from '@openai/agents';

setDefaultOpenAIKey(process.env.NODE_ENV === 'production' ? process.env.OPENAI_API_KEY! : process.env.NEXT_PUBLIC_OPENAI_API_KEY!);
setTracingExportApiKey(process.env.NODE_ENV === 'production' ? process.env.OPENAI_API_KEY! : process.env.NEXT_PUBLIC_OPENAI_API_KEY!);

// Request/Response schemas
const ChatRequestSchema = z.object({
  message: z.string(),
  history: z.array(z.any()).optional().default([]),
  agentId: z.string().optional(),
  userId: z.string().optional(),
  username: z.string().optional(),
});

const ChatResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  agentName: z.string(),
  history: z.array(z.any()),
  lastAgentId: z.string().optional(),
  toolCalls: z.array(z.object({
    name: z.string(),
    arguments: z.any(),
    result: z.any().optional(),
  })).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, history = [], agentId, userId, username } = ChatRequestSchema.parse(body);

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

    const addToResourcesTool = createAddToResourcesTool(() => convexClient);
    const addToJobsTool = createAddToJobsTool(() => convexClient);
    const getUserResumesTool = createGetUserResumesTool(() => convexClient);
    const getUserJobsTool = createGetUserJobsTool(() => convexClient);

    // Create the JobKompass agent for this request
    const jobKompassAgent = new Agent({
      name: 'JobKompass',
      instructions: jobKompassInstructions,
      handoffDescription: 'JobKompass - Career Assistant - Specializes in resume creation, job search optimization, and career guidance.',
      tools: [createResumeJakeTemplateTool, addToResourcesTool, addToJobsTool, getUserResumesTool, getUserJobsTool, webSearchTool()],
      model: "gpt-5-mini",
    });

    // Use JobKompass agent
    const currentAgent = jobKompassAgent;

    const effectiveUsername = username?.trim();

    // Convert history format to AgentInputItem format
    const convertedHistory: AgentInputItem[] = history.map((item: any) => {
      if (item.role === 'user') {
        return user(item.content);
      } else if (item.role === 'assistant') {
        return assistant(item.content);
      }
      return user(item.content); // fallback
    });

    // Add the new user message to history
    const userContextMessage =
      effectiveUsername
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

    const updatedHistory: AgentInputItem[] = [...conversationalHistory, user(message)];

    // Run the agent within a trace
    const result = await withTrace('JobKompass Chat Session', async () => {
      return await run(currentAgent, updatedHistory, {
        maxTurns: 67, // 💀 Limit turns to prevent infinite loops
      });
    });

    // Extract tool calls from the result history
    const toolCalls: Array<{name: string, arguments: any, result?: any}> = [];
    if (result.history) {
      const callResults = new Map();
      
      // First pass: collect function call results
      for (const item of result.history) {
        if (item.type === 'function_call_result') {
          callResults.set(item.callId, item.output);
        }
      }
      
      // Second pass: collect function calls and match with results
      for (const item of result.history) {
        if (item.type === 'function_call') {
          toolCalls.push({
            name: item.name,
            arguments: typeof item.arguments === 'string' ? JSON.parse(item.arguments) : item.arguments,
            result: callResults.get(item.callId)
          });
        }
        // Handle hosted tool calls (like web search)
        else if (item.type === 'hosted_tool_call') {
          toolCalls.push({
            name: item.name,
            arguments: item.providerData?.action || {},
            result: item.status === 'completed' ? 'Search completed successfully' : item.status
          });
        }
      }
    }

    const fullMessage = result.finalOutput || 'No response generated';

    // Stream the response word-by-word to simulate typing
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        
        // Helper to send a chunk
        const sendChunk = (chunk: any) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
        };

        try {
          // Split message into words for streaming
          const words = fullMessage.split(' ');
          
          // Send initial metadata
          sendChunk({
            type: 'start',
            agentName: result.lastAgent?.name || currentAgent.name,
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
            await new Promise(resolve => setTimeout(resolve, 30)); // 30ms delay between words
          }

          // Send completion marker
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

  } catch (error) {
    console.error('JobKompass Chat API error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        message: 'Sorry, I encountered an error processing your request.',
        agentName: 'JobKompass',
        history: [],
      },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve agent information
export async function GET() {
  try {
    const agent = {
      id: 'jobkompass',
      name: 'JobKompass',
      description: 'AI Career Assistant - Specializes in resume creation, job search optimization, and career guidance',
      capabilities: ['resume-creation', 'resume-analysis', 'career-guidance', 'ats-optimization', 'web-search'],
      tools: [
        {
          name: 'createResumeJakeTemplate',
          description: 'Generate a professional resume using the Jake LaTeX template',
          parameters: ['personalInfo', 'experience', 'education', 'projects', 'skills', 'additionalInfo']
        },
        {
          name: 'analyzeResume',
          description: 'Analyze a resume for ATS optimization and improvement suggestions',
          parameters: ['resumeContent', 'jobDescription']
        }
      ]
    };

    return NextResponse.json({
      success: true,
      data: agent,
    });
  } catch (error) {
    console.error('Error fetching JobKompass agent:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch agent information' },
      { status: 500 }
    );
  }
}