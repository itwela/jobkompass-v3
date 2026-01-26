import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { Agent, run, user } from '@openai/agents';
import { setDefaultOpenAIKey } from '@openai/agents';
import { createResumeJakeTemplateTool, createCoverLetterJakeTemplateTool } from '@/app/ai/tools/file';

setDefaultOpenAIKey(process.env.NODE_ENV === 'production' ? process.env.OPENAI_API_KEY! : process.env.NEXT_PUBLIC_OPENAI_API_KEY!);

const GenerateRequestSchema = z.object({
  templateType: z.enum(['resume', 'cover-letter']),
  templateId: z.string(),
  jobId: z.string().optional(),
  jobTitle: z.string().optional(),
  jobCompany: z.string().optional(),
  referenceResumeId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      templateType,
      templateId,
      jobId,
      jobTitle,
      jobCompany,
      referenceResumeId,
    } = GenerateRequestSchema.parse(body);

    // Reference resume is only required for resume generation
    if (templateType === 'resume' && !referenceResumeId) {
      return NextResponse.json(
        { success: false, error: 'Reference resume ID is required for resume generation' },
        { status: 400 }
      );
    }

    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL;
    if (!convexUrl) {
      throw new Error("CONVEX_URL not configured");
    }

    const convexToken = await convexAuthNextjsToken();
    const convexClient = new ConvexHttpClient(convexUrl);
    if (convexToken) {
      convexClient.setAuth(convexToken);
    } else {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Fetch reference resume from Convex (only for resume generation)
    let referenceResume = null;
    if (templateType === 'resume' && referenceResumeId) {
      referenceResume = await convexClient.query(api.documents.getResume, {
        resumeId: referenceResumeId as any,
      });

      if (!referenceResume) {
        return NextResponse.json(
          { success: false, error: 'Reference resume not found' },
          { status: 404 }
        );
      }
    }

    // Fetch job details if jobId is provided
    let jobDetails = null;
    if (jobId) {
      try {
        jobDetails = await convexClient.query(api.jobs.get, { id: jobId as any });
      } catch (e) {
        console.error('Error fetching job:', e);
      }
    }

    // Get user's resume preferences
    const resumePreferences = await convexClient.query(api.auth.getResumePreferences, {}) || [];

    // Check if user can generate documents
    const canGenerate = await convexClient.query(api.usage.canGenerateDocument, {});
    if (!canGenerate?.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Document limit reached',
          message: `You've reached your limit of ${canGenerate.limit} documents this month. Please upgrade to continue generating documents.`,
          limitReached: true,
        },
        { status: 403 }
      );
    }

    // Get current user info (needed for cover letter name generation)
    const currentUser = await convexClient.query(api.auth.currentUser, {});

    // Create tool instances (only the generation tool is needed)
    const resumeTool = createResumeJakeTemplateTool(convexClient);
    const coverLetterTool = createCoverLetterJakeTemplateTool(convexClient);

    // Build instructions using reference resume content (for resumes) or job info (for cover letters)
    let instructions = `You are a professional ${templateType === 'resume' ? 'resume' : 'cover letter'} generator. Generate a ${templateType === 'resume' ? 'professional, ATS-optimized resume' : 'tailored cover letter'} using the ${templateId} template. This is not a conversation, it is a single task.

${templateType === 'resume' && referenceResume ? `REFERENCE RESUME DATA:
- Resume name: ${referenceResume?.name || 'N/A'}
- Resume content: ${JSON.stringify(referenceResume?.content || {}, null, 2)}

TASK:
- Use the reference resume content as the primary source for all user information (personal info, experience, education, skills, etc.).
- Tailor the content for that specific position.
- Apply any resume preferences provided.
- IMPORTANT: When calling createResumeJakeTemplate, include the "targetCompany" parameter with the company name so the document name includes the company name.
- Call createResumeJakeTemplate ONCE to generate and auto-save the document.` : `COVER LETTER GENERATION:
${jobTitle && jobCompany ? `TARGET POSITION: ${jobTitle} at ${jobCompany}` : ''}
${jobDetails ? `JOB DETAILS:\n${JSON.stringify(jobDetails, null, 2)}` : ''}
${currentUser?.name ? `USER NAME: ${currentUser.name} (split into firstName and lastName for personalInfo)` : ''}
${currentUser?.email ? `USER EMAIL: ${currentUser.email}` : ''}

