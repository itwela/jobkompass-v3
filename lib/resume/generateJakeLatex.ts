import fs from 'fs';
import path from 'path';

// Helper function to escape LaTeX special characters
function escapeLatex(text: string | null | undefined): string {
    if (!text) return '';
    return text
        .replace(/\\/g, '\\textbackslash{}')
        .replace(/&/g, '\\&')
        .replace(/%/g, '\\%')
        .replace(/\$/g, '\\$')
        .replace(/#/g, '\\#')
        .replace(/_/g, '\\_')
        .replace(/\{/g, '\\{')
        .replace(/\}/g, '\\}')
        .replace(/~/g, '\\textasciitilde{}')
        .replace(/\^/g, '\\textasciicircum{}');
}

// Helper function to format URLs
function formatUrl(url: string | null | undefined): string {
    if (!url) return '';
    return url.startsWith('http') ? url : `https://${url}`;
}

export interface Language {
    language: string;
    proficiency: string;
}

// Type definition for the resume content
export interface ResumeContentForJake {
    personalInfo: {
        name: string;
        firstName?: string;
        lastName?: string;
        citizenship: string;
        email: string;
        phone?: string | null;
        location?: string | null;
        linkedin?: string | null;
        github?: string | null;
        portfolio?: string | null;
    };
    experience?: Array<{
        company: string;
        title: string;
        location?: string | null;
        date: string;
        details: string[];
    }> | null;
    education?: Array<{
        name: string;
        degree: string;
        field?: string | null;
        location?: string | null;
        startDate?: string | null;
        endDate: string;
        details?: string[] | null;
    }> | null;
    projects?: Array<{
        name: string;
        description: string;
        date?: string | null;
        technologies?: string[] | null;
        details?: string[] | null;
    }> | null;
    skills?: {
        technical?: string[] | null;
        additional?: string[] | null;
    } | null;
    additionalInfo?: {
        interests?: string[] | null;
        hobbies?: string[] | null;
        languages?: Language[] | null;
        references?: string[] | null;
    } | null;
}

/**
 * Generates LaTeX content for Jake's resume template from resume content object
 */
export function generateJakeLatex(content: ResumeContentForJake): string {
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

    // Generate header content
    const nameParts = content.personalInfo.name.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    const headerContent = `\\begin{center}
    \\textbf{\\Huge \\scshape ${escapeLatex(firstName)} ${escapeLatex(lastName)}} \\\\ \\vspace{1pt}
    \\small \\href{mailto:${escapeLatex(content.personalInfo.email)}}{\\underline{${escapeLatex(content.personalInfo.email)}}} $|$
    ${content.personalInfo.citizenship ? `${escapeLatex(content.personalInfo.citizenship)} $|$` : ''}
    ${content.personalInfo.phone ? `${escapeLatex(content.personalInfo.phone)} $|$` : ''}
    ${content.personalInfo.location ? `${escapeLatex(content.personalInfo.location)} $|$` : ''}
    ${content.personalInfo.linkedin ? `\\href{${escapeLatex(formatUrl(content.personalInfo.linkedin))}}{\\underline{${escapeLatex(content.personalInfo.linkedin.replace(/^https?:\/\//, ''))}}} $|$` : ''}
    ${content.personalInfo.github ? `\\href{${escapeLatex(formatUrl(content.personalInfo.github))}}{\\underline{${escapeLatex(content.personalInfo.github.replace(/^https?:\/\//, ''))}}} $|$` : ''}
    ${content.personalInfo.portfolio ? `\\href{${escapeLatex(formatUrl(content.personalInfo.portfolio))}}{\\underline{${escapeLatex(content.personalInfo.portfolio.replace(/^https?:\/\//, ''))}}}` : ''}
  \\end{center}`;

    // Generate education content
    const educationContent = Array.isArray(content.education) && content.education.length > 0
        ? `\\resumeSubHeadingListStart
             ${content.education.map((edu) => `
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
    const experienceContent = Array.isArray(content.experience) && content.experience.length > 0
        ? `\\resumeSubHeadingListStart
             ${content.experience.map((exp) => `
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
    const projectsContent = Array.isArray(content.projects) && content.projects.length > 0
        ? `\\resumeSubHeadingListStart
       ${content.projects.map((proj) => `
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
    const skillsContent = content.skills && (Array.isArray(content.skills.technical) || Array.isArray(content.skills.additional))
        ? `${Array.isArray(content.skills.technical) && content.skills.technical.length
            ? `\\resumeFlexContent{Technical:}{${content.skills.technical.map(escapeLatex).join(', ')}}`
            : ''}
          ${Array.isArray(content.skills.additional) && content.skills.additional.length
            ? `\\resumeFlexContent{Additional:}{${content.skills.additional.map(escapeLatex).join(', ')}}`
            : ''}`
        : '';

    // Generate additional info content
    const additionalInfoContent = content.additionalInfo && (Array.isArray(content.additionalInfo.interests) || Array.isArray(content.additionalInfo.hobbies) || Array.isArray(content.additionalInfo.languages) || Array.isArray(content.additionalInfo.references))
        ? `${Array.isArray(content.additionalInfo.interests) && content.additionalInfo.interests.length
            ? `\\resumeFlexContent{Interests:}{${content.additionalInfo.interests.map(escapeLatex).join(', ')}}`
            : ''}
          ${Array.isArray(content.additionalInfo.hobbies) && content.additionalInfo.hobbies.length
            ? `\\resumeFlexContent{Hobbies:}{${content.additionalInfo.hobbies.map(escapeLatex).join(', ')}}`
            : ''}
          ${Array.isArray(content.additionalInfo.languages) && content.additionalInfo.languages.length
            ? `\\resumeFlexContent{Languages:}{${content.additionalInfo.languages.map((lang) => `${escapeLatex(lang.language)} (${escapeLatex(lang.proficiency)})`).join(', ')}}`
            : ''}
          ${Array.isArray(content.additionalInfo.references) && content.additionalInfo.references.length
            ? `\\resumeFlexContent{References:}{${content.additionalInfo.references.map(escapeLatex).join(', ')}}`
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

    return latexTemplate;
}

