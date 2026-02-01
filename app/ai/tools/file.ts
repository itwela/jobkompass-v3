import {
  Agent,
  AgentInputItem,
  run,
  tool,
  user,
  assistant,
  withTrace,
  webSearchTool,
} from '@openai/agents';
import { z } from "zod";
import path from "path";
import fs from "fs";
import os from "os";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { generateResumeLatex } from "@/lib/resume/generators";


// Helper function to escape LaTeX special characters
function escapeLatex(str: string | null | undefined) {
    if (!str) return '';
    // Escape all special LaTeX characters including braces (needed for literal braces in text)
    return str.replace(/([\\{}&$%#_^~])/g, '\\$1');
}

// Helper function to format URLs
function formatUrl(url: string | null | undefined) {
    if (!url) return '';
    // Add https:// if no protocol is specified
    const formattedUrl = url.startsWith('http') ? url : `https://${url}`;
    return formattedUrl;
};

// Helper function to get the current time in a human readable format
function getFormattedTime() {
  const now = new Date();
  const date = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  return `${date} ${time}`;
}

const jakeCoverLetterTemplatePath = path.join(process.cwd(), 'templates/coverLetter/jakeCoverLetter.tex');

 const createResumeJakeTemplateTool = (convexClient: ConvexHttpClient) => tool({
   name: 'createResumeJakeTemplate',
   description: 'Generate a professional resume using the JobKompass Jake template. The user selects the template in the Context panel. Do NOT call this tool until the user has selected a template - if they ask to create a resume without a selection, ask them to select one first. Automatically saves the resume to the user\'s documents.',
   parameters: z.object({
    personalInfo: z.object({
      firstName: z.string().describe('First name of the person'),
      lastName: z.string().describe('Last name of the person'),
      email: z.string().email("Must be a valid email").describe('Email address'),
      citizenship: z.string().optional().nullable().describe('Citizenship or work authorization'),
      location: z.string().optional().nullable().describe('Current location (city, state, country)'),
      linkedin: z.string().optional().nullable().describe('LinkedIn profile URL'),
      github: z.string().optional().nullable().describe('GitHub profile URL'),
      portfolio: z.string().optional().nullable().describe('Portfolio website URL'),
    }),
    experience: z.array(z.object({
      company: z.string().describe('Company name'),
      title: z.string().describe('Job title'),
      location: z.string().optional().nullable().describe('Job location'),
      date: z.string().describe('Employment dates (e.g., "Jan 2020 - Present")'),
      details: z.array(z.string()).describe('List of job responsibilities and achievements'),
    })).optional().nullable().default([]),
    education: z.array(z.object({
      name: z.string().describe('School/University name'),
      degree: z.string().describe('Degree type and field'),
      field: z.string().optional().nullable().describe('Field of study'),
      location: z.string().optional().nullable().describe('School location'),
      startDate: z.string().optional().nullable().describe('Start date'),
      endDate: z.string().describe('Graduation date or "Present"'),
      details: z.array(z.string()).optional().nullable().describe('Additional details like GPA, honors, etc.'),
    })).optional().nullable().default([]),
    projects: z.array(z.object({
      name: z.string().describe('Project name'),
      description: z.string().describe('Project description'),
      date: z.string().optional().nullable().describe('Project completion date'),
      technologies: z.array(z.string()).optional().nullable().describe('Technologies used'),
      details: z.array(z.string()).optional().nullable().describe('Additional project details'),
    })).optional().nullable().default([]),
    skills: z.object({
      technical: z.array(z.string()).optional().nullable().describe('Technical skills'),
      additional: z.array(z.string()).optional().nullable().describe('Additional skills'),
    }).optional().nullable(),
    additionalInfo: z.object({
      interests: z.array(z.string()).optional().nullable().describe('Professional interests'),
      hobbies: z.array(z.string()).optional().nullable().describe('Relevant hobbies'),
      languages: z.array(z.string()).optional().nullable().describe('Languages spoken'),
      references: z.array(z.string()).optional().nullable().describe('References'),
    }).optional().nullable(),
    targetCompany: z.string().optional().nullable().describe('Target company name for this resume (will be included in document name)'),
    templateId: z.enum(['jake']).describe('REQUIRED: Use "jake" (JobKompass Jake) - the only template currently available.'),
  }),
  execute: async (input) => {
    const toolExecutionId = `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    
    console.log(`[${toolExecutionId}] [RESUME_TOOL] Starting resume generation`, {
      timestamp: new Date().toISOString(),
      firstName: input.personalInfo?.firstName,
      lastName: input.personalInfo?.lastName,
      targetCompany: input.targetCompany,
      hasExperience: !!input.experience?.length,
      experienceCount: input.experience?.length || 0,
      hasEducation: !!input.education?.length,
      educationCount: input.education?.length || 0,
    });
    
    try {
      const LATEX_SERVICE_URL = process.env.LATEX_SERVICE_URL;
      if (!LATEX_SERVICE_URL) {
        return {
          success: false,
          error: 'LaTeX service not configured',
          message: 'LATEX_SERVICE_URL environment variable is not set.',
        };
      }

      // Check if user can generate documents
      console.log(`[${toolExecutionId}] [RESUME_TOOL] Checking document generation limits...`);
      const canGenerate = await convexClient.query(api.usage.canGenerateDocument, {});
      console.log(`[${toolExecutionId}] [RESUME_TOOL] Generation limit check`, {
        allowed: canGenerate?.allowed,
        limit: canGenerate?.limit,
        used: canGenerate?.used
      });
      
      if (!canGenerate?.allowed) {
        console.warn(`[${toolExecutionId}] [RESUME_TOOL] Document limit reached`);
        return {
          success: false,
          error: 'Document limit reached',
          message: `You've reached your limit of ${canGenerate.limit} documents this month. Please upgrade your plan to continue generating documents.`,
          limitReached: true,
        };
      }

      const formattedTime = getFormattedTime();
      const templateId = input.templateId || 'jake';
      const latexTemplate = generateResumeLatex(input as any, templateId);

      /// SECTION PDF GENERATION (LaTeX service)
    
      const uniqueId = Date.now().toString(36) + Math.random().toString(36).slice(2);
      console.log(`[${toolExecutionId}] [RESUME_TOOL] Calling LaTeX compilation service...`);

      const compileResponse = await fetch(`${LATEX_SERVICE_URL}/compile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latex: latexTemplate,
          filename: `resume-${uniqueId}`,
        }),
      });

      if (!compileResponse.ok) {
        const errorData = await compileResponse.json().catch(() => ({}));
        const log = errorData.log ?? '';
        console.error(`[${toolExecutionId}] [RESUME_TOOL] LaTeX service error`, {
          status: compileResponse.status,
          error: errorData.error,
          log: log.substring(0, 500),
        });
        return {
          success: false,
          error: `LaTeX compilation failed: ${errorData.error || compileResponse.statusText}`,
          message: 'LaTeX compilation failed. The PDF could not be generated.',
          logContent: log.substring(0, 2000),
        };
      }

      const { pdfBase64 } = await compileResponse.json();
      if (!pdfBase64) {
        return {
          success: false,
          error: 'LaTeX service did not return a PDF',
          message: 'LaTeX compilation succeeded but no PDF was returned.',
        };
      }

      const pdfBuffer = Buffer.from(pdfBase64, 'base64');
      console.log(`[${toolExecutionId}] [RESUME_TOOL] PDF received from service`, { pdfSize: pdfBuffer.length });

      /// SECTION AUTO-SAVE TO CONVEX
      
      console.log(`[${toolExecutionId}] [RESUME_TOOL] Starting auto-save to Convex...`);
      try {
        // Get upload URL from Convex
        console.log(`[${toolExecutionId}] [RESUME_TOOL] Getting upload URL...`);
        const uploadUrl = await convexClient.mutation(api.documents.generateUploadUrl);
        console.log(`[${toolExecutionId}] [RESUME_TOOL] Upload URL obtained`, { 
          hasUrl: !!uploadUrl,
          urlLength: uploadUrl?.length || 0 
        });
        
        // Convert Buffer to Blob for upload
        const pdfBlob = new Blob([new Uint8Array(pdfBuffer)], { type: 'application/pdf' });
        
        // Upload PDF to Convex storage
        console.log(`[${toolExecutionId}] [RESUME_TOOL] Uploading PDF to Convex storage...`);
        const uploadStartTime = Date.now();
        const uploadResponse = await fetch(uploadUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/pdf' },
          body: pdfBlob,
        });
        const uploadDuration = Date.now() - uploadStartTime;
        
        console.log(`[${toolExecutionId}] [RESUME_TOOL] Upload response`, {
          ok: uploadResponse.ok,
          status: uploadResponse.status,
          statusText: uploadResponse.statusText,
          duration: `${uploadDuration}ms`
        });
        
        if (uploadResponse.ok) {
          const { storageId } = await uploadResponse.json();
          console.log(`[${toolExecutionId}] [RESUME_TOOL] PDF uploaded successfully`, { storageId });
          
          // Save resume to database
          const now = new Date();
          const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }); // e.g. "Jun 10, 24"
          
          // Include company name in resume title if provided
          const companySuffix = input.targetCompany ? ` - ${input.targetCompany}` : '';
          const resumeName = `${input.personalInfo.firstName} ${input.personalInfo.lastName} Resume${companySuffix} (${formattedTime})`;
          
          console.log(`[${toolExecutionId}] [RESUME_TOOL] Saving resume to database...`, {
            resumeName,
            storageId,
            fileSize: pdfBuffer.length
          });
          
          await convexClient.mutation(api.documents.saveGeneratedResumeWithFile, {
            name: resumeName,
            fileId: storageId,
            fileName: `resume-${input.personalInfo.firstName}-${input.personalInfo.lastName}-${formattedTime}.pdf`,
            fileSize: pdfBuffer.length,
            content: input,
            template: templateId,
          });
          
          console.log(`[${toolExecutionId}] [RESUME_TOOL] ✅ Resume saved to database successfully`, { resumeName });
        } else {
          const errorText = await uploadResponse.text();
          console.error(`[${toolExecutionId}] [RESUME_TOOL] Upload failed`, {
            status: uploadResponse.status,
            statusText: uploadResponse.statusText,
            errorText: errorText.substring(0, 500)
          });
        }
      } catch (saveError) {
        // Don't fail the whole operation if save fails, just log it
        console.error(`[${toolExecutionId}] [RESUME_TOOL] ❌ Failed to auto-save resume:`, {
          error: saveError instanceof Error ? saveError.message : String(saveError),
          stack: saveError instanceof Error ? saveError.stack : undefined
        });
      }

      /// SECTION RETURN RESULT
      
      const totalDuration = Date.now() - startTime;
      console.log(`[${toolExecutionId}] [RESUME_TOOL] ✅ Resume generation completed successfully`, {
        totalDuration: `${totalDuration}ms`,
        fileName: `resume-${input.personalInfo.firstName}-${input.personalInfo.lastName}-${formattedTime}.pdf`
      });
      
      // Clean up temp folder before returning
      try {
        const tempDir = path.join(os.tmpdir(), 'jobkompass-resume');
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true, force: true });
        }
      } catch (cleanupError) {
        console.error(`[${toolExecutionId}] [RESUME_TOOL] Error cleaning up temp folder:`, cleanupError);
      }
      
      // Return LaTeX sections, and the full tex
      return {
        success: true,
        message: 'Resume generated and saved successfully',
        // textContent: latexTemplate,
        pdfBase64: pdfBase64,
        fileName: `resume-${input.personalInfo.firstName}-${input.personalInfo.lastName}--${formattedTime}.pdf`,
        texFileName: `resume-${input.personalInfo.firstName}-${input.personalInfo.lastName}--${formattedTime}.tex`,
        // sections: {
        //   headerContent,
        //   educationContent,
        //   experienceContent,
        //   projectsContent,
        //   skillsContent
        // },
        documentType: 'resume',
      };
    } catch (error) {
      const totalDuration = Date.now() - startTime;
      console.error(`[${toolExecutionId}] [RESUME_TOOL] ❌ Resume generation error:`, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        totalDuration: `${totalDuration}ms`,
        errorType: error instanceof Error ? error.constructor.name : typeof error
      });
      // Clean up temp folder even on error
      try {
        const tempDir = path.join(os.tmpdir(), 'jobkompass-resume');
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true, force: true });
        }
      } catch (cleanupError) {
        console.error('Error cleaning up temp folder:', cleanupError);
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        message: 'Failed to generate resume'
      };
    }
  },
});

// Cover Letter Generation Tool - Jake Template Style
const createCoverLetterJakeTemplateTool = (convexClient: ConvexHttpClient) => tool({
  name: 'createCoverLetterJakeTemplate',
  description: 'Generate a professional cover letter using the Jake LaTeX template style. This tool creates a well-formatted cover letter tailored for the specific job and company. Automatically saves the cover letter to the user\'s documents.',
  parameters: z.object({
    personalInfo: z.object({
      firstName: z.string().describe('First name of the applicant'),
      lastName: z.string().describe('Last name of the applicant'),
      email: z.string().email("Must be a valid email").describe('Email address'),
      phone: z.string().optional().nullable().describe('Phone number'),
      location: z.string().optional().nullable().describe('City, State or full address'),
    }),
    jobInfo: z.object({
      company: z.string().describe('Name of the company applying to'),
      position: z.string().describe('Job title/position applying for'),
      hiringManagerName: z.string().optional().nullable().describe('Name of the hiring manager (if known)'),
      companyAddress: z.string().optional().nullable().describe('Company address (if known)'),
    }),
    letterContent: z.object({
      openingParagraph: z.string().describe('Opening paragraph introducing yourself and expressing interest in the position. Should mention how you found the job and why you\'re excited about it.'),
      bodyParagraphs: z.array(z.string()).describe('Body paragraphs highlighting your relevant experience, skills, and achievements. Each paragraph should focus on specific qualifications that match the job requirements.'),
      closingParagraph: z.string().describe('Closing paragraph summarizing your interest, thanking them for their consideration, and expressing enthusiasm for next steps.'),
    }),
  }),
  execute: async (input) => {
    try {
      // Check if user can generate documents
      const canGenerate = await convexClient.query(api.usage.canGenerateDocument, {});
      if (!canGenerate?.allowed) {
        return {
          success: false,
          error: 'Document limit reached',
          message: `You've reached your limit of ${canGenerate.limit} documents this month. Please upgrade your plan to continue generating cover letters.`,
          limitReached: true,
        };
      }

      // get the time in a human readable format
      const formattedTime = getFormattedTime();

      /// SECTION FILE SETUP
      const templatePath = jakeCoverLetterTemplatePath;
      if (!fs.existsSync(templatePath)) {
        throw new Error(`LaTeX template not found at ${templatePath}`);
      }

      let latexTemplate = fs.readFileSync(templatePath, 'utf-8');

      /// SECTION COVER LETTER CONTENT GENERATION

      // Build header
      const fullName = `${escapeLatex(input.personalInfo.firstName)} ${escapeLatex(input.personalInfo.lastName)}`;
      const contactParts = [];
      contactParts.push(escapeLatex(input.personalInfo.email));
      if (input.personalInfo.phone) {
        contactParts.push(escapeLatex(input.personalInfo.phone));
      }
      if (input.personalInfo.location) {
        contactParts.push(escapeLatex(input.personalInfo.location));
      }
      const contactLine = contactParts.join(' $|$ ');

      // Replace header
      latexTemplate = latexTemplate.replace(
        /\\begin{center}[\s\S]*?\\end{center}/,
        `\\begin{center}\n    \\textbf{\\Huge \\scshape ${fullName}} \\\\ \\vspace{1pt}\n    \\small ${contactLine}\n\\end{center}`
      );

      // Replace date
      const today = new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      latexTemplate = latexTemplate.replace('{{DATE}}', escapeLatex(today));

      // Replace recipient info
      const hiringManagerName = input.jobInfo.hiringManagerName || 'Hiring Manager';
      latexTemplate = latexTemplate.replace('{{HIRING_MANAGER_NAME}}', escapeLatex(hiringManagerName));
      latexTemplate = latexTemplate.replace('{{COMPANY_NAME}}', escapeLatex(input.jobInfo.company));
      latexTemplate = latexTemplate.replace('{{COMPANY_ADDRESS}}', input.jobInfo.companyAddress ? escapeLatex(input.jobInfo.companyAddress) : '');

      // Replace salutation
      const salutation = input.jobInfo.hiringManagerName 
        ? `${escapeLatex(input.jobInfo.hiringManagerName)}`
        : 'Hiring Manager';
      latexTemplate = latexTemplate.replace('{{SALUTATION}}', salutation);

      // Replace paragraphs
      latexTemplate = latexTemplate.replace('{{OPENING_PARAGRAPH}}', escapeLatex(input.letterContent.openingParagraph));
      
      const bodyContent = input.letterContent.bodyParagraphs
        .map(para => escapeLatex(para))
        .join('\n\n');
      latexTemplate = latexTemplate.replace('{{BODY_PARAGRAPHS}}', bodyContent);
      
      latexTemplate = latexTemplate.replace('{{CLOSING_PARAGRAPH}}', escapeLatex(input.letterContent.closingParagraph));

      // Replace signature name
      latexTemplate = latexTemplate.replace('{{YOUR NAME}}', fullName);

      /// SECTION PDF GENERATION (LaTeX service)
      
      const LATEX_SERVICE_URL = process.env.LATEX_SERVICE_URL;
      if (!LATEX_SERVICE_URL) {
        return {
          success: false,
          error: 'LaTeX service not configured',
          message: 'LATEX_SERVICE_URL environment variable is not set.',
        };
      }

      const uniqueId = Date.now().toString(36) + Math.random().toString(36).slice(2);
      const compileResponse = await fetch(`${LATEX_SERVICE_URL}/compile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latex: latexTemplate,
          filename: `coverletter-${uniqueId}`,
        }),
      });

      if (!compileResponse.ok) {
        const errorData = await compileResponse.json().catch(() => ({}));
        return {
          success: false,
          error: `LaTeX compilation failed: ${errorData.error || compileResponse.statusText}`,
          message: 'LaTeX compilation failed. The PDF could not be generated.',
        };
      }

      const { pdfBase64 } = await compileResponse.json();
      if (!pdfBase64) {
        return {
          success: false,
          error: 'LaTeX service did not return a PDF',
          message: 'LaTeX compilation succeeded but no PDF was returned.',
        };
      }

      const pdfBuffer = Buffer.from(pdfBase64, 'base64');

      /// SECTION AUTO-SAVE TO CONVEX
      
      try {
        const uploadUrl = await convexClient.mutation(api.documents.generateUploadUrl);
        const pdfBlob = new Blob([new Uint8Array(pdfBuffer)], { type: 'application/pdf' });
        
        const uploadResponse = await fetch(uploadUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/pdf' },
          body: pdfBlob,
        });
        
        if (uploadResponse.ok) {
          const { storageId } = await uploadResponse.json();
          
          // Include company name in cover letter title
          const companySuffix = input.jobInfo?.company ? ` - ${input.jobInfo.company}` : '';
          const coverLetterName = `${input.personalInfo.firstName} ${input.personalInfo.lastName} Cover Letter${companySuffix} (${formattedTime})`;
          
          await convexClient.mutation(api.documents.saveGeneratedCoverLetterWithFile, {
            name: coverLetterName,
            fileId: storageId,
            fileName: `coverletter-${input.personalInfo.firstName}-${input.personalInfo.lastName}-${formattedTime}.pdf`,
            fileSize: pdfBuffer.length,
            content: input,
            template: 'jake',
          });
        }
      } catch (saveError) {
        console.error('Failed to auto-save cover letter:', saveError);
      }

      /// SECTION RETURN RESULT
      
      // Clean up temp folder before returning
      try {
        const tempDir = path.join(os.tmpdir(), 'jobkompass-coverletter');
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true, force: true });
        }
      } catch (cleanupError) {
        console.error('Error cleaning up temp folder:', cleanupError);
      }
      
      return {
        success: true,
        message: 'Cover letter generated and saved successfully',
        // textContent: latexTemplate,
        pdfBase64: pdfBase64,
        fileName: `coverletter-${input.personalInfo.firstName}-${input.personalInfo.lastName}--${formattedTime}.pdf`,
        documentType: 'cover-letter',
      };
    } catch (error) {
      console.error('Cover letter generation error:', error);
      // Clean up temp folder even on error
      try {
        const tempDir = path.join(os.tmpdir(), 'jobkompass-coverletter');
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true, force: true });
        }
      } catch (cleanupError) {
        console.error('Error cleaning up temp folder:', cleanupError);
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        message: 'Failed to generate cover letter'
      };
    }
  },
});

// Add to Resources Tool
const createAddToResourcesTool = (convexClient: ConvexHttpClient) =>
  tool({
    name: "addResourceToLibrary",
    description:
      "Save a resource (link, document, or note) to the user's JobKompass library so they can revisit it later.",
    parameters: z.object({
      title: z.string().min(1, "Provide a descriptive title for the resource."),
      url: z
        .string()
        .min(1, "Provide a valid URL for the resource.")
        .describe("Full URL for the resource the user wants to save."),
      description: z
        .string()
        .optional()
        .nullable()
        .describe("Short summary or context for why this resource matters."),
      notes: z
        .string()
        .optional()
        .nullable()
        .describe("Any extra notes the assistant wants to attach."),
      tags: z
        .array(z.string())
        .optional()
        .nullable()
        .describe("Categorize the resource with keywords (e.g. interview, resume)."),
      category: z
        .string()
        .optional()
        .nullable()
        .describe("High-level category to group this resource (e.g. articles, templates)."),
      type: z
        .string()
        .optional()
        .nullable()
        .describe("Resource type slug. Defaults to 'resource'."),
    }),
    execute: async (input) => {
      const {
        title,
        url,
        description,
        notes,
        tags,
        category,
        type,
      } = input;

      try {
        // Get user's convex_user_id for the agent tool
        const user = await convexClient.query(api.auth.currentUser);
        if (!user) {
          return {
            success: false,
            message: "Please sign in to save resources to your library.",
            error: "Not authenticated",
          };
        }

        const convexUserId = user.convex_user_id || user._id;

        const resourceId = await convexClient.mutation(api.resources.addForAgent, {
          userId: convexUserId,
          type: type ?? "resource",
          title,
          url,
          description: description ?? undefined,
          notes: notes ?? undefined,
          tags: tags ?? undefined,
          category: category ?? undefined,
        });

        return {
          success: true,
          message: "Resource saved to the user's library.",
          resourceId,
        };
      } catch (error) {
        console.error("Failed to add resource via tool:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          message:
            errorMessage.toLowerCase().includes("not authenticated")
              ? "Please sign in to save resources to your library."
              : "Failed to add the resource. Try again once you're signed in.",
          error: errorMessage,
        };
      }
    },
  });

// Get User's Resumes Tool
const createGetUserResumesTool = (convexClient: ConvexHttpClient) =>
  tool({
    name: "getUserResumes",
    description:
      "Fetch all resumes from the user's library to understand what resumes they have available. Use this when the user asks about their resumes or wants help with resume selection.",
    parameters: z.object({}),
    execute: async () => {
      try {
        const resumes = await convexClient.query(api.documents.listResumes);
        
        return {
          success: true,
          message: `Found ${resumes?.length || 0} resume(s) in the user's library.`,
          resumes: resumes || [],
          count: resumes?.length || 0,
        };
      } catch (error) {
        console.error("Failed to fetch resumes via tool:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          message:
            errorMessage.toLowerCase().includes("not authenticated")
              ? "Please sign in to view your resumes."
              : "Failed to fetch resumes. Try again once you're signed in.",
          error: errorMessage,
        };
      }
    },
  });

