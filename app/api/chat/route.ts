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
import { createAddToResourcesTool, createAddToJobsTool, createResumeJakeTemplateTool, createCoverLetterJakeTemplateTool, createGetUserResumesTool, createGetUserJobsTool, createGetResumeByIdTool, createGetJobByIdTool, createGetUserResumePreferencesTool, createGetUserUsageTool, type ChatTurnContext } from '@/app/ai/tools/file';
import OpenAI from 'openai';
import { unwrapToolResult } from '@/lib/chat/toolTrace';
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { setDefaultOpenAIKey, setTracingExportApiKey, setDefaultOpenAIClient, setOpenAIAPI, setTracingDisabled } from '@openai/agents';
import { mcpTools } from '@/app/lib/mcp-tools';
import { enforceAiRateLimit } from '@/lib/rateLimit/guard';
import { chatTurnNamesInventedFact, guardChatTurn, resumeJsonFromText, scrubInventedExperience, type FactGuard } from '@/lib/resume/noInventedFacts';

/** Id and name of the resume loadSignedInResume picks, for the chat's step trace. */
async function baseResumeLabel(client: ConvexHttpClient, contextResumeIds: string[] | undefined): Promise<ChatTurnContext["baseResume"]> {
  const turn: ChatTurnContext = {};
  await loadSignedInResume(client, contextResumeIds, turn);
  return turn.baseResume ?? null;
}

/** Saved resume for this signed-in user. Earlier chat turns are not a source. Records which one in `turn`. */
async function loadSignedInResume(
  client: ConvexHttpClient,
  contextResumeIds: string[] | undefined,
  turn?: ChatTurnContext,
): Promise<unknown | null> {
  try {
    for (const resumeId of contextResumeIds ?? []) {
      if (!resumeId) continue;
      try {
        const resume = await client.query(api.documents.getResume, { resumeId: resumeId as never });
        if (resume?.content) {
          if (turn) turn.baseResume = { id: String(resume._id), name: resume.name };
          return resume.content;
        }
      } catch {
        // A bad id is not resume evidence.
      }
    }
    const resumes = await client.query(api.documents.listResumes);
    if (!Array.isArray(resumes) || resumes.length === 0) return null;
    const latest = [...resumes].sort((a, b) => (b?.updatedAt ?? 0) - (a?.updatedAt ?? 0))[0];
    if (latest?.content && turn) turn.baseResume = { id: String(latest._id), name: latest.name };
    return latest?.content ?? null;
  } catch {
    return null;
  }
}

