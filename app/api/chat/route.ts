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

import { jobKompassDescription, resumeBestPractices, jobKompassInstructions, jobKompassInstructionsMinimal } from '@/app/ai/constants/file';
import { createAddToResourcesTool, createAddToJobsTool, createResumeJakeTemplateTool, createCoverLetterJakeTemplateTool, createGetUserResumesTool, createGetUserJobsTool, createGetResumeByIdTool, createGetJobByIdTool, createGetUserResumePreferencesTool, createGetUserUsageTool } from '@/app/ai/tools/file';
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { setDefaultOpenAIKey, setTracingExportApiKey } from '@openai/agents';
import { mcpTools } from '@/app/lib/mcp-tools';

setDefaultOpenAIKey(process.env.NODE_ENV === 'production' ? process.env.OPENAI_API_KEY! : process.env.NEXT_PUBLIC_OPENAI_API_KEY!);
setTracingExportApiKey(process.env.NODE_ENV === 'production' ? process.env.OPENAI_API_KEY! : process.env.NEXT_PUBLIC_OPENAI_API_KEY!);

// Request/Response schemas
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
  contextResumeIds: z.array(z.string()).optional(),
  contextJobIds: z.array(z.string()).optional(),
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
    const { message, file, history = [], agentId, userId, username, contextResumeIds, contextJobIds } = ChatRequestSchema.parse(body);

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

    // Create tool *instances* for client-dependent tools
    // Pass the convexClient directly since it's already instantiated
    const toolInstancesWithConvexClient = [
      createGetUserUsageTool(convexClient), // Always available - check usage first
      createResumeJakeTemplateTool(convexClient),
      createCoverLetterJakeTemplateTool(convexClient),
      createAddToResourcesTool(convexClient),
      createAddToJobsTool(convexClient),
      createGetUserResumesTool(convexClient),
      createGetUserJobsTool(convexClient),
      createGetResumeByIdTool(convexClient),
      createGetJobByIdTool(convexClient),
      createGetUserResumePreferencesTool(convexClient),
    ];

    const normalTools = [
      webSearchTool(),
      mcpTools.get_introduction,
    ];

    // The "tools" array should only contain actual tool instances
    const tools = [...toolInstancesWithConvexClient, ...normalTools];

    // Use minimal instructions for subsequent turns to save tokens
    // Full instructions on first turn (history length <= 2) or when context is attached
    const isFirstTurn = history.length <= 2;
    const hasContextAttachments = contextResumeIds?.length || contextJobIds?.length;
    
    // Build context-aware instructions
    let contextInstructions = isFirstTurn ? jobKompassInstructions : jobKompassInstructionsMinimal;
    
    if (hasContextAttachments) {
      contextInstructions += "\n\n[[CONTEXT_ATTACHMENTS]]";
      
      if (contextResumeIds?.length) {
        contextInstructions += `\nThe user has attached the following resume(s) to this message: ${contextResumeIds.join(', ')}`;
        contextInstructions += "\nIf relevant to the user's request, use the 'getResumeById' tool to fetch detailed information about these resumes. If you already searched for this, do not search again unless the user asks you to do so.";
      }
      
      if (contextJobIds?.length) {
        contextInstructions += `\nThe user has attached the following job(s) to this message: ${contextJobIds.join(', ')}`;
        contextInstructions += "\nIf relevant to the user's request, use the 'getJobById' tool to fetch detailed information about these jobs. If you already searched for this, do not search again unless the user asks you to do so.";
      }
      
      contextInstructions += "\n\nImportant: Only fetch context details if they're relevant to the user's current request. Don't fetch context unnecessarily if it was already discussed in the conversation history.";
    }

    // Create the JobKompass agent for this request
    const jobKompassAgent = new Agent({
      name: 'JobKompass',
      instructions: contextInstructions,
      handoffDescription: 'JobKompass - Career Assistant - Specializes in resume creation, job search optimization, and career guidance.',
      tools: tools as Tool<unknown>[],
      model: "gpt-5-mini",
      // model: "gpt-4.1",
      // model: "gpt-4.1-mini",
    });

    // TODO Make a new agent that can handle bigger context windows

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

    // Build the user message with image support only
    let userMessage: AgentInputItem;
    
    console.log('file', file);
    console.log('message', message);

    if (file) {
      // Only support images for now
      const isImage = file.type.startsWith('image/');

      if (isImage) {
        const contentParts: any[] = [];
        
        // Add text content if present
        if (message.trim()) {
          contentParts.push({
            type: 'input_text',
            text: message,
          });
        }
        
        // Add image content
        // NOTE: this works. do not change this
        contentParts.push({
          type: 'input_image',
          image: `data:${file.type};base64,${file.base64}`,
        });

        console.log('contentParts', contentParts);
        
        userMessage = {
          role: 'user',
          content: contentParts,
        } as AgentInputItem;
      } else {
        // Non-image files are not supported yet - treat as text-only message
        console.log('Non-image file type not supported:', file.type);
        userMessage = user(message);
      }
    } else {
      // Just text message
      userMessage = user(message);
    }

    const updatedHistory: AgentInputItem[] = [...conversationalHistory, userMessage];

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

  } catch (error: any) {
    console.error('JobKompass Chat API error:', error);
    
    // Check for context length exceeded error
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
          message: 'This conversation has exceeded the maximum context length. Please start a new conversation to continue.',
          agentName: 'JobKompass',
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
      description: 'AI Career Assistant - Specializes in resume creation, cover letter writing, job search optimization, and career guidance',
      capabilities: ['resume-creation', 'cover-letter-creation', 'resume-analysis', 'career-guidance', 'ats-optimization', 'web-search'],
      tools: [
        {
          name: 'createResumeJakeTemplate',
          description: 'Generate a professional resume using the Jake LaTeX template',
          parameters: ['personalInfo', 'experience', 'education', 'projects', 'skills', 'additionalInfo']
        },
        {
          name: 'createCoverLetterJakeTemplate',
          description: 'Generate a professional cover letter using the Jake template style',
          parameters: ['personalInfo', 'jobInfo', 'letterContent']
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