// Get User's Jobs Tool
const createGetUserJobsTool = (convexClient: ConvexHttpClient) =>
  tool({
    name: "getUserJobs",
    description:
      "Fetch all job applications from the user's job tracker to understand what jobs they're tracking. Use this when the user asks about their job applications or wants help with job management.",
    parameters: z.object({
      status: z
        .enum(["Interested", "Applied", "Callback", "Interviewing", "Offered", "Rejected"])
        .optional()
        .nullable()
        .describe("Filter jobs by status. If not provided, returns all jobs."),
    }),
    execute: async (input) => {
      const { status } = input;

      try {
        const jobs = await convexClient.query(api.jobs.list);
        
        // Filter by status if provided
        const filteredJobs = status 
          ? jobs?.filter((job: any) => job.status === status)
          : jobs;
        
        return {
          success: true,
          message: status 
            ? `Found ${filteredJobs?.length || 0} job(s) with status "${status}".`
            : `Found ${filteredJobs?.length || 0} job(s) in the user's tracker.`,
          jobs: filteredJobs || [],
          count: filteredJobs?.length || 0,
        };
      } catch (error) {
        console.error("Failed to fetch jobs via tool:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          message:
            errorMessage.toLowerCase().includes("not authenticated")
              ? "Please sign in to view your jobs."
              : "Failed to fetch jobs. Try again once you're signed in.",
          error: errorMessage,
        };
      }
    },
  });