const OPENAI_KEY = process.env.NODE_ENV === 'production' ? process.env.OPENAI_API_KEY : process.env.NEXT_PUBLIC_OPENAI_API_KEY;
// Local dev without an OpenAI key runs the same agent through OpenRouter's
// OpenAI-compatible Chat Completions API. Production keeps the OpenAI key path.
const VIA_OPENROUTER = !OPENAI_KEY && process.env.NODE_ENV !== 'production' && !!process.env.OPENROUTER_API_KEY;
if (VIA_OPENROUTER) {
  setDefaultOpenAIClient(new OpenAI({ apiKey: process.env.OPENROUTER_API_KEY, baseURL: 'https://openrouter.ai/api/v1' }) as never);
  setOpenAIAPI('chat_completions');
  setTracingDisabled(true);
} else {
  setDefaultOpenAIKey(OPENAI_KEY!);
  setTracingExportApiKey(OPENAI_KEY!);
}

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
  contextResumeTemplateId: z.string().optional(),
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
  const limited = await enforceAiRateLimit(request, "ai");
  if (limited) return limited;

  try {
    const body = await request.json();
    const { message, file, history = [], agentId, userId, username, contextResumeIds, contextJobIds, contextResumeTemplateId } = ChatRequestSchema.parse(body);

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
    // Pass the convexClient directly since it's already instantiated.
    // Pasted resume JSON, a resume attached to this turn, or the signed-in user's
    // saved resume. Earlier conversation turns are not a source of facts.
    const factGuard: FactGuard = { source: resumeJsonFromText(message) };
    const turn: ChatTurnContext = { jobIds: contextJobIds };
    if (!factGuard.source) {
      factGuard.source = await loadSignedInResume(convexClient, contextResumeIds);
      if (factGuard.source) turn.baseResume = await baseResumeLabel(convexClient, contextResumeIds);
    }
    const toolInstancesWithConvexClient = [
      createGetUserUsageTool(convexClient), // Always available - check usage first
      createResumeJakeTemplateTool(convexClient, factGuard, turn),
      createCoverLetterJakeTemplateTool(convexClient, factGuard, turn),
      createAddToResourcesTool(convexClient),
      createAddToJobsTool(convexClient),
      createGetUserResumesTool(convexClient),
      createGetUserJobsTool(convexClient),
      createGetResumeByIdTool(convexClient, factGuard, turn),
      createGetJobByIdTool(convexClient, turn),
      createGetUserResumePreferencesTool(convexClient),
    ];

    // Hosted web search only exists on OpenAI's Responses API.
    const normalTools = [
      ...(VIA_OPENROUTER ? [] : [webSearchTool()]),
      mcpTools.get_introduction,
    ];

    // The "tools" array should only contain actual tool instances
    const tools = [...toolInstancesWithConvexClient, ...normalTools];

    // Use minimal instructions for subsequent turns to save tokens
    // Full instructions on first turn (history length <= 2) or when context is attached
    const isFirstTurn = history.length <= 2;
    const hasContextAttachments = contextResumeIds?.length || contextJobIds?.length;
    // "jake" is the only template in active use, so default to it instead of
    // blocking resume creation on a manual Context panel selection.
    const effectiveResumeTemplateId = contextResumeTemplateId || 'jake';

    // Build context-aware instructions
    let contextInstructions = isFirstTurn ? jobKompassInstructions : jobKompassInstructionsMinimal;

    // Resume template preference - CRITICAL for resume creation
    contextInstructions += "\n\n[[RESUME_TEMPLATE_PREFERENCE]]";
    contextInstructions += `\nThe resume template is "${effectiveResumeTemplateId}" (JobKompass Jake). When creating resumes, you MUST call createResumeJakeTemplate with templateId: "${effectiveResumeTemplateId}". Do not ask the user to open the Context panel or select a template first - it already defaults to Jake.`;
    
    if (hasContextAttachments) {
      contextInstructions += "\n\n[[CONTEXT_ATTACHMENTS]]";
      
      if (contextResumeIds?.length) {
        contextInstructions += `\nThe user has attached the following resume(s) to this message: ${contextResumeIds.join(', ')}`;
        contextInstructions += "\nIf relevant to the user's request, use the 'getResumeById' tool to fetch detailed information about these resumes. If you already searched for this, do not search again unless the user asks you to do so.";
      }
      
      if (contextJobIds?.length) {
        contextInstructions += `\nThe user has attached the following job(s) to this message: ${contextJobIds.join(', ')}`;
        contextInstructions += "\nIf relevant to the user's request, use the 'getJobById' tool to fetch detailed information about these jobs. If you already searched for this, do not search again unless the user asks you to do so.";
        contextInstructions += `\nWhen you write a resume for an attached job, pass jobId: "${contextJobIds[0]}" to createResumeJakeTemplate so the resume is linked to it in My Jobs.`;
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

    if (VIA_OPENROUTER) jobKompassAgent.model = "openai/gpt-5-mini";

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

    let fullMessage = result.finalOutput || 'No response generated';
    // The job being applied to is the target, not a claimed employer: naming it is allowed.
    // Its posting text is still never evidence about the candidate.
    const target = turn.job ? { applicationTarget: { company: turn.job.company, role: turn.job.title } } : {};
    if (factGuard.source) {
      const trimmed = fullMessage.trim();
      let parsed: unknown = null;
      const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
      const candidate = fenced ? fenced[1].trim() : trimmed;
      if (candidate.startsWith("{") || candidate.startsWith("[")) {
        try {
          parsed = JSON.parse(candidate);
        } catch {
          parsed = null;
        }
      }
      if (parsed && typeof parsed === "object") {
        fullMessage = JSON.stringify(scrubInventedExperience(factGuard.source, parsed, target), null, 2);
      } else {
        const original = fullMessage;
        const scrubbed = scrubInventedExperience(factGuard.source, fullMessage, target);
        if (typeof scrubbed === "string" && scrubbed.trim()) fullMessage = scrubbed;
        else fullMessage = "I can only rephrase facts already on the resume.";
        if (chatTurnNamesInventedFact(factGuard.source, original, target)) {
          fullMessage = "I can only rephrase facts already on the resume.";
        }
      }
      for (const call of toolCalls) {
        if (call.name === "createResumeJakeTemplate" || call.name === "createCoverLetterJakeTemplate") {
          call.arguments = scrubInventedExperience(factGuard.source, call.arguments);
        }
      }
    } else {
      const guarded = guardChatTurn({ message, rawText: fullMessage });
      fullMessage = guarded.streamed;
      for (const call of toolCalls) {
        if (call.name === "createResumeJakeTemplate" || call.name === "createCoverLetterJakeTemplate") {
          const rawArgs = typeof call.arguments === "string" ? call.arguments : JSON.stringify(call.arguments ?? "");
          call.arguments = guardChatTurn({ message, rawText: rawArgs }).toolArguments;
        }
      }
    }

    // When the guard had to drop the model's reply after a resume was written, say what
    // happened from the tool's own record: the target role and the diff notes, nothing else.
    if (fullMessage === "I can only rephrase facts already on the resume.") {
      const wrote = toolCalls.map((c) => (c.name === "createResumeJakeTemplate" ? unwrapToolResult(c.result) : null)).find((r) => r?.success);
      const t = wrote?.tailoring;
      if (t) {
        const role = t.jobTitle && t.jobCompany ? ` for the ${t.jobTitle} role at ${t.jobCompany}` : "";
        const notes = (t.changes ?? []).map((c: { title: string; note: string }) => `${c.title}: ${c.note.charAt(0).toLowerCase()}${c.note.slice(1)}`);
        fullMessage = `Done. I tailored your resume${role}${notes.length ? `. ${notes.join(". ")}.` : "."}`;
      }
    }

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