import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { addResumeToDb } from '@/app/actions/databaseActions';

const execAsync = promisify(exec);

function escapeLatex(str: string | null | undefined) {
  if (!str) return '';
  return str.replace(/([\\{}&$%#_^])/g, '\\$1');
}

export async function POST(req: Request) {
  try {

    const { data, user } = await req.json();
    
    const templatePath = path.join(process.cwd(), 'app/ai/prompts/resume/jakeLatex.tex');
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

    // Generate header content dynamically
    const headerContent = data.personalInfo
      ? `\\begin{center}
  \\textbf{\\Huge \\scshape ${escapeLatex(data.personalInfo.firstName)} ${escapeLatex(data.personalInfo.lastName)}} \\\\ \\vspace{1pt}
  \\small \\href{mailto:${escapeLatex(data.personalInfo.email || '')}}{\\underline{${escapeLatex(data.personalInfo.email || '')}}} $|$
  ${data.personalInfo.socials?.[0]?.url ? `\\href{${escapeLatex(data.personalInfo.socials[0].url)}}{\\underline{${escapeLatex(data.personalInfo.socials[0].url.replace('https://', ''))}}} $|$` : ''}
  ${data.personalInfo.socials?.[1]?.url ? `\\href{${escapeLatex(data.personalInfo.socials[1].url)}}{\\underline{${escapeLatex(data.personalInfo.socials[1].url.replace('https://', ''))}}}` : ''}
\\end{center}`
      : '';

    // Generate education content dynamically
    const educationContent = Array.isArray(data.education) && data.education.length > 0
      ? `\\resumeSubHeadingListStart
         ${data.education.map((edu: any) => `
           \\resumeSubheading
             {${escapeLatex(edu.name || '')}}{${escapeLatex(edu.location || '')}}
             {${escapeLatex(edu.degree || '')} ${edu.field ? `in ${escapeLatex(edu.field)}` : ''}}{${edu.startDate ? `${escapeLatex(edu.startDate)} -- ${escapeLatex(edu.endDate || '')}` : `Estimated Graduation: ${escapeLatex(edu.endDate || '')}`}}
             ${Array.isArray(edu.details) && edu.details.length ? `\\resumeItemListStart
               ${edu.details.map((detail: any) => `\\resumeItem{${escapeLatex(detail)}}`).join('\n          ')}
             \\resumeItemListEnd` : ''}
         `).join('\n')}
         \\resumeSubHeadingListEnd`
      : '';

    // Generate experience content dynamically
    const experienceContent = Array.isArray(data.experience) && data.experience.length > 0
      ? `\\resumeSubHeadingListStart
         ${data.experience.map((exp: any) => `
           \\resumeSubheading
             {${escapeLatex(exp.company || '')}}{${escapeLatex(exp.location || '')}}
             {${escapeLatex(exp.title || '')}}{${escapeLatex(exp.date || '')}}
             ${Array.isArray(exp.details) && exp.details.length ? `\\resumeItemListStart
               ${exp.details.map((detail: any) => `\\resumeItem{${escapeLatex(detail)}}`).join('\n          ')}
             \\resumeItemListEnd` : ''}
         `).join('\n')}
         \\resumeSubHeadingListEnd`
      : '';

// Generate projects content dynamically, with wrapped content to prevent overflow
const projectsContent = Array.isArray(data.projects) && data.projects.length > 0
? `\\resumeSubHeadingListStart
   ${data.projects.map((proj: any) => `
     % Project title and date
     \\resumeProjectHeader
       {${escapeLatex(proj.name || '')}}{${escapeLatex(proj.date || '')}}
     
     % Project details in a separate block with proper wrapping
     \\resumeProjectDetails{${escapeLatex(proj.description || '')}}
     ${Array.isArray(proj.technologies) && proj.technologies.length 
       ? `\\resumeItem{Technologies Used: ${proj.technologies.map(escapeLatex).join(', ')}}` 
       : ''}
     ${Array.isArray(proj.details) && proj.details.length 
       ? `\\resumeItemListStart
         ${proj.details.map((detail: any) => `\\resumeItem{${escapeLatex(detail)}}`).join('\n          ')}
       \\resumeItemListEnd` 
       : ''}
   `).join('\n')}
   \\resumeSubHeadingListEnd`
: '';

    // Generate skills content dynamically, with technical and additional skills in a row
    const skillsContent = data.skills && (Array.isArray(data.skills.technical) || Array.isArray(data.skills.additional))
    ? `${Array.isArray(data.skills.technical) && data.skills.technical.length 
        ? `\\resumeFlexContent{Technical:}{${data.skills.technical.map(escapeLatex).join(', ')}}` 
        : ''}
      ${Array.isArray(data.skills.additional) && data.skills.additional.length 
        ? `\\resumeFlexContent{Additional:}{${data.skills.additional.map(escapeLatex).join(', ')}}` 
        : ''}`
    : '';

    // Generate additional info content dynamically
    const additionalInfoContent = data.additionalInfo && (Array.isArray(data.additionalInfo.interests) || Array.isArray(data.additionalInfo.hobbies) || Array.isArray(data.additionalInfo.languages) || Array.isArray(data.additionalInfo.references))
    ? `${Array.isArray(data.additionalInfo.interests) && data.additionalInfo.interests.length 
        ? `\\resumeFlexContent{Interests:}{${data.additionalInfo.interests.map(escapeLatex).join(', ')}}` 
        : ''}
      ${Array.isArray(data.additionalInfo.hobbies) && data.additionalInfo.hobbies.length 
        ? `\\resumeFlexContent{Hobbies:}{${data.additionalInfo.hobbies.map(escapeLatex).join(', ')}}` 
        : ''}
      ${Array.isArray(data.additionalInfo.languages) && data.additionalInfo.languages.length 
        ? `\\resumeFlexContent{Languages:}{${data.additionalInfo.languages.map(escapeLatex).join(', ')}}` 
        : ''}
      ${Array.isArray(data.additionalInfo.references) && data.additionalInfo.references.length 
        ? `\\resumeFlexContent{References:}{${data.additionalInfo.references.map(escapeLatex).join(', ')}}` 
        : ''}`
    : '';

    // Replace placeholders with formatted content, ensuring empty strings for missing sections
    latexTemplate = latexTemplate
      .replace('% HEADER_PLACEHOLDER', headerContent || '')
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
      latexTemplate = latexTemplate.replace(/\\section{Additional Information}[\s\S]*?(?=\\section|\\end{document})/g, '');
    }

    // Ensure proper document structure
    latexTemplate = latexTemplate.replace('\\begin{document}', '\\setlength{\\parskip}{0pt}\n\\begin{document}');
    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
    const uniqueId = Date.now().toString(36) + Math.random().toString(36).slice(2);
    const tempFile = path.join(tempDir, `resume-${uniqueId}.tex`);
    fs.writeFileSync(tempFile, latexTemplate);

    // Run pdflatex with error logging for debugging
    try {
      await execAsync(`pdflatex -interaction=nonstopmode -output-directory ${tempDir} ${tempFile}`);
      await execAsync(`pdflatex -interaction=nonstopmode -output-directory ${tempDir} ${tempFile}`);
    } catch (latexError: unknown) {
      console.error('LaTeX compilation error:', latexError);
      const errorMessage = latexError instanceof Error ? latexError.message : String(latexError);
      throw new Error(`LaTeX compilation failed: ${errorMessage}`);
    }

    const pdfBuffer = fs.readFileSync(path.join(tempDir, `resume-${uniqueId}.pdf`));
    const texContent = fs.readFileSync(tempFile, 'utf-8');

// SECTION   ------------------------------------------- ADD RESUME TO DB --- I WILL PAYWALL THIS EVENTUALLY

    // Create a FormData-like object for the PDF
    const resumeData = new FormData();
    const pdfBlob = new Blob([pdfBuffer], { type: 'application/pdf' });
    const fileName = `resume-${Date.now()}.pdf`;
    const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
    resumeData.append('resume', file);
    resumeData.append('fileInfo', JSON.stringify({ name: fileName }));

    // Save to database
    const saveResult = await addResumeToDb(resumeData, user);
    if (saveResult.status === 'error') {
      console.error('Failed to save resume to database:', saveResult.message);
      // Continue with response even if save fails
    }

// SECTION   ------------------------------------------- CLEAN UP TEMP FILES

    // Clean up temp files except tex
    ['aux', 'log', 'out'].forEach(ext => {
      const file = path.join(tempDir, `resume-${uniqueId}.${ext}`);
      if (fs.existsSync(file)) fs.unlinkSync(file);
    });

    // Create response with both PDF and TEX content
    const response = new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="resume.pdf"',
        'Cache-Control': 'no-cache',
        'X-Tex-Content': Buffer.from(texContent).toString('base64'),
      },
      status: 200,
    });

    return response;
  } catch (error) {
    console.error('PDF generation error:', error);
    return NextResponse.json(
      { error: 'PDF generation failed', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}