const createAddToJobsTool = (convexClient: ConvexHttpClient) =>
  tool({
    name: "addJobToTracker",
    description:
      "Add a job opportunity to the user's JobKompass tracker so they can follow up later.",
    parameters: z.object({
      company: z.string().min(1, "Provide the company name."),
      title: z.string().min(1, "Provide the job title."),
      link: z
        .string()
        .optional()
        .nullable()
        .describe("Full URL for the job posting."),
      status: z
        .enum(["Interested", "Applied", "Callback", "Interviewing", "Offered", "Rejected"])
        .default("Interested")
        .describe("Job status (Interested, Applied, Callback, Interviewing, Offered, Rejected). Defaults to 'Interested'."),
      compensation: z
        .string()
        .optional()
        .nullable()
        .describe("Salary range or compensation details (e.g., '$100k-$150k', '€60k', 'Competitive')."),
      keywords: z
        .array(z.string())
        .optional()
        .nullable()
        .describe("List of keywords associated with the job."),
      skills: z
        .array(z.string())
        .optional()
        .nullable()
        .describe("Skills required or relevant to the job."),
      description: z
        .string()
        .optional()
        .nullable()
        .describe("Short summary or description of the job."),
      dateApplied: z
        .string()
        .optional()
        .nullable()
        .describe("Date the user applied, if applicable."),
      interviewed: z
        .boolean()
        .optional()
        .nullable()
        .describe("Has the user interviewed for this role?"),
      easyApply: z
        .string()
        .optional()
        .nullable()
        .describe("Platform used for easy apply, if any."),
      resumeUsed: z
        .string()
        .optional()
        .nullable()
        .describe("Which resume version was used."),
      coverLetterUsed: z
        .string()
        .optional()
        .nullable()
        .describe("Which cover letter (if any) was used."),
      notes: z
        .string()
        .optional()
        .nullable()
        .describe("Additional notes to remember about the job."),
      userId: z
        .string()
        .optional()
        .nullable()
        .describe("Convex user identifier. Optional (unused when the request is authenticated)."),
      username: z
        .string()
        .optional()
        .nullable()
        .describe("Username to associate with the job. Optional (unused when authenticated)."),
    }),
    execute: async (input) => {
      const {
        company,
        title,
        link,
        status,
        compensation,
        keywords,
        skills,
        description,
        dateApplied,
        interviewed,
        easyApply,
        resumeUsed,
        coverLetterUsed,
        notes,
      } = input;

      try {
        // Check if user can add jobs
        const canAdd = await convexClient.query(api.usage.canAddJob, {});
        if (!canAdd?.allowed) {
          return {
            success: false,
            message:
              canAdd.subscriptionStatus === "inactive"
                ? `Your subscription isn’t active right now, so you’re currently limited to the Free plan (${canAdd.limit ?? 10} jobs).`
                : `Your job tracker is full for your ${canAdd.planLabel ?? "current"} plan (${canAdd.limit ?? 10} jobs).` +
                  (canAdd.upgradeSuggestion ? ` ${canAdd.upgradeSuggestion}` : ""),
            error: 'Job limit reached',
            limitReached: true,
          };
        }

        // Get user's convex_user_id for the agent tool
        const user = await convexClient.query(api.auth.currentUser);
        if (!user) {
          return {
            success: false,
            message: "Please sign in to save jobs to your tracker.",
            error: "Not authenticated",
          };
        }

        const convexUserId = user.convex_user_id || user._id;

        const jobId = await convexClient.mutation(api.jobs.addForAgent, {
          userId: convexUserId,
          company,
          title,
          link: link ?? "",
          status: status ?? "Interested",
          compensation: compensation ?? undefined,
          keywords: keywords ?? undefined,
          skills: skills ?? undefined,
          description: description ?? undefined,
          dateApplied: dateApplied ?? undefined,
          interviewed: interviewed ?? undefined,
          easyApply: easyApply ?? undefined,
          resumeUsed: resumeUsed ?? undefined,
          coverLetterUsed: coverLetterUsed ?? undefined,
          notes: notes ?? undefined,
        });

        return {
          success: true,
          message: "Job saved to the user's tracker.",
          jobId,
        };
      } catch (error) {
        console.error("Failed to add job via tool:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          message:
            errorMessage.toLowerCase().includes("not authenticated")
              ? "Please sign in to save jobs to your tracker."
              : "Failed to add the job. Try again once you're signed in.",
          error: errorMessage,
        };
      }
    },
  });

