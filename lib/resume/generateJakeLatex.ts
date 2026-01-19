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

export interface Language {
    language: string;
    proficiency: string;
}

// Type definition for the resume content
export interface ResumeContentForJake {
    personalInfo: {
        name?: string; // Optional - fallback if firstName/lastName not provided
        firstName?: string;
        lastName?: string;
        citizenship?: string | null;
        email: string;
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
        details?: string[] | null;
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
        references?: string | null;
    } | null;
}

/**
 * Generates LaTeX content for Jake's resume template from resume content object
 * Uses the same proven approach as the AI tool (regex section replacement)
 */
export function generateJakeLatex(content: ResumeContentForJake): string {
    const templatePath = path.join(process.cwd(), 'templates/resume/jakeLatex.tex');
    if (!fs.existsSync(templatePath)) {
        throw new Error(`LaTeX template not found at ${templatePath}`);
    }

    let latexTemplate = fs.readFileSync(templatePath, 'utf-8');

    // Get firstName and lastName - support both formats
    let firstName = content.personalInfo.firstName || '';
    let lastName = content.personalInfo.lastName || '';
    
    // Fallback to splitting name if firstName/lastName not provided
    if (!firstName && !lastName && content.personalInfo.name) {
        const nameParts = content.personalInfo.name.split(' ');
        firstName = nameParts[0] || '';
        lastName = nameParts.slice(1).join(' ') || '';
    }

    // Build header content
    const fullName = `${escapeLatex(firstName)} ${escapeLatex(lastName)}`;
    const contactParts = [];
    
    // Add citizenship if provided
    if (content.personalInfo.citizenship) {
        contactParts.push(`\\underline{${escapeLatex(content.personalInfo.citizenship)}}`);
    }

    contactParts.push(`\\href{mailto:${escapeLatex(content.personalInfo.email)}}{\\underline{${escapeLatex(content.personalInfo.email)}}}`);
    
    if (content.personalInfo.linkedin) {
        const linkedinHandle = content.personalInfo.linkedin.replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//, '').replace(/\/$/, '');
        contactParts.push(`\\href{https://linkedin.com/in/${escapeLatex(linkedinHandle)}}{\\underline{linkedin.com/in/${escapeLatex(linkedinHandle)}}}`);
    }
    
    if (content.personalInfo.github) {
        const githubHandle = content.personalInfo.github.replace(/^https?:\/\/(www\.)?github\.com\//, '').replace(/\/$/, '');
        contactParts.push(`\\href{https://github.com/${escapeLatex(githubHandle)}}{\\underline{github.com/${escapeLatex(githubHandle)}}}`);
    }
    
    const headerContent = `\\begin{center}\n    \\textbf{\\Huge \\scshape ${fullName}} \\\\ \\vspace{1pt}\n    \\small ${contactParts.join(' $|$ ')}\n\\end{center}`;
    
    // Replace the header block in template
    latexTemplate = latexTemplate.replace(
        /\\begin{center}[\s\S]*?\\end{center}/,
        headerContent
    );

    // Generate education content
    const educationContent = Array.isArray(content.education) && content.education.length > 0
        ? content.education.map((edu) => {
            const degreeText = `${escapeLatex(edu.degree)}${edu.field ? ` in ${escapeLatex(edu.field)}` : ''}`;
            const dates = edu.startDate ? `${escapeLatex(edu.startDate)} -- ${escapeLatex(edu.endDate)}` : escapeLatex(edu.endDate);
            const items = Array.isArray(edu.details) && edu.details.length
                ? `\n    \\resumeItemListStart\n${edu.details.map((detail) => `      \\resumeItem{${escapeLatex(detail)}}`).join('\n')}\n    \\resumeItemListEnd`
                : '';
            return `    \\resumeSubheading\n      {${escapeLatex(edu.name)}}{${escapeLatex(edu.location || '')}}\n      {${degreeText}}{${dates}}${items}`;
        }).join('\n')
        : '';
    
    // Replace education section
    latexTemplate = latexTemplate.replace(
        /\\section{Education}[\s\S]*?\\resumeSubHeadingListEnd/,
        `\\section{Education}\n  \\resumeSubHeadingListStart\n${educationContent || '    % No education entries'}\n  \\resumeSubHeadingListEnd`
    );

    // Generate experience content
    const experienceContent = Array.isArray(content.experience) && content.experience.length > 0
        ? content.experience.map((exp) => {
            const items = Array.isArray(exp.details) && exp.details.length
                ? `\n    \\resumeItemListStart\n${exp.details.map((detail) => `      \\resumeItem{${escapeLatex(detail)}}`).join('\n')}\n    \\resumeItemListEnd`
                : '';
            return `    \\resumeSubheading\n      {${escapeLatex(exp.title)}}{${escapeLatex(exp.date)}}\n      {${escapeLatex(exp.company)}}{${escapeLatex(exp.location || '')}}${items}`;
        }).join('\n')
        : '';
    
    // Replace experience section
    latexTemplate = latexTemplate.replace(
        /\\section{Experience}[\s\S]*?\\resumeSubHeadingListEnd/,
        `\\section{Experience}\n  \\resumeSubHeadingListStart\n${experienceContent || '    % No experience entries'}\n  \\resumeSubHeadingListEnd`
    );

    // Generate projects content
    const projectsContent = Array.isArray(content.projects) && content.projects.length > 0
        ? content.projects.map((proj) => {
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

    // Generate skills content
    const skillsParts = [];
    if (content.skills?.technical && content.skills.technical.length) {
        skillsParts.push(`        \\textbf{Languages}{: ${escapeLatex(content.skills.technical.join(', '))}} \\\\`);
    }
    if (content.skills?.additional && content.skills.additional.length) {
        skillsParts.push(`        \\textbf{Additional Skills}{: ${escapeLatex(content.skills.additional.join(', '))}}`);
    }
    const skillsContent = skillsParts.length > 0 ? skillsParts.join('\n') : '';
    
    // Replace skills section
    const skillsSectionContent = skillsContent || '        % No skills listed';
    latexTemplate = latexTemplate.replace(
        /\\section{Technical Skills}[\s\S]*?\\end{itemize}/,
        `\\section{Technical Skills}\n \\begin{itemize}[leftmargin=0.15in, label={}]\n    \\small{\\item{\n${skillsSectionContent}\n    }}\n \\end{itemize}`
    );

    return latexTemplate;
}
