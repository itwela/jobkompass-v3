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
import { exec } from 'child_process';
import { promisify } from 'util';
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const execAsync = promisify(exec);


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

const jakeResumeTemplatePath = path.join(process.cwd(), 'templates/resume/jakeLatex.tex');
const jakeCoverLetterTemplatePath = path.join(process.cwd(), 'templates/coverLetter/jakeCoverLetter.tex');

 const createResumeJakeTemplateTool = (convexClient: ConvexHttpClient) => tool({
   name: 'createResumeJakeTemplate',
   description: 'Generate a professional resume using the Jake LaTeX template. This tool creates an ATS-optimized resume with proper formatting and structure. Automatically saves the resume to the user\'s documents.',
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
  }),
  execute: async (input) => {
    try {
      // Check if user can generate documents
      const canGenerate = await convexClient.query(api.usage.canGenerateDocument, {});
      
      if (!canGenerate?.allowed) {
        return {
          success: false,
          error: 'Document limit reached',
          message: `You've reached your limit of ${canGenerate.limit} documents this month. Please upgrade your plan to continue generating documents.`,
          limitReached: true,
        };
      }

      /// SECTION FILE SETUP
      // get the time in a human readable format
      const formattedTime = getFormattedTime();

      const templatePath = jakeResumeTemplatePath;
      if (!fs.existsSync(templatePath)) {
        throw new Error(`LaTeX template not found at ${templatePath}`);
      }

      let latexTemplate = fs.readFileSync(templatePath, 'utf-8');


      /// SECTION RESUME CONTENT GENERATION

      // Replace header section - match the template format exactly
      const fullName = `${escapeLatex(input.personalInfo.firstName)} ${escapeLatex(input.personalInfo.lastName)}`;
      const contactParts = [];
      
      // Add citizenship if provided
      if (input.personalInfo.citizenship) {
        contactParts.push(`\\underline{${escapeLatex(input.personalInfo.citizenship)}}`);
      }


      contactParts.push(`\\href{mailto:${escapeLatex(input.personalInfo.email)}}{\\underline{${escapeLatex(input.personalInfo.email)}}}`);
      
      // // Add location if provided
      // if (input.personalInfo.location) {
      //   contactParts.push(escapeLatex(input.personalInfo.location));
      // }
      
      if (input.personalInfo.linkedin) {
        // Extract handle from URL - handle both full URLs and partial URLs
        let linkedinHandle = input.personalInfo.linkedin
          .replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//, '') // Remove full URL
          .replace(/^linkedin\.com\/in\//, '') // Remove partial URL
          .replace(/\/$/, ''); // Remove trailing slash
        contactParts.push(`\\href{https://linkedin.com/in/${escapeLatex(linkedinHandle)}}{\\underline{linkedin.com/in/${escapeLatex(linkedinHandle)}}}`);
      }
      
      if (input.personalInfo.github) {
        // Extract handle from URL - handle both full URLs and partial URLs
        let githubHandle = input.personalInfo.github
          .replace(/^https?:\/\/(www\.)?github\.com\//, '') // Remove full URL
          .replace(/^github\.com\//, '') // Remove partial URL
          .replace(/\/$/, ''); // Remove trailing slash
        contactParts.push(`\\href{https://github.com/${escapeLatex(githubHandle)}}{\\underline{github.com/${escapeLatex(githubHandle)}}}`);
      }
      
      const headerContent = `\\begin{center}\n    \\textbf{\\Huge \\scshape ${fullName}} \\\\ \\vspace{1pt}\n    \\small ${contactParts.join(' $|$ ')}\n\\end{center}`;
      
      // Replace the header block in template (everything between \begin{center} and \end{center})
      latexTemplate = latexTemplate.replace(
        /\\begin{center}[\s\S]*?\\end{center}/,
        headerContent
      );

      // Generate education content - template uses \resumeSubheading{School}{Location}{Degree}{Dates}
      const educationContent = Array.isArray(input.education) && input.education.length > 0
        ? input.education.map((edu) => {
            const degreeText = `${escapeLatex(edu.degree)}${edu.field ? ` in ${escapeLatex(edu.field)}` : ''}`;
            const dates = edu.startDate ? `${escapeLatex(edu.startDate)} -- ${escapeLatex(edu.endDate)}` : escapeLatex(edu.endDate);
            const items = Array.isArray(edu.details) && edu.details.length
              ? `\n    \\resumeItemListStart\n${edu.details.map((detail) => `      \\resumeItem{${escapeLatex(detail)}}`).join('\n')}\n    \\resumeItemListEnd`
              : '';
            // Format: \resumeSubheading{Arg1}{Arg2}{Arg3}{Arg4} - all on same line or properly separated
            return `    \\resumeSubheading\n      {${escapeLatex(edu.name)}}{${escapeLatex(edu.location || '')}}\n      {${degreeText}}{${dates}}${items}`;
          }).join('\n')
        : '';
      
      // Replace education section - match from \section to \resumeSubHeadingListEnd
      latexTemplate = latexTemplate.replace(
        /\\section{Education}[\s\S]*?\\resumeSubHeadingListEnd/,
        `\\section{Education}\n  \\resumeSubHeadingListStart\n${educationContent || '    % No education entries'}\n  \\resumeSubHeadingListEnd`
      );

      // Generate experience content - template uses \resumeSubheading{Title}{Dates}{Company}{Location}
      const experienceContent = Array.isArray(input.experience) && input.experience.length > 0
        ? input.experience.map((exp) => {
            const items = Array.isArray(exp.details) && exp.details.length
              ? `\n    \\resumeItemListStart\n${exp.details.map((detail) => `      \\resumeItem{${escapeLatex(detail)}}`).join('\n')}\n    \\resumeItemListEnd`
              : '';
            // Note: jakeLatex_2.tex uses {Title}{Dates}{Company}{Location} format
            return `    \\resumeSubheading\n      {${escapeLatex(exp.title)}}{${escapeLatex(exp.date)}}\n      {${escapeLatex(exp.company)}}{${escapeLatex(exp.location || '')}}${items}`;
          }).join('\n')
        : '';
      
      // Replace experience section
      latexTemplate = latexTemplate.replace(
        /\\section{Experience}[\s\S]*?\\resumeSubHeadingListEnd/,
        `\\section{Experience}\n  \\resumeSubHeadingListStart\n${experienceContent || '    % No experience entries'}\n  \\resumeSubHeadingListEnd`
      );

      // Generate projects content - template uses \resumeProjectHeading{Project Name | Technologies}{Date}
      const projectsContent = Array.isArray(input.projects) && input.projects.length > 0
        ? input.projects.map((proj) => {
            const projectName = proj.technologies && proj.technologies.length
              ? `\\textbf{${escapeLatex(proj.name)}} $|$ \\emph{${escapeLatex(proj.technologies.join(', '))}}`
              : `\\textbf{${escapeLatex(proj.name)}}`;
            const items = Array.isArray(proj.details) && proj.details.length
              ? `\n    \\resumeItemListStart\n      \\resumeItem{${escapeLatex(proj.description)}}\n${proj.details.map((detail) => `      \\resumeItem{${escapeLatex(detail)}}`).join('\n')}\n    \\resumeItemListEnd`
              : `\n    \\resumeItemListStart\n      \\resumeItem{${escapeLatex(proj.description)}}\n    \\resumeItemListEnd`;
            return `    \\resumeProjectHeading\n      {${projectName}}{${escapeLatex(proj.date || '')}}${items}`;
          }).join('\n')
        : '';
      
      // Replace projects section
      latexTemplate = latexTemplate.replace(
        /\\section{Projects}[\s\S]*?\\resumeSubHeadingListEnd/,
        `\\section{Projects}\n    \\resumeSubHeadingListStart\n${projectsContent || '      % No projects'}\n    \\resumeSubHeadingListEnd`
      );

      // Generate skills content - template uses simple \textbf{Category}{: Skills} format
      const skillsParts = [];
      if (input.skills?.technical && input.skills.technical.length) {
        skillsParts.push(`        \\textbf{Languages}{: ${escapeLatex(input.skills.technical.join(', '))}} \\\\`);
      }
      if (input.skills?.additional && input.skills.additional.length) {
        skillsParts.push(`        \\textbf{Additional Skills}{: ${escapeLatex(input.skills.additional.join(', '))}}`);
      }
      const skillsContent = skillsParts.length > 0 ? skillsParts.join('\n') : '';
      
      // Replace skills section - template has a specific structure with \small{\item{...}}
      const skillsSectionContent = skillsContent || '        % No skills listed';
      latexTemplate = latexTemplate.replace(
        /\\section{Technical Skills}[\s\S]*?\\end{itemize}/,
        `\\section{Technical Skills}\n \\begin{itemize}[leftmargin=0.15in, label={}]\n    \\small{\\item{\n${skillsSectionContent}\n    }}\n \\end{itemize}`
      );

      // Note: jakeLatex_2.tex template doesn't have an "Additional Information" section
      // If needed, it would need to be added to the template first

      /// SECTION PDF GENERATION
    
      // Create temporary directory and file
      // Use os.tmpdir() for serverless compatibility (returns /tmp in serverless environments)
      const tempDir = path.join(os.tmpdir(), 'jobkompass-resume');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      const uniqueId = Date.now().toString(36) + Math.random().toString(36).slice(2);
      const tempFile = path.join(tempDir, `resume-${uniqueId}.tex`);
      fs.writeFileSync(tempFile, latexTemplate);

      // Compile LaTeX to PDF - capture log for debugging
      // Note: pdflatex may exit with non-zero even if PDF is generated (warnings, etc.)
      const pdfPath = path.join(tempDir, `resume-${uniqueId}.pdf`);
      const logPath = path.join(tempDir, `resume-${uniqueId}.log`);
      
      try {
          await execAsync(`pdflatex -interaction=nonstopmode -output-directory ${tempDir} ${tempFile}`);
          await execAsync(`pdflatex -interaction=nonstopmode -output-directory ${tempDir} ${tempFile}`);
      } catch (latexError: unknown) {
          // Even if pdflatex throws an error, check if PDF was generated
          // Sometimes compilation succeeds but returns non-zero exit code
          if (fs.existsSync(pdfPath)) {
              // PDF was generated successfully, continue
          } else {
              // PDF doesn't exist, so compilation actually failed
              const errorMessage = latexError instanceof Error ? latexError.message : String(latexError);
              return {
                  success: false,
                  error: `LaTeX compilation failed: ${errorMessage}`,
                  message: 'LaTeX compilation failed. The PDF could not be generated.'
              };
          }
      }

      // Verify PDF exists before trying to read it
      if (!fs.existsSync(pdfPath)) {
          return {
              success: false,
              error: 'PDF file was not generated after LaTeX compilation',
              message: 'LaTeX compilation completed but PDF file is missing.',
              debugTexPath: tempFile,
              logPath: logPath
          };
      }

      // Read the generated PDF
      const pdfBuffer = fs.readFileSync(pdfPath);
      const pdfBase64 = pdfBuffer.toString('base64');

      // Clean up temp files (but keep .tex and .log for debugging if there was an error)
      ['aux', 'out'].forEach(ext => {
          const file = path.join(tempDir, `resume-${uniqueId}.${ext}`);
          if (fs.existsSync(file)) fs.unlinkSync(file);
      });  

      /// SECTION AUTO-SAVE TO CONVEX
      
      try {
        // Get upload URL from Convex
        const uploadUrl = await convexClient.mutation(api.documents.generateUploadUrl);
        
        // Convert Buffer to Blob for upload
        const pdfBlob = new Blob([new Uint8Array(pdfBuffer)], { type: 'application/pdf' });
        
        // Upload PDF to Convex storage
        const uploadResponse = await fetch(uploadUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/pdf' },
          body: pdfBlob,
        });
        
        if (uploadResponse.ok) {
          const { storageId } = await uploadResponse.json();
          
          // Save resume to database
          const now = new Date();
          const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }); // e.g. "Jun 10, 24"
          
          // Include company name in resume title if provided
          const companySuffix = input.targetCompany ? ` - ${input.targetCompany}` : '';
          const resumeName = `${input.personalInfo.firstName} ${input.personalInfo.lastName} Resume${companySuffix} (${formattedTime})`;
          
          await convexClient.mutation(api.documents.saveGeneratedResumeWithFile, {
            name: resumeName,
            fileId: storageId,
            fileName: `resume-${input.personalInfo.firstName}-${input.personalInfo.lastName}-${formattedTime}.pdf`,
            fileSize: pdfBuffer.length,
            content: input,
            template: 'jake',
          });
        }
      } catch (saveError) {
        // Don't fail the whole operation if save fails, just log it
        console.error('Failed to auto-save resume:', saveError);
      }

      /// SECTION RETURN RESULT
      
      // Clean up temp folder before returning
      try {
        const tempDir = path.join(os.tmpdir(), 'jobkompass-resume');
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true, force: true });
        }
      } catch (cleanupError) {
        console.error('Error cleaning up temp folder:', cleanupError);
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
      console.error('Resume generation error:', error);
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

      /// SECTION PDF GENERATION
      
      // Use os.tmpdir() for serverless compatibility (returns /tmp in serverless environments)
      const tempDir = path.join(os.tmpdir(), 'jobkompass-coverletter');
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
      const uniqueId = Date.now().toString(36) + Math.random().toString(36).slice(2);
      const tempFile = path.join(tempDir, `coverletter-${uniqueId}.tex`);
      fs.writeFileSync(tempFile, latexTemplate);

      const pdfPath = path.join(tempDir, `coverletter-${uniqueId}.pdf`);
      const logPath = path.join(tempDir, `coverletter-${uniqueId}.log`);

      try {
        await execAsync(`pdflatex -interaction=nonstopmode -output-directory ${tempDir} ${tempFile}`);
        await execAsync(`pdflatex -interaction=nonstopmode -output-directory ${tempDir} ${tempFile}`);
      } catch (latexError: unknown) {
        if (!fs.existsSync(pdfPath)) {
          const errorMessage = latexError instanceof Error ? latexError.message : String(latexError);
          return {
            success: false,
            error: `LaTeX compilation failed: ${errorMessage}`,
            message: 'LaTeX compilation failed. The PDF could not be generated.'
          };
        }
      }

      if (!fs.existsSync(pdfPath)) {
        return {
          success: false,
          error: 'PDF file was not generated after LaTeX compilation',
          message: 'LaTeX compilation completed but PDF file is missing.',
          debugTexPath: tempFile,
          logPath: logPath
        };
      }

      const pdfBuffer = fs.readFileSync(pdfPath);
      const pdfBase64 = pdfBuffer.toString('base64');

      // Clean up temp files
      ['aux', 'out', 'log'].forEach(ext => {
        const file = path.join(tempDir, `coverletter-${uniqueId}.${ext}`);
        if (fs.existsSync(file)) fs.unlinkSync(file);
      });

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
        .enum(["Interested", "Applied", "Interviewing", "Offered", "Rejected"])
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
        .enum(["Interested", "Applied", "Interviewing", "Offered", "Rejected"])
        .default("Interested")
        .describe("Job status (Interested, Applied, Interviewing, Offered, Rejected). Defaults to 'Interested'."),
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
            message: `You've reached your job tracking limit of ${canAdd.limit} jobs. Please upgrade to Pro plan for unlimited job tracking.`,
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