// Get Specific Resume by ID Tool
const createGetResumeByIdTool = (convexClient: ConvexHttpClient) =>
  tool({
    name: "getResumeById",
    description:
      "Fetch a specific resume by its ID to get detailed information about it. Use this when the user references a specific resume or when a resume ID is provided in context.",
    parameters: z.object({
      resumeId: z.string().describe("The Convex ID of the resume document to fetch."),
    }),
    execute: async (input) => {
      const { resumeId } = input;

      try {
        const resume = await convexClient.query(api.documents.getResume, {
          resumeId: resumeId as any,
        });
        
        if (!resume) {
          return {
            success: false,
            message: `Resume with ID "${resumeId}" not found.`,
            error: "Resume not found",
          };
        }
        
        return {
          success: true,
          message: `Successfully fetched resume: ${resume.name || 'Untitled'}`,
          resume: resume,
        };
      } catch (error) {
        console.error("Failed to fetch resume by ID via tool:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          message: "Failed to fetch the resume. Please check the ID and try again.",
          error: errorMessage,
        };
      }
    },
  });

// Get Specific Job by ID Tool
const createGetJobByIdTool = (convexClient: ConvexHttpClient) =>
  tool({
    name: "getJobById",
    description:
      "Fetch a specific job by its ID to get detailed information about it. Use this when the user references a specific job or when a job ID is provided in context.",
    parameters: z.object({
      jobId: z.string().describe("The Convex ID of the job to fetch."),
    }),
    execute: async (input) => {
      const { jobId } = input;

      try {
        const job = await convexClient.query(api.jobs.get, {
          id: jobId as any,
        });
        
        if (!job) {
          return {
            success: false,
            message: `Job with ID "${jobId}" not found.`,
            error: "Job not found",
          };
        }
        
        return {
          success: true,
          message: `Successfully fetched job: ${job.title} at ${job.company}`,
          job: job,
        };
      } catch (error) {
        console.error("Failed to fetch job by ID via tool:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          message: "Failed to fetch the job. Please check the ID and try again.",
          error: errorMessage,
        };
      }
    },
  });

