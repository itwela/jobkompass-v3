import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { Agent, run, user } from '@openai/agents';
import { setDefaultOpenAIKey } from '@openai/agents';
import { createResumeJakeTemplateTool, createCoverLetterJakeTemplateTool } from '@/app/ai/tools/file';
import { extractResumeContent } from '@/lib/resume/extractFromPdf';

setDefaultOpenAIKey(process.env.NODE_ENV === 'production' ? process.env.OPENAI_API_KEY! : process.env.NEXT_PUBLIC_OPENAI_API_KEY!);

const GenerateRequestSchema = z.object({
  templateType: z.enum(['resume', 'cover-letter']),
  templateId: z.string(),
  jobId: z.string().optional(),
  jobTitle: z.string().optional(),
  jobCompany: z.string().optional(),
  referenceResumeId: z.string().optional(),
  resumePdf: z.string().optional(),
  resumeText: z.string().optional(),
  promptText: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();
  
  console.log(`[${requestId}] [TEMPLATE_GENERATE] Starting template generation request`, {
    timestamp: new Date().toISOString(),
  });

  try {
    const body = await request.json();
    console.log(`[${requestId}] [TEMPLATE_GENERATE] Request body received`, { body });
    
    const {
      templateType,
      templateId,
      jobId,
      jobTitle,
      jobCompany,
      referenceResumeId,
      resumePdf,
      resumeText,
      promptText,
    } = GenerateRequestSchema.parse(body);
    
    const hasReferenceResume = !!referenceResumeId;
    const hasResumePdf = !!resumePdf && resumePdf.length > 0;
    const hasResumeText = !!resumeText && resumeText.trim().length > 0;
    
    console.log(`[${requestId}] [TEMPLATE_GENERATE] Parsed request`, {
      templateType,
      templateId,
      jobId,
      jobTitle,
      jobCompany,
      hasReferenceResumeId: hasReferenceResume,
      hasResumePdf,
      hasResumeText,
    });

    // For resume: need one of referenceResumeId, resumePdf, or resumeText
    if (templateType === 'resume' && !hasReferenceResume && !hasResumePdf && !hasResumeText) {
      return NextResponse.json(
        { success: false, error: 'Provide a reference resume, upload a PDF, or paste resume text' },
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

    // Get reference resume content (only for resume generation)
    // Source: Convex reference, uploaded PDF, or pasted text
    let referenceResume: { name: string; content: any } | null = null;
    
    if (templateType === 'resume') {
      if (hasReferenceResume && referenceResumeId) {
        try {
          console.log(`[${requestId}] [TEMPLATE_GENERATE] Fetching reference resume`, { referenceResumeId });
          const fetched = await convexClient.query(api.documents.getResume, {
            resumeId: referenceResumeId as any,
          });
          if (fetched) {
            referenceResume = {
              name: fetched.name || 'Reference Resume',
              content: fetched.content || {},
            };
            console.log(`[${requestId}] [TEMPLATE_GENERATE] Reference resume fetched`);
          } else {
            return NextResponse.json(
              { success: false, error: 'Reference resume not found' },
              { status: 404 }
            );
          }
        } catch (e) {
          console.error(`[${requestId}] [TEMPLATE_GENERATE] Error fetching reference resume:`, e);
          throw e;
        }
      } else if (hasResumePdf || hasResumeText) {
        try {
          const currentUser = await convexClient.query(api.auth.currentUser, {});
          const fallbackEmail = (currentUser as any)?.email || '';
          console.log(`[${requestId}] [TEMPLATE_GENERATE] Extracting resume from PDF/text`);
          const parsed = await extractResumeContent({
            resumePdf: hasResumePdf ? resumePdf : undefined,
            resumeText: hasResumeText ? resumeText : undefined,
            fallbackEmail,
          });
          referenceResume = {
            name: 'Uploaded/Pasted Resume',
            content: parsed,
          };
          console.log(`[${requestId}] [TEMPLATE_GENERATE] Resume extracted successfully`);
        } catch (extractErr) {
          const errMsg = extractErr instanceof Error ? extractErr.message : String(extractErr);
          console.error(`[${requestId}] [TEMPLATE_GENERATE] Extract error:`, extractErr);
          return NextResponse.json(
            { success: false, error: 'Failed to parse resume. Please try again.', details: errMsg },
            { status: 502 }
          );
        }
      }
    }

    // Fetch job details if jobId is provided
    let jobDetails = null;
    if (jobId) {
      try {
        console.log(`[${requestId}] [TEMPLATE_GENERATE] Fetching job details`, { jobId });
        jobDetails = await convexClient.query(api.jobs.get, { id: jobId as any });
        console.log(`[${requestId}] [TEMPLATE_GENERATE] Job details fetched`, { 
          hasJob: !!jobDetails,
          jobCompany: jobDetails?.company 
        });
      } catch (e) {
        console.warn(`[${requestId}] [TEMPLATE_GENERATE] Error fetching job details (ignored):`, e);
        // Ignore job fetch errors
      }
    }

    // Get user's resume preferences
    console.log(`[${requestId}] [TEMPLATE_GENERATE] Fetching resume preferences`);
    const resumePreferences = await convexClient.query(api.auth.getResumePreferences, {}) || [];
    console.log(`[${requestId}] [TEMPLATE_GENERATE] Resume preferences`, { 
      count: resumePreferences.length 
    });

    // Check if user can generate documents
    console.log(`[${requestId}] [TEMPLATE_GENERATE] Checking document generation limits`);
    const canGenerate = await convexClient.query(api.usage.canGenerateDocument, {});
    console.log(`[${requestId}] [TEMPLATE_GENERATE] Generation limit check`, {
      allowed: canGenerate?.allowed,
      limit: canGenerate?.limit,
      used: canGenerate?.used
    });
    
    if (!canGenerate?.allowed) {
      console.warn(`[${requestId}] [TEMPLATE_GENERATE] Document limit reached`);
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

${templateType === 'resume' && referenceResume?.content ? `REFERENCE RESUME DATA:
- Resume name: ${referenceResume?.name || 'N/A'}
- Resume content: ${JSON.stringify(referenceResume?.content || {}, null, 2)}


TASK:
- Use the reference resume content as the primary source for all user information (personal info, experience, education, skills, etc.).
- Tailor the content for that specific position.
- Apply any resume preferences provided.
- IMPORTANT: When calling createResumeJakeTemplate, include "targetCompany" with the company name AND "templateId" with "${templateId}" (the template the user selected).
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
  ${jobCompany ? `- Set targetCompany to "${jobCompany}" so the document name includes the company name.` : ''}
  
- Call createCoverLetterJakeTemplate ONCE to generate and auto-save the document.`}

${resumePreferences.length > 0 && templateType === 'resume' ? `\nRESUME PREFERENCES (MUST APPLY):\n${resumePreferences.join('\n')}` : ''}

- Do not call any other tools.`;

    // Create the agent with minimal turns to avoid loops
    console.log(`[${requestId}] [TEMPLATE_GENERATE] Creating agent`, {
      templateType,
      templateId,
      hasResumeTool: !!resumeTool,
      hasCoverLetterTool: !!coverLetterTool,
    });
    
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
    if (templateType === 'resume' && promptText && promptText.trim()) {
      userMessage += `\n\nAdditional instructions from the user: ${promptText.trim()}`;
    }
    userMessage += ` Use the provided context to fill details. Then call the generation tool once to produce and save the document.`;

    console.log(`[${requestId}] [TEMPLATE_GENERATE] Running agent`, {
      userMessage: userMessage.substring(0, 200) + '...',
      maxTurns: 3,
    });
    
    const agentStartTime = Date.now();
    // Run the agent with minimal turns (just 1-2 turns should be enough)
    const result = await run(agent, [user(userMessage)], { maxTurns: 3 });
    const agentDuration = Date.now() - agentStartTime;
    
    console.log(`[${requestId}] [TEMPLATE_GENERATE] Agent execution completed`, {
      duration: `${agentDuration}ms`,
      hasHistory: !!result.history,
      historyLength: result.history?.length || 0,
    });

    // Extract tool calls from the result history
    console.log(`[${requestId}] [TEMPLATE_GENERATE] Extracting tool calls from agent history`);
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
    
    console.log(`[${requestId}] [TEMPLATE_GENERATE] Tool calls extracted`, {
      toolCallsCount: toolCalls.length,
      toolNames: toolCalls.map(c => c.name),
    });
    
    const generationToolName = templateType === 'resume' ? 'createResumeJakeTemplate' : 'createCoverLetterJakeTemplate';
    const generationToolCalled = toolCalls.some((call: {name: string}) => call.name === generationToolName);
    
    console.log(`[${requestId}] [TEMPLATE_GENERATE] Generation tool check`, {
      generationToolName,
      generationToolCalled,
      toolCallResults: toolCalls.filter(c => c.name === generationToolName).map(c => ({
        name: c.name,
        hasResult: !!c.result,
        resultSuccess: c.result?.success,
        resultError: c.result?.error,
      })),
    });

    if (!generationToolCalled) {
      console.error(`[${requestId}] [TEMPLATE_GENERATE] Generation tool was not called!`);
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
