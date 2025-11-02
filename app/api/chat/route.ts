import { NextRequest, NextResponse } from 'next/server';
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
import { z } from 'zod';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

import { setDefaultOpenAIKey } from '@openai/agents';
import { setTracingExportApiKey } from '@openai/agents';
setDefaultOpenAIKey(process.env.NODE_ENV === 'production' ? process.env.OPENAI_API_KEY! : process.env.NEXT_PUBLIC_OPENAI_API_KEY!);
setTracingExportApiKey(process.env.NODE_ENV === 'production' ? process.env.OPENAI_API_KEY! : process.env.NEXT_PUBLIC_OPENAI_API_KEY!);

const execAsync = promisify(exec);

/* ------------------------------------------------------------------------------------------------

JOBKOMPASS AGENT CONSTANTS

-------------------------------------------------------------------------------------------------- */ 

const jobKompassDescription = `
JobKompass is an AI-powered career platform that helps job seekers create professional resumes, 
cover letters, and optimize their job search strategy. Our platform specializes in:

- Professional resume generation using LaTeX templates for ATS-optimized formatting
- Cover letter creation tailored to specific job applications
- Career guidance and job search optimization
- Industry-specific resume templates and best practices
- Real-time resume analysis and improvement suggestions

We focus on helping users create standout resumes that pass ATS systems while maintaining 
professional appearance and readability for human recruiters.
`;

const resumeBestPractices = `
RESUME BEST PRACTICES:

1. ATS Optimization:
   - Use standard section headers (Experience, Education, Skills, Projects)
   - Include relevant keywords from job descriptions
   - Use simple, clean formatting without tables or graphics
   - Save as PDF for consistency across systems

2. Content Guidelines:
   - Use action verbs to start bullet points
   - Quantify achievements with numbers and percentages
   - Keep descriptions concise but impactful
   - Tailor content to the specific job application

3. Technical Skills:
   - List relevant technologies and tools
   - Include proficiency levels when appropriate
   - Group related skills together
   - Update regularly to reflect current abilities

4. Experience Section:
   - Use reverse chronological order
   - Include company name, job title, dates, and location
   - Focus on achievements rather than job duties
   - Use consistent formatting throughout

5. Education:
   - Include degree, institution, graduation date
   - Add relevant coursework or projects if applicable
   - Include GPA only if it's strong (3.5+)
`;

/* ------------------------------------------------------------------------------------------------

JOBKOMPASS TOOLS

-------------------------------------------------------------------------------------------------- */ 

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

// Resume Analysis Tool
const analyzeResumeTool = tool({
  name: 'analyzeResume',
  description: 'Analyze a resume for ATS optimization, content quality, and improvement suggestions',
  parameters: z.object({
    resumeContent: z.string().describe('The resume content to analyze'),
    jobDescription: z.string().optional().nullable().describe('Optional job description to match against'),
  }),
  execute: async (input) => {
    const { resumeContent, jobDescription } = input;
    
    // Basic analysis logic (in a real implementation, this would use AI)
    const analysis = {
      atsScore: 85,
      contentQuality: 'Good',
      suggestions: [
        'Consider adding more quantifiable achievements',
        'Ensure consistent formatting throughout',
        'Include relevant keywords from job descriptions',
        'Keep bullet points concise and action-oriented'
      ],
      strengths: [
        'Clear section organization',
        'Professional formatting',
        'Relevant experience highlighted'
      ],
      improvements: [
        'Add more specific metrics and numbers',
        'Include a professional summary section',
        'Ensure all dates are consistent'
      ]
    };

    if (jobDescription) {
      analysis.suggestions.push('Tailor keywords to match the job description more closely');
    }

    return {
      analysis,
      recommendations: analysis.suggestions,
      overallScore: analysis.atsScore
    };
  },
});

/* ------------------------------------------------------------------------------------------------

JOBKOMPASS AGENT

-------------------------------------------------------------------------------------------------- */ 

// Create the JobKompass agent
const jobKompassAgent = new Agent({
  name: 'JobKompass',
  instructions: `You are JobKompass, an AI career assistant specializing in resume creation, job search optimization, and career guidance.

${jobKompassDescription}

${resumeBestPractices}

Your key capabilities include:
- Creating professional, ATS-optimized resumes using the Jake LaTeX template
- Analyzing resumes for improvement opportunities
- Providing career guidance and job search tips
- Helping users optimize their professional profiles
- Offering industry-specific resume advice

When users need resume creation, use the createResumeJakeTemplate tool to generate professional resumes. 
For resume analysis and improvement suggestions, use the analyzeResume tool.

Always be helpful, professional, and provide actionable advice. Focus on helping users create 
standout resumes that will get them noticed by recruiters and pass ATS systems.

Key guidelines:
- Always ask for complete information when creating resumes
- Provide specific, actionable feedback
- Focus on ATS optimization and professional presentation
- Be encouraging and supportive in your guidance
- Suggest improvements based on industry best practices`,
  handoffDescription: 'JobKompass - Career Assistant - Specializes in resume creation, job search optimization, and career guidance.',
  tools: [createResumeJakeTemplateTool, analyzeResumeTool, webSearchTool()],
  model: "gpt-5-mini",
});

// Request/Response schemas
const ChatRequestSchema = z.object({
  message: z.string(),
  history: z.array(z.any()).optional().default([]),
  agentId: z.string().optional(),
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
    const { message, history = [], agentId } = ChatRequestSchema.parse(body);

    // Use JobKompass agent
    const currentAgent = jobKompassAgent;

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
    const updatedHistory: AgentInputItem[] = [...convertedHistory, user(message)];

    // Run the agent within a trace
    const result = await withTrace('JobKompass Chat Session', async () => {
      return await run(currentAgent, updatedHistory, {
        maxTurns: 5, // Limit turns to prevent infinite loops
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