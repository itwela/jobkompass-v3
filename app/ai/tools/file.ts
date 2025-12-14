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
import { exec } from 'child_process';
import { promisify } from 'util';
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const execAsync = promisify(exec);
type ConvexClientFactory = () => ConvexHttpClient | Promise<ConvexHttpClient>;


// Helper function to escape LaTeX special characters
function escapeLatex(str: string | null | undefined) {
    if (!str) return '';
    return str.replace(/([\\{}&$%#_^])/g, '\\$1');
}

// Create Resume Jake Template Tool
const createResumeJakeTemplateTool = tool({
    name: 'createResumeJakeTemplate',
    description: 'Generate a professional resume using the Jake LaTeX template. This tool creates an ATS-optimized resume with proper formatting and structure.',
    parameters: z.object({
        personalInfo: z.object({
            firstName: z.string().describe('First name of the person'),
            lastName: z.string().describe('Last name of the person'),
            citizenship: z.string().describe('Citizenship of the person'),
            email: z.string().email().describe('Email address'),
            phone: z.string().optional().nullable().describe('Phone number'),
            location: z.string().optional().nullable().describe('City, State or City, Country'),
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
    }),
    execute: async (input) => {
        try {
            const templatePath = path.join(process.cwd(), 'templates/resume/jakeLatex.tex');
            if (!fs.existsSync(templatePath)) {
                throw new Error(`LaTeX template not found at ${templatePath}`);
            }

            let latexTemplate = fs.readFileSync(templatePath, 'utf-8');

            // Clear any existing content by removing everything between placeholders
            latexTemplate = latexTemplate.replace(/% HEADER_PLACEHOLDER[\s\S]*?%-----------EDUCATION-----------/, '% HEADER_PLACEHOLDER\n%-----------EDUCATION-----------');
            latexTemplate = latexTemplate.replace(/% EDUCATION_PLACEHOLDER[\s\S]*?%-----------EXPERIENCE-----------/, '% EDUCATION_PLACEHOLDER\n%-----------EXPERIENCE-----------');
            latexTemplate = latexTemplate.replace(/% EXPERIENCE_PLACEHOLDER[\s\S]*?%-----------PROJECTS-----------/, '% EXPERIENCE_PLACEHOLDER\n%-----------PROJECTS-----------');
            latexTemplate = latexTemplate.replace(/% PROJECTS_PLACEHOLDER[\s\S]*?%-----------TECHNICAL SKILLS-----------/, '% PROJECTS_PLACEHOLDER\n%-----------TECHNICAL SKILLS-----------');
            latexTemplate = latexTemplate.replace(/% SKILLS_PLACEHOLDER[\s\S]*?%-----------ADDITIONAL INFO-----------/, '% SKILLS_PLACEHOLDER\n%-----------ADDITIONAL INFO-----------');
            latexTemplate = latexTemplate.replace(/% ADDITIONAL_INFO_PLACEHOLDER[\s\S]*?\\end{document}/, '% ADDITIONAL_INFO_PLACEHOLDER\n\\end{document}');

            // Helper function to format URLs
            const formatUrl = (url: string | null | undefined) => {
                if (!url) return '';
                // Add https:// if no protocol is specified
                const formattedUrl = url.startsWith('http') ? url : `https://${url}`;
                return formattedUrl;
            };

            // Generate header content
            const headerContent = `\\begin{center}
    \\textbf{\\Huge \\scshape ${escapeLatex(input.personalInfo.firstName)} ${escapeLatex(input.personalInfo.lastName)}} \\\\ \\vspace{1pt}
    \\small \\href{mailto:${escapeLatex(input.personalInfo.email)}}{\\underline{${escapeLatex(input.personalInfo.email)}}} $|$
    ${input.personalInfo.citizenship ? `${escapeLatex(input.personalInfo.citizenship)} $|$` : ''}
    ${input.personalInfo.phone ? `${escapeLatex(input.personalInfo.phone)} $|$` : ''}
    ${input.personalInfo.location ? `${escapeLatex(input.personalInfo.location)} $|$` : ''}
    ${input.personalInfo.linkedin ? `\\href{${escapeLatex(formatUrl(input.personalInfo.linkedin))}}{\\underline{${escapeLatex(input.personalInfo.linkedin.replace(/^https?:\/\//, ''))}}} $|$` : ''}
    ${input.personalInfo.github ? `\\href{${escapeLatex(formatUrl(input.personalInfo.github))}}{\\underline{${escapeLatex(input.personalInfo.github.replace(/^https?:\/\//, ''))}}} $|$` : ''}
    ${input.personalInfo.portfolio ? `\\href{${escapeLatex(formatUrl(input.personalInfo.portfolio))}}{\\underline{${escapeLatex(input.personalInfo.portfolio.replace(/^https?:\/\//, ''))}}}` : ''}
  \\end{center}`;

            // Generate education content
            const educationContent = Array.isArray(input.education) && input.education.length > 0
                ? `\\resumeSubHeadingListStart
             ${input.education.map((edu) => `
               \\resumeSubheading
                 {${escapeLatex(edu.name)}}{${escapeLatex(edu.location || '')}}
                 {${escapeLatex(edu.degree)} ${edu.field ? `in ${escapeLatex(edu.field)}` : ''}}{${edu.startDate ? `${escapeLatex(edu.startDate)} -- ${escapeLatex(edu.endDate)}` : `Estimated Graduation: ${escapeLatex(edu.endDate)}`}}
                 ${Array.isArray(edu.details) && edu.details.length ? `\\resumeItemListStart
                   ${edu.details.map((detail) => `\\resumeItem{${escapeLatex(detail)}}`).join('\n          ')}
                 \\resumeItemListEnd` : ''}
             `).join('\n')}
             \\resumeSubHeadingListEnd`
                : '';

            // Generate experience content
            const experienceContent = Array.isArray(input.experience) && input.experience.length > 0
                ? `\\resumeSubHeadingListStart
             ${input.experience.map((exp) => `
               \\resumeSubheading
                 {${escapeLatex(exp.company)}}{${escapeLatex(exp.location || '')}}
                 {${escapeLatex(exp.title)}}{${escapeLatex(exp.date)}}
                 ${Array.isArray(exp.details) && exp.details.length ? `\\resumeItemListStart
                   ${exp.details.map((detail) => `\\resumeItem{${escapeLatex(detail)}}`).join('\n          ')}
                 \\resumeItemListEnd` : ''}
             `).join('\n')}
             \\resumeSubHeadingListEnd`
                : '';

            // Generate projects content
            const projectsContent = Array.isArray(input.projects) && input.projects.length > 0
                ? `\\resumeSubHeadingListStart
       ${input.projects.map((proj) => `
         \\resumeProjectHeader
           {${escapeLatex(proj.name)}}{${escapeLatex(proj.date || '')}}
         
         \\resumeProjectDetails{${escapeLatex(proj.description)}}
         ${Array.isArray(proj.technologies) && proj.technologies.length
                        ? `\\resumeItem{Technologies Used: ${proj.technologies.map(escapeLatex).join(', ')}}`
                        : ''}
         ${Array.isArray(proj.details) && proj.details.length
                        ? `\\resumeItemListStart
             ${proj.details.map((detail) => `\\resumeItem{${escapeLatex(detail)}}`).join('\n          ')}
           \\resumeItemListEnd`
                        : ''}
       `).join('\n')}
       \\resumeSubHeadingListEnd`
                : '';

            // Generate skills content
            const skillsContent = input.skills && (Array.isArray(input.skills.technical) || Array.isArray(input.skills.additional))
                ? `${Array.isArray(input.skills.technical) && input.skills.technical.length
                    ? `\\resumeFlexContent{Technical:}{${input.skills.technical.map(escapeLatex).join(', ')}}`
                    : ''}
          ${Array.isArray(input.skills.additional) && input.skills.additional.length
                    ? `\\resumeFlexContent{Additional:}{${input.skills.additional.map(escapeLatex).join(', ')}}`
                    : ''}`
                : '';

            // Generate additional info content
            const additionalInfoContent = input.additionalInfo && (Array.isArray(input.additionalInfo.interests) || Array.isArray(input.additionalInfo.hobbies) || Array.isArray(input.additionalInfo.languages) || Array.isArray(input.additionalInfo.references))
                ? `${Array.isArray(input.additionalInfo.interests) && input.additionalInfo.interests.length
                    ? `\\resumeFlexContent{Interests:}{${input.additionalInfo.interests.map(escapeLatex).join(', ')}}`
                    : ''}
          ${Array.isArray(input.additionalInfo.hobbies) && input.additionalInfo.hobbies.length
                    ? `\\resumeFlexContent{Hobbies:}{${input.additionalInfo.hobbies.map(escapeLatex).join(', ')}}`
                    : ''}
          ${Array.isArray(input.additionalInfo.languages) && input.additionalInfo.languages.length
                    ? `\\resumeFlexContent{Languages:}{${input.additionalInfo.languages.map(escapeLatex).join(', ')}}`
                    : ''}
          ${Array.isArray(input.additionalInfo.references) && input.additionalInfo.references.length
                    ? `\\resumeFlexContent{References:}{${input.additionalInfo.references.map(escapeLatex).join(', ')}}`
                    : ''}`
                : '';

            // Replace placeholders with formatted content
            latexTemplate = latexTemplate
                .replace('% HEADER_PLACEHOLDER', headerContent)
                .replace('% EDUCATION_PLACEHOLDER', educationContent || '')
                .replace('% EXPERIENCE_PLACEHOLDER', experienceContent || '')
                .replace('% PROJECTS_PLACEHOLDER', projectsContent || '')
                .replace('% SKILLS_PLACEHOLDER', skillsContent || '')
                .replace('% ADDITIONAL_INFO_PLACEHOLDER', additionalInfoContent || '');

            // Remove sections with no content
            if (!educationContent) {
                latexTemplate = latexTemplate.replace(/\\section{Education}[\s\S]*?(?=\\section|\\end{document})/g, '');
            }
            if (!experienceContent) {
                latexTemplate = latexTemplate.replace(/\\section{Experience}[\s\S]*?(?=\\section|\\end{document})/g, '');
            }
            if (!projectsContent) {
                latexTemplate = latexTemplate.replace(/\\section{Projects}[\s\S]*?(?=\\section|\\end{document})/g, '');
            }
            if (!skillsContent) {
                latexTemplate = latexTemplate.replace(/\\section{Skills}[\s\S]*?(?=\\section|\\end{document})/g, '');
            }
            if (!additionalInfoContent) {
                latexTemplate = latexTemplate.replace(/\\section{Additional Information}[\s\S]*?(?=\\\\section|\\end{document})/g, '');
            }

            // Ensure proper document structure
            latexTemplate = latexTemplate.replace('\\begin{document}', '\\setlength{\\parskip}{0pt}\n\\begin{document}');

            // Create temporary directory and file
            const tempDir = path.join(process.cwd(), 'temp');
            if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
            const uniqueId = Date.now().toString(36) + Math.random().toString(36).slice(2);
            const tempFile = path.join(tempDir, `resume-${uniqueId}.tex`);
            fs.writeFileSync(tempFile, latexTemplate);

            // Compile LaTeX to PDF
            try {
                await execAsync(`pdflatex -interaction=nonstopmode -output-directory ${tempDir} ${tempFile}`);
                await execAsync(`pdflatex -interaction=nonstopmode -output-directory ${tempDir} ${tempFile}`);
            } catch (latexError: unknown) {
                console.error('LaTeX compilation error:', latexError);
                const errorMessage = latexError instanceof Error ? latexError.message : String(latexError);
                throw new Error(`LaTeX compilation failed: ${errorMessage}`);
            }

            // Read the generated PDF
            const pdfBuffer = fs.readFileSync(path.join(tempDir, `resume-${uniqueId}.pdf`));
            const pdfBase64 = pdfBuffer.toString('base64');

            // Clean up temp files
            ['aux', 'log', 'out'].forEach(ext => {
                const file = path.join(tempDir, `resume-${uniqueId}.${ext}`);
                if (fs.existsSync(file)) fs.unlinkSync(file);
            });

            return {
                success: true,
                message: 'Resume generated successfully using Jake LaTeX template',
                pdfBase64: pdfBase64,
                texContent: latexTemplate,
                fileName: `resume-${input.personalInfo.firstName}-${input.personalInfo.lastName}-${uniqueId}.pdf`,
                sections: {
                    hasEducation: !!educationContent,
                    hasExperience: !!experienceContent,
                    hasProjects: !!projectsContent,
                    hasSkills: !!skillsContent,
                    hasAdditionalInfo: !!additionalInfoContent,
                }
            };

        } catch (error) {
            console.error('Resume generation error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred',
                message: 'Failed to generate resume'
            };
        }
    },
});

// Add to Resources Tool
const createAddToResourcesTool = (getConvexClient: ConvexClientFactory) =>
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
      userId: z
        .string()
        .optional()
        .nullable()
        .describe("Convex user identifier. Optional (unused when the request is authenticated)."),
      username: z
        .string()
        .optional()
        .nullable()
        .describe("Username to associate with the resource. Optional (unused when authenticated)."),
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

      let convexClient: ConvexHttpClient;
      try {
        const maybeClient = getConvexClient();
        convexClient = maybeClient instanceof Promise ? await maybeClient : maybeClient;
      } catch (error) {
        console.error("Failed to initialise Convex client for addResourceToLibrary:", error);
        return {
          success: false,
          message: "Unable to save the resource because authentication could not be established.",
          error: error instanceof Error ? error.message : String(error),
        };
      }

      try {
        const resourceId = await convexClient.mutation(api.resources.add, {
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
const createGetUserResumesTool = (getConvexClient: ConvexClientFactory) =>
  tool({
    name: "getUserResumes",
    description:
      "Fetch all resumes from the user's library to understand what resumes they have available. Use this when the user asks about their resumes or wants help with resume selection.",
    parameters: z.object({}),
    execute: async () => {
      let convexClient: ConvexHttpClient;
      try {
        const maybeClient = getConvexClient();
        convexClient = maybeClient instanceof Promise ? await maybeClient : maybeClient;
      } catch (error) {
        console.error("Failed to initialise Convex client for getUserResumes:", error);
        return {
          success: false,
          message: "Unable to fetch resumes because authentication could not be established.",
          error: error instanceof Error ? error.message : String(error),
        };
      }

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
const createGetUserJobsTool = (getConvexClient: ConvexClientFactory) =>
  tool({
    name: "getUserJobs",
    description:
      "Fetch all job applications from the user's job tracker to understand what jobs they're tracking. Use this when the user asks about their job applications or wants help with job management.",
    parameters: z.object({
      status: z
        .enum(["Interested", "Applied", "Interviewing", "Offered", "Rejected"])
        .optional()
        .nullable()
        .describe("Filter jobs by status. If not provided, returns all jobs."),
    }),
    execute: async (input) => {
      const { status } = input;

      let convexClient: ConvexHttpClient;
      try {
        const maybeClient = getConvexClient();
        convexClient = maybeClient instanceof Promise ? await maybeClient : maybeClient;
      } catch (error) {
        console.error("Failed to initialise Convex client for getUserJobs:", error);
        return {
          success: false,
          message: "Unable to fetch jobs because authentication could not be established.",
          error: error instanceof Error ? error.message : String(error),
        };
      }

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

const createAddToJobsTool = (getConvexClient: ConvexClientFactory) =>
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
        .enum(["Interested", "Applied", "Interviewing", "Offered", "Rejected"])
        .default("Interested")
        .describe("Job status (Interested, Applied, Interviewing, Offered, Rejected). Defaults to 'Interested'."),
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

      let convexClient: ConvexHttpClient;
      try {
        const maybeClient = getConvexClient();
        convexClient = maybeClient instanceof Promise ? await maybeClient : maybeClient;
      } catch (error) {
        console.error("Failed to initialise Convex client for addJobToTracker:", error);
        return {
          success: false,
          message: "Unable to save the job because authentication could not be established.",
          error: error instanceof Error ? error.message : String(error),
        };
      }

      try {
        const jobId = await convexClient.mutation(api.jobs.add, {
          company,
          title,
          link: link ?? "",
          status: status ?? "wishlist",
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
const createGetResumeByIdTool = (getConvexClient: ConvexClientFactory) =>
  tool({
    name: "getResumeById",
    description:
      "Fetch a specific resume by its ID to get detailed information about it. Use this when the user references a specific resume or when a resume ID is provided in context.",
    parameters: z.object({
      resumeId: z.string().describe("The Convex ID of the resume document to fetch."),
    }),
    execute: async (input) => {
      const { resumeId } = input;

      let convexClient: ConvexHttpClient;
      try {
        const maybeClient = getConvexClient();
        convexClient = maybeClient instanceof Promise ? await maybeClient : maybeClient;
      } catch (error) {
        console.error("Failed to initialise Convex client for getResumeById:", error);
        return {
          success: false,
          message: "Unable to fetch resume because authentication could not be established.",
          error: error instanceof Error ? error.message : String(error),
        };
      }

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
const createGetJobByIdTool = (getConvexClient: ConvexClientFactory) =>
  tool({
    name: "getJobById",
    description:
      "Fetch a specific job by its ID to get detailed information about it. Use this when the user references a specific job or when a job ID is provided in context.",
    parameters: z.object({
      jobId: z.string().describe("The Convex ID of the job to fetch."),
    }),
    execute: async (input) => {
      const { jobId } = input;

      let convexClient: ConvexHttpClient;
      try {
        const maybeClient = getConvexClient();
        convexClient = maybeClient instanceof Promise ? await maybeClient : maybeClient;
      } catch (error) {
        console.error("Failed to initialise Convex client for getJobById:", error);
        return {
          success: false,
          message: "Unable to fetch job because authentication could not be established.",
          error: error instanceof Error ? error.message : String(error),
        };
      }

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

export {
  createResumeJakeTemplateTool,
  createAddToResourcesTool,
  createAddToJobsTool,
  createGetUserResumesTool,
  createGetUserJobsTool,
  createGetResumeByIdTool,
  createGetJobByIdTool,
  escapeLatex,
};