TASK:
- Generate a professional cover letter tailored for this specific position.
- Use information from the job details to craft compelling content.
- IMPORTANT: When calling createCoverLetterJakeTemplate:
  - Set personalInfo.firstName and personalInfo.lastName from the user's name (${currentUser?.name || 'use a placeholder name'})
  - Set personalInfo.email to ${currentUser?.email || 'the user\'s email'}
  - Set jobInfo.company to "${jobCompany || 'the company name'}" so the document name includes the company name.
  - Set jobInfo.position to "${jobTitle || 'the job title'}"
- Call createCoverLetterJakeTemplate ONCE to generate and auto-save the document.`}

${resumePreferences.length > 0 && templateType === 'resume' ? `\nRESUME PREFERENCES (MUST APPLY):\n${resumePreferences.join('\n')}` : ''}

- Do not call any other tools.`;

    // Create the agent with minimal turns to avoid loops
    const agent = new Agent({
      name: 'JobKompassTemplateGenerator',
      instructions: instructions,
      tools: templateType === 'resume' ? [resumeTool] : [coverLetterTool],
      model: "gpt-4o-mini",
    });

    // Build the user message
    let userMessage = `Generate my ${templateType === 'resume' ? 'resume' : 'cover letter'} using the ${templateId} template now.`;
    if (jobTitle && jobCompany) {
      userMessage += ` This is for the position: ${jobTitle} at ${jobCompany}.`;
      userMessage += ` Make sure to ${templateType === 'resume' ? 'include targetCompany parameter with "' + jobCompany + '"' : 'set jobInfo.company to "' + jobCompany + '"'} so the document name includes the company name.`;
    }
    userMessage += ` Use the provided context to fill details. Then call the generation tool once to produce and save the document.`;

    // Run the agent with minimal turns (just 1-2 turns should be enough)
    const result = await run(agent, [user(userMessage)], { maxTurns: 3 });

    // Extract tool calls from the result history
    const toolCalls: Array<{name: string, result?: any}> = [];
    if (result.history) {
      const callResults = new Map();
      
      // First pass: collect function call results
      for (const item of result.history) {
        if (item && typeof item === 'object' && 'type' in item && item.type === 'function_call_result') {
          const typedItem = item as { callId?: string, output?: any };
          if (typedItem.callId) {
            callResults.set(typedItem.callId, typedItem.output);
          }
        }
      }
      
      // Second pass: collect function calls and match with results
      for (const item of result.history) {
        if (item && typeof item === 'object' && 'type' in item) {
          if (item.type === 'function_call') {
            const typedItem = item as { name?: string, callId?: string, arguments?: any };
            if (typedItem.name) {
              toolCalls.push({
                name: typedItem.name,
                result: typedItem.callId ? callResults.get(typedItem.callId) : undefined
              });
            }
          }
        }
      }
    }
    const generationToolName = templateType === 'resume' ? 'createResumeJakeTemplate' : 'createCoverLetterJakeTemplate';
    const generationToolCalled = toolCalls.some((call: {name: string}) => call.name === generationToolName);

    if (!generationToolCalled) {
      return NextResponse.json(
        {
          success: false,
          error: 'Generation tool was not called. The agent may not have been able to generate the document.',
          agentResponse: result.finalOutput,
        },
        { status: 500 }
      );
    }

    // Check if the tool result indicates success
    const generationToolCall = toolCalls.find((call: {name: string, result?: any}) => call.name === generationToolName);
    if (generationToolCall?.result && typeof generationToolCall.result === 'object' && 'success' in generationToolCall.result) {
      if (!generationToolCall.result.success) {
        return NextResponse.json(
          {
            success: false,
            error: generationToolCall.result.error || 'Failed to generate document',
            message: generationToolCall.result.message || 'Document generation failed',
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: `${templateType === 'resume' ? 'Resume' : 'Cover letter'} generated and saved successfully`,
    });
  } catch (error) {
    console.error('Template generation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        details: error instanceof Error ? error.stack : String(error),
      },
      { status: 500 }
    );
  }
}
