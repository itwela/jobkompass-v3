import fs from 'fs';
import path from 'path';
import { escapeLatex } from './types';

export type { Language, ResumeContent } from './types';

/** @deprecated Use ResumeContent from types - kept for backward compatibility */
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
        // Extract handle from URL - handle both full URLs and partial URLs
        let linkedinHandle = content.personalInfo.linkedin
            .replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//, '') // Remove full URL
            .replace(/^linkedin\.com\/in\//, '') // Remove partial URL
            .replace(/\/$/, ''); // Remove trailing slash
        contactParts.push(`\\href{https://linkedin.com/in/${escapeLatex(linkedinHandle)}}{\\underline{linkedin.com/in/${escapeLatex(linkedinHandle)}}}`);
    }
    
    if (content.personalInfo.github) {
        // Extract handle from URL - handle both full URLs and partial URLs
        let githubHandle = content.personalInfo.github
            .replace(/^https?:\/\/(www\.)?github\.com\//, '') // Remove full URL
            .replace(/^github\.com\//, '') // Remove partial URL
            .replace(/\/$/, ''); // Remove trailing slash
        contactParts.push(`\\href{https://github.com/${escapeLatex(githubHandle)}}{\\underline{github.com/${escapeLatex(githubHandle)}}}`);
    }
    
    const headerContent = `\\begin{center}\n    \\textbf{\\Huge \\scshape ${fullName}} \\\\ \\vspace{1pt}\n    \\small ${contactParts.join(' $|$ ')}\n\\end{center}`;
    
    // Replace the header block in template
    latexTemplate = latexTemplate.replace(
        /\\begin{center}[\s\S]*?\\end{center}/,
        headerContent
    );

    // Generate education content - filter empty bullets
    const educationContent = Array.isArray(content.education) && content.education.length > 0
        ? content.education.map((edu) => {
            const degreeText = `${escapeLatex(edu.degree)}${edu.field ? ` in ${escapeLatex(edu.field)}` : ''}`;
            const dates = edu.startDate ? `${escapeLatex(edu.startDate)} -- ${escapeLatex(edu.endDate)}` : escapeLatex(edu.endDate);
            const validDetails = (Array.isArray(edu.details) ? edu.details : [])
                .filter((d) => typeof d === 'string' && d.trim().length > 0);
            const items = validDetails.length
                ? `\n    \\resumeItemListStart\n${validDetails.map((detail) => `      \\resumeItem{${escapeLatex(detail)}}`).join('\n')}\n    \\resumeItemListEnd`
                : '';
            return `    \\resumeSubheading\n      {${escapeLatex(edu.name)}}{${escapeLatex(edu.location || '')}}\n      {${degreeText}}{${dates}}${items}`;
        }).join('\n')
        : '';
    
    // Replace education section
    latexTemplate = latexTemplate.replace(
        /\\section{Education}[\s\S]*?\\resumeSubHeadingListEnd/,
        `\\section{Education}\n  \\resumeSubHeadingListStart\n${educationContent || '    % No education entries'}\n  \\resumeSubHeadingListEnd`
    );

    // Generate experience content - filter empty bullets
    const experienceContent = Array.isArray(content.experience) && content.experience.length > 0
        ? content.experience.map((exp) => {
            const validDetails = (Array.isArray(exp.details) ? exp.details : [])
                .filter((d) => typeof d === 'string' && d.trim().length > 0);
            const items = validDetails.length
                ? `\n    \\resumeItemListStart\n${validDetails.map((detail) => `      \\resumeItem{${escapeLatex(detail)}}`).join('\n')}\n    \\resumeItemListEnd`
                : '';
            return `    \\resumeSubheading\n      {${escapeLatex(exp.title)}}{${escapeLatex(exp.date)}}\n      {${escapeLatex(exp.company)}}{${escapeLatex(exp.location || '')}}${items}`;
        }).join('\n')
        : '';
    
    // Replace experience section
    latexTemplate = latexTemplate.replace(
        /\\section{Experience}[\s\S]*?\\resumeSubHeadingListEnd/,
        `\\section{Experience}\n  \\resumeSubHeadingListStart\n${experienceContent || '    % No experience entries'}\n  \\resumeSubHeadingListEnd`
    );

    // Generate projects content - only include non-empty bullets, skip projects with no content
    const projectsContent = Array.isArray(content.projects) && content.projects.length > 0
        ? content.projects
            .map((proj) => {
                const projectName = proj.technologies && proj.technologies.length
                    ? `\\textbf{${escapeLatex(proj.name)}} $|$ \\emph{${escapeLatex(proj.technologies.join(', '))}}`
                    : `\\textbf{${escapeLatex(proj.name)}}`;
                const desc = (proj.description || '').trim();
                const detailList = (Array.isArray(proj.details) ? proj.details : [])
                    .filter((d) => typeof d === 'string' && d.trim().length > 0);
                const allBullets = desc ? [desc, ...detailList] : detailList;
                if (allBullets.length === 0) return null;
                const items = `\n    \\resumeItemListStart\n${allBullets.map((b) => `      \\resumeItem{${escapeLatex(b)}}`).join('\n')}\n    \\resumeItemListEnd`;
                return `    \\resumeProjectHeading\n      {${projectName}}{${escapeLatex(proj.date || '')}}${items}`;
            })
            .filter(Boolean)
            .join('\n')
        : '';
    
    // Replace projects section - omit entirely if no projects
    latexTemplate = latexTemplate.replace(
        /\\section{Projects}[\s\S]*?\\resumeSubHeadingListEnd/,
        projectsContent
            ? `\\section{Projects}\n    \\resumeSubHeadingListStart\n${projectsContent}\n    \\resumeSubHeadingListEnd`
            : ''
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