// Get User's Resume Preferences Tool
const createGetUserResumePreferencesTool = (convexClient: ConvexHttpClient) =>
  tool({
    name: "getUserResumePreferences",
    description:
      "Fetch the user's resume generation preferences. These preferences should ALWAYS be considered when generating resumes. Use this tool at the start of any resume generation task to understand the user's requirements.",
    parameters: z.object({}),
    execute: async () => {
      try {
        const preferences = await convexClient.query(api.auth.getResumePreferences);
        
        return {
          success: true,
          message: preferences && preferences.length > 0 
            ? `Found ${preferences.length} resume preference(s) that must be applied to all resume generation.`
            : "No resume preferences found. Generate resume using best practices.",
          preferences: preferences || [],
          count: preferences?.length || 0,
        };
      } catch (error) {
        console.error("Failed to fetch resume preferences via tool:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          message:
            errorMessage.toLowerCase().includes("not authenticated")
              ? "Please sign in to view your resume preferences."
              : "Failed to fetch resume preferences. Try again once you're signed in.",
          error: errorMessage,
        };
      }
    },
  });

// Get User's Usage Stats Tool (always available)
const createGetUserUsageTool = (convexClient: ConvexHttpClient) =>
  tool({
    name: "getUserUsage",
    description:
      "Get the user's current usage statistics including documents generated this month and total jobs tracked. Use this to check limits before generating documents or adding jobs. Always available.",
    parameters: z.object({}),
    execute: async () => {
      try {
        const usage = await convexClient.query(api.usage.getUserUsage);
        
        if (!usage) {
          return {
            success: false,
            message: "Unable to fetch usage statistics. User may not be authenticated.",
          };
        }

        // Get subscription to determine limits
        const subscription = await convexClient.query(api.subscriptions.getUserSubscription);
        const planId = subscription?.planId || "free";

        const PLAN_LIMITS: Record<string, { documentsPerMonth: number; jobsLimit: number | null }> = {
          free: { documentsPerMonth: 3, jobsLimit: 10 },
          starter: { documentsPerMonth: 10, jobsLimit: 100 },
          plus: { documentsPerMonth: 60, jobsLimit: 100 },
          "plus-annual": { documentsPerMonth: 60, jobsLimit: 100 },
          pro: { documentsPerMonth: 180, jobsLimit: null },
          "pro-annual": { documentsPerMonth: 180, jobsLimit: null },
        };

        const limits = PLAN_LIMITS[planId] || PLAN_LIMITS.free;

        return {
          success: true,
          usage: {
            documentsGeneratedThisMonth: usage.documentsGeneratedThisMonth || 0,
            documentsLimit: limits.documentsPerMonth,
            documentsRemaining: Math.max(0, limits.documentsPerMonth - (usage.documentsGeneratedThisMonth || 0)),
            jobsCount: usage.jobsCount || 0,
            jobsLimit: limits.jobsLimit,
            jobsRemaining: limits.jobsLimit === null ? null : Math.max(0, limits.jobsLimit - (usage.jobsCount || 0)),
            planId,
          },
          message: `Current usage: ${usage.documentsGeneratedThisMonth || 0}/${limits.documentsPerMonth} documents this month, ${usage.jobsCount || 0}${limits.jobsLimit === null ? '' : `/${limits.jobsLimit}`} jobs tracked.`,
        };
      } catch (error) {
        console.error("Failed to fetch usage via tool:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          message: "Failed to fetch usage statistics.",
          error: errorMessage,
        };
      }
    },
  });

export {
  createResumeJakeTemplateTool,
  createCoverLetterJakeTemplateTool,
  createAddToResourcesTool,
  createAddToJobsTool,
  createGetUserResumesTool,
  createGetUserJobsTool,
  createGetResumeByIdTool,
  createGetJobByIdTool,
  createGetUserResumePreferencesTool,
  createGetUserUsageTool,
  escapeLatex,
};