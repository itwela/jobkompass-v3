import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { Agent, run, user } from '@openai/agents';
import { setDefaultOpenAIKey } from '@openai/agents';
import { createResumeJakeTemplateTool, createCoverLetterJakeTemplateTool } from '@/app/ai/tools/file';
import { extractResumeContent } from '@/lib/resume/extractFromPdf';
import { EMPTY_CANDIDATE, NO_INVENTED_FACTS_RULE, type FactGuard } from '@/lib/resume/noInventedFacts';
import { enforceAiRateLimit } from '@/lib/rateLimit/guard';

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
  const limited = await enforceAiRateLimit(request, "ai");
  if (limited) return limited;

  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();
  
  console.log(`[${requestId}] [TEMPLATE_GENERATE] Starting template generation request`, {
    timestamp: new Date().toISOString(),
  });

  try {
    const body = await request.json();

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

    // Facts about the candidate come from a selected resume, an upload, pasted text,
    // or — for a cover letter with none of those — the account's saved resume.
    let referenceResume: { name: string; content: any } | null = null;

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
      } else if (templateType === 'cover-letter') {
        try {
          const resumes = await convexClient.query(api.documents.listResumes, {});
          const saved = (Array.isArray(resumes) ? resumes : []).find((resume: { content?: unknown }) => {
            const content = resume?.content;
            return !!content && typeof content === 'object' && Object.keys(content as object).length > 0;
          }) as { name?: string; content?: unknown } | undefined;
          if (saved?.content) {
            referenceResume = {
              name: saved.name || 'Saved Resume',
              content: saved.content,
            };
            console.log(`[${requestId}] [TEMPLATE_GENERATE] Using saved resume for cover letter`);
          }
        } catch (e) {
          console.warn(`[${requestId}] [TEMPLATE_GENERATE] Could not load a saved resume for the cover letter:`, e);
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

    // ── Keyword Extraction Agent (resume only, when job data exists) ──────────
    let extractedKeywords: string[] = [];
    if (templateType === 'resume' && jobDetails) {
      const keywordAgent = new Agent({
        name: 'KeywordExtractor',
        instructions: `You are an ATS keyword extraction specialist. Analyze the job posting and list keywords and phrases the posting emphasizes. These labels describe the job, not the candidate.

Extract keywords across these categories:
1. Technical skills, tools, and technologies (exact names matter — "React.js" not just "React")
2. Soft skills explicitly stated in the posting
3. Role-specific action verbs (e.g. "architected", "spearheaded", "optimized")
4. Industry terms, methodologies, and certifications named in the posting
5. Key responsibilities stated in the posting

Rules:
- Output ONLY a raw JSON array of strings. No markdown, no explanation, no code fences.
- Format: ["keyword1", "keyword2", ...]
- Limit to the 15–20 highest-impact keywords.
- Prefer exact phrasing from the job posting.`,
        model: "gpt-4o-mini",
      });

      const keywordUserMessage = `Extract ATS keywords from this job posting:
Title: ${jobTitle || (jobDetails as any)?.title || 'N/A'}
Company: ${jobCompany || (jobDetails as any)?.company || 'N/A'}
Full job data: ${JSON.stringify(jobDetails)}`;

      try {
        const keywordResult = await run(keywordAgent, [user(keywordUserMessage)], { maxTurns: 1 });
        const output = (keywordResult.finalOutput || '').trim();
        const match = output.match(/\[[\s\S]*\]/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          if (Array.isArray(parsed)) extractedKeywords = parsed.filter((k: any) => typeof k === 'string');
        }
        console.log(`[${requestId}] [KEYWORD_EXTRACTOR] Extracted ${extractedKeywords.length} keywords`);
      } catch (e) {
        console.warn(`[${requestId}] [KEYWORD_EXTRACTOR] Extraction failed (non-fatal):`, e);
      }
    }

    // Create tool instances (only the generation tool is needed).
    // The tool drops employers, schools, tools, and metrics that are not in the source resume.
    const factGuard: FactGuard = {
      source: referenceResume?.content ?? EMPTY_CANDIDATE,
      applicationTarget: {
        company: jobCompany || (jobDetails as any)?.company,
        role: jobTitle || (jobDetails as any)?.title,
      },
    };
    const resumeTool = createResumeJakeTemplateTool(convexClient, factGuard);
    const coverLetterTool = createCoverLetterJakeTemplateTool(convexClient, factGuard);

    const keywordsBlock = extractedKeywords.length > 0
      ? `\nJOB KEYWORDS (emphasis only, not new facts):\n${extractedKeywords.join(', ')}\n\nYou may mention a keyword only where the candidate's real experience already supports it. Do not add it as a new skill, tool, employer, or metric.\n`
      : '';

    const noInventedFactsRule = `The job posting is not a source of facts about the candidate. Do not invent employers, metrics, skills, schools, certifications, titles, dates, degrees, team sizes, or tools. You may rephrase and reorder facts that are already in the candidate resume. A summary may name the target job or say the candidate is seeking that work. ${NO_INVENTED_FACTS_RULE}`;

    // Build instructions from the candidate's real resume. The job posting names the role; it is not the candidate's history.
    let instructions = `You are a professional ${templateType === 'resume' ? 'resume' : 'cover letter'} generator. Generate a ${templateType === 'resume' ? 'professional, ATS-optimized resume' : 'tailored cover letter'} using the ${templateId} template. This is not a conversation, it is a single task.

${templateType === 'resume' && referenceResume?.content ? `REFERENCE RESUME DATA:
- Resume name: ${referenceResume?.name || 'N/A'}
- Resume content: ${JSON.stringify(referenceResume?.content || {}, null, 2)}

${keywordsBlock}
TASK:
- Use the reference resume content as the primary source for all user information (personal info, experience, education, skills, etc.).
- ${noInventedFactsRule}
- Apply any resume preferences provided only when they do not add facts that are absent from the reference resume.
- IMPORTANT: When calling createResumeJakeTemplate, include "targetCompany" with the company name AND "templateId" with "${templateId}".
- Call createResumeJakeTemplate ONCE to generate and auto-save the document.` : `COVER LETTER GENERATION:
${jobTitle && jobCompany ? `TARGET POSITION: ${jobTitle} at ${jobCompany}` : ''}
${jobDetails ? `JOB DETAILS (what the employer is hiring for, not the candidate's history):\n${JSON.stringify(jobDetails, null, 2)}` : ''}
${currentUser?.name ? `USER NAME: ${currentUser.name} (split into firstName and lastName for personalInfo)` : ''}
${currentUser?.email ? `USER EMAIL: ${currentUser.email}` : ''}
${referenceResume?.content ? `CANDIDATE RESUME (the only source of facts about this person):
${JSON.stringify(referenceResume.content, null, 2)}

Use only the candidate resume for any claim about employers, titles, dates, schools, degrees, certifications, skills, tools, or metrics. ${noInventedFactsRule}` : `NO CANDIDATE RESUME WAS PROVIDED.
Do not state experience, years, employers, titles, schools, degrees, certifications, metrics, or credentials. Do not mention tools, technologies, or skills from the job posting, and do not say the candidate has them. Write only about interest in the named role at the named company.`}

TASK:
- Generate a professional cover letter tailored for this specific position.
- Use only the candidate resume when one is provided. If none is provided, do not invent experience.
- IMPORTANT: When calling createCoverLetterJakeTemplate:
  - Set personalInfo.firstName and personalInfo.lastName from the user's name (${currentUser?.name || 'leave them empty if the name is unknown'})
  - Set personalInfo.email to ${currentUser?.email || 'the user\'s email if it is known, otherwise leave it empty'}
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
      userMessage += `\n\nAdditional instructions from the user (wording, formatting, or emphasis only — do not add facts that are not in the resume): ${promptText.trim()}`;
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
      keywords: extractedKeywords,
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
