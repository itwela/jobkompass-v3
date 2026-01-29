import {
  Agent,
  run,
  setDefaultOpenAIKey,
  user,
} from '@openai/agents';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ConvexHttpClient } from 'convex/browser';
import { convexAuthNextjsToken } from '@convex-dev/auth/nextjs/server';
import { api } from '@/convex/_generated/api';
import { createAddToJobsTool } from '@/app/ai/tools/file';

const requestSchema = z.object({
  jobInformation: z.string().min(1, 'Job information is required'),
});

setDefaultOpenAIKey(
  process.env.NODE_ENV === 'production'
    ? process.env.OPENAI_API_KEY!
    : process.env.NEXT_PUBLIC_OPENAI_API_KEY!,
);

const jobExtractionInstructions = `
You are a job information extraction assistant. Your task is to extract job details from user-provided information and add them to their job tracker.

**IMPORTANT INSTRUCTIONS:**
1. Analyze the provided job information carefully
2. Extract ALL jobs mentioned - the user may provide 1 or multiple jobs
3. For EACH job, extract the following information:
   - **company**: The company name (required)
   - **title**: The job title (required)
   - **link**: The job posting URL if provided
   - **status**: Default to "Interested" if not specified
   - **description**: A concise summary of the job description/requirements
   - **keywords**: 3-5 relevant keywords that describe the position
   - **skills**: Technical and professional skills mentioned
   - **compensation**: Salary/compensation if mentioned
   - **dateApplied**: Date applied if mentioned
   - **notes**: Any additional relevant information

4. If multiple jobs are provided (e.g., in a list, separated by lines, or described separately), extract EACH one as a separate job
5. Call the addJobToTracker tool ONCE for EACH job you identify
6. Be thorough - extract as much information as possible from the provided text
7. If information is missing, use reasonable defaults (e.g., status: "Interested", link: "")

**EXAMPLES:**
- If user provides: "Software Engineer at Google, $150k, requires Python and React"
  → Extract: company="Google", title="Software Engineer", compensation="$150k", skills=["Python", "React"]

- If user provides a list of 3 jobs, extract all 3 separately

- If user pastes a full job description, extract all relevant details from it

Your goal is to accurately extract and save ALL jobs mentioned in the user's input.
`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { jobInformation } = requestSchema.parse(body);

    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL;
    if (!convexUrl) {
      throw new Error('CONVEX_URL not configured');
    }

    const convexToken = await convexAuthNextjsToken();
    const convexClient = new ConvexHttpClient(convexUrl);
    if (convexToken) {
      convexClient.setAuth(convexToken);
    } else {
      convexClient.clearAuth();
    }

    // Create the addJobToTracker tool instance
    const addJobTool = createAddToJobsTool(convexClient);

    // Create agent with job extraction instructions
    const agent = new Agent({
      name: 'JobExtractor',
      instructions: jobExtractionInstructions,
      tools: [addJobTool],
      model: 'gpt-4o-mini',
    });

    // Run the agent with the job information
    const result = await run(agent, [user(jobInformation)], { maxTurns: 3 });

    // Helper: tool output can be JSON string from the SDK; normalize to object
    const parseToolResult = (raw: unknown): Record<string, unknown> | null => {
      if (raw == null) return null;
      if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
      if (typeof raw === 'string') {
        try {
          const parsed = JSON.parse(raw) as unknown;
          return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
            ? (parsed as Record<string, unknown>)
            : null;
        } catch {
          return null;
        }
      }
      return null;
    };

    // Extract tool calls from the result history
    const toolCalls: Array<{ name: string; result?: Record<string, unknown> | null }> = [];
    if (result.history) {
      const callResults = new Map<string, unknown>();

      // First pass: collect function call results (SDK may use function_call_result or function_call_output)
      for (const item of result.history) {
        if (item && typeof item === 'object' && 'type' in item) {
          const type = (item as { type?: string }).type;
          if (type === 'function_call_result' || type === 'function_call_output') {
            const typedItem = item as { callId?: string; call_id?: string; output?: unknown };
            const callId = typedItem.callId ?? typedItem.call_id;
            if (callId != null) {
              callResults.set(callId, typedItem.output);
            }
          }
        }
      }

      // Second pass: collect function calls and match with results
      for (const item of result.history) {
        if (item && typeof item === 'object' && 'type' in item) {
          if ((item as { type: string }).type === 'function_call') {
            const typedItem = item as {
              name?: string;
              callId?: string;
              call_id?: string;
            };
            if (typedItem.name) {
              const callId = typedItem.callId ?? typedItem.call_id;
              const rawResult = callId ? callResults.get(callId) : undefined;
              toolCalls.push({
                name: typedItem.name,
                result: parseToolResult(rawResult),
              });
            }
          }
        }
      }
    }

    // Check if addJobToTracker was called
    const jobToolCalls = toolCalls.filter(
      (call) => call.name === 'addJobToTracker'
    );

    if (jobToolCalls.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            'No jobs were extracted from the provided information. Please provide more details about the job(s) you want to add.',
          agentResponse: result.finalOutput,
        },
        { status: 400 }
      );
    }

    // Check results (result is normalized object; success may be boolean)
    const successfulJobs = jobToolCalls.filter(
      (call) => call.result && call.result.success === true
    );
    const failedJobs = jobToolCalls.filter(
      (call) => !call.result || call.result.success !== true
    );

    // Explicit failure: parsed result with success === false or an error field (not just message – that can be success text)
    const explicitFailure = failedJobs.find(
      (call) =>
        call.result &&
        (call.result.success === false || typeof call.result.error === 'string')
    );

    if (successfulJobs.length === 0 && explicitFailure) {
      const err = explicitFailure.result!;
      const errorMessage =
        (typeof err.error === 'string' ? err.error : null) ||
        (typeof err.message === 'string' ? err.message : null) ||
        'Failed to add jobs';
      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
          agentResponse: result.finalOutput,
        },
        { status: 400 }
      );
    }

    // Success: we parsed at least one success, or we had tool calls but no parseable failure (assume added)
    const jobsAddedCount =
      successfulJobs.length > 0 ? successfulJobs.length : jobToolCalls.length;
    const message =
      jobsAddedCount === 1
        ? 'Job added successfully!'
        : `${jobsAddedCount} jobs added successfully!`;

    return NextResponse.json(
      {
        success: true,
        message,
        jobsAdded: jobsAddedCount,
        failedJobs: failedJobs.length,
        agentResponse: result.finalOutput,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error adding job:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to process job information',
      },
      { status: 500 }
    );
  }
}

