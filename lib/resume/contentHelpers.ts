/**
 * Helper functions for parsing and formatting resume content
 */

export type ResumeContent = {
    personalInfo: {
        name: string;
        email: string;
        phone?: string;
        location?: string;
        linkedin?: string;
        github?: string;
        portfolio?: string;
        summary?: string;
    };
    experience: Array<{
        company: string;
        position: string;
        startDate: string;
        endDate?: string;
        description: string;
        achievements?: string[];
        technologies?: string[];
        location?: string;
    }>;
    education: Array<{
        school: string;
        degree: string;
        graduationDate: string;
        gpa?: string;
        relevantCoursework?: string[];
        location?: string;
    }>;
    skills: string[];
    certifications?: Array<{
        name: string;
        issuer: string;
        dateObtained: string;
        expiryDate?: string;
        credentialId?: string;
    }>;
    projects?: Array<{
        name: string;
        description: string;
        technologies: string[];
        githubUrl?: string;
        liveUrl?: string;
        startDate?: string;
        endDate?: string;
    }>;
    languages?: Array<{
        language: string;
        proficiency: string;
    }>;
    volunteerWork?: Array<{
        organization: string;
        role: string;
        startDate: string;
        endDate?: string;
        description: string;
    }>;
};

/**
 * Creates an empty resume content object with default values
 */
export function createEmptyResumeContent(): ResumeContent {
    return {
        personalInfo: {
            name: "",
            email: "",
            phone: "",
            location: "",
            linkedin: "",
            github: "",
            portfolio: "",
            summary: "",
        },
        experience: [],
        education: [],
        skills: [],
        certifications: [],
        projects: [],
        languages: [],
        volunteerWork: [],
    };
}

/**
 * Validates that required fields in resume content are present
 */
export function validateResumeContent(content: Partial<ResumeContent>): {
    isValid: boolean;
    errors: string[];
} {
    const errors: string[] = [];

    if (!content.personalInfo?.name) {
        errors.push("Personal Info: Name is required");
    }
    if (!content.personalInfo?.email) {
        errors.push("Personal Info: Email is required");
    }
    if (!content.experience || content.experience.length === 0) {
        errors.push("At least one work experience entry is required");
    }
    if (!content.education || content.education.length === 0) {
        errors.push("At least one education entry is required");
    }
    if (!content.skills || content.skills.length === 0) {
        errors.push("At least one skill is required");
    }

    return {
        isValid: errors.length === 0,
        errors,
    };
}

/**
 * Parses a plain text resume into structured content
 * This is a basic parser - you may want to enhance it with AI/LLM parsing
 */
export function parseTextToResumeContent(text: string): Partial<ResumeContent> {
    const content: Partial<ResumeContent> = {
        personalInfo: {
            name: "",
            email: "",
        },
        experience: [],
        education: [],
        skills: [],
    };

    // Basic email extraction
    const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w+/);
    if (emailMatch) {
        content.personalInfo!.email = emailMatch[0];
    }

    // Basic phone extraction
    const phoneMatch = text.match(/(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
    if (phoneMatch) {
        content.personalInfo!.phone = phoneMatch[0];
    }

    return content;
}

/**
 * Formats resume content as a readable plain text string
 */
export function formatResumeContentAsText(content: ResumeContent): string {
    let text = "";

    // Personal Info
    text += `${content.personalInfo.name}\n`;
    text += `${content.personalInfo.email}`;
    if (content.personalInfo.phone) {
        text += ` | ${content.personalInfo.phone}`;
    }
    if (content.personalInfo.location) {
        text += ` | ${content.personalInfo.location}`;
    }
    text += "\n";
    if (content.personalInfo.linkedin) {
        text += `LinkedIn: ${content.personalInfo.linkedin}\n`;
    }
    if (content.personalInfo.github) {
        text += `GitHub: ${content.personalInfo.github}\n`;
    }
    if (content.personalInfo.portfolio) {
        text += `Portfolio: ${content.personalInfo.portfolio}\n`;
    }
    text += "\n";

    // Summary
    if (content.personalInfo.summary) {
        text += `PROFESSIONAL SUMMARY\n`;
        text += `${content.personalInfo.summary}\n\n`;
    }

    // Experience
    if (content.experience.length > 0) {
        text += `WORK EXPERIENCE\n`;
        content.experience.forEach((exp) => {
            text += `\n${exp.position} at ${exp.company}\n`;
            text += `${exp.startDate} - ${exp.endDate || "Present"}`;
            if (exp.location) {
                text += ` | ${exp.location}`;
            }
            text += `\n${exp.description}\n`;
            if (exp.achievements && exp.achievements.length > 0) {
                exp.achievements.forEach((achievement) => {
                    text += `• ${achievement}\n`;
                });
            }
            if (exp.technologies && exp.technologies.length > 0) {
                text += `Technologies: ${exp.technologies.join(", ")}\n`;
            }
        });
        text += "\n";
    }

    // Education
    if (content.education.length > 0) {
        text += `EDUCATION\n`;
        content.education.forEach((edu) => {
            text += `\n${edu.degree}\n`;
            text += `${edu.school}`;
            if (edu.location) {
                text += ` | ${edu.location}`;
            }
            text += `\nGraduated: ${edu.graduationDate}`;
            if (edu.gpa) {
                text += ` | GPA: ${edu.gpa}`;
            }
            text += "\n";
            if (edu.relevantCoursework && edu.relevantCoursework.length > 0) {
                text += `Relevant Coursework: ${edu.relevantCoursework.join(", ")}\n`;
            }
        });
        text += "\n";
    }

    // Skills
    if (content.skills.length > 0) {
        text += `SKILLS\n`;
        text += `${content.skills.join(", ")}\n\n`;
    }

    // Projects
    if (content.projects && content.projects.length > 0) {
        text += `PROJECTS\n`;
        content.projects.forEach((proj) => {
            text += `\n${proj.name}\n`;
            text += `${proj.description}\n`;
            text += `Technologies: ${proj.technologies.join(", ")}\n`;
            if (proj.githubUrl) {
                text += `GitHub: ${proj.githubUrl}\n`;
            }
            if (proj.liveUrl) {
                text += `Live: ${proj.liveUrl}\n`;
            }
        });
        text += "\n";
    }

    // Certifications
    if (content.certifications && content.certifications.length > 0) {
        text += `CERTIFICATIONS\n`;
        content.certifications.forEach((cert) => {
            text += `\n${cert.name}\n`;
            text += `${cert.issuer} | ${cert.dateObtained}\n`;
            if (cert.credentialId) {
                text += `Credential ID: ${cert.credentialId}\n`;
            }
        });
        text += "\n";
    }

    // Languages
    if (content.languages && content.languages.length > 0) {
        text += `LANGUAGES\n`;
        content.languages.forEach((lang) => {
            text += `${lang.language}: ${lang.proficiency}\n`;
        });
        text += "\n";
    }

    // Volunteer Work
    if (content.volunteerWork && content.volunteerWork.length > 0) {
        text += `VOLUNTEER WORK\n`;
        content.volunteerWork.forEach((vol) => {
            text += `\n${vol.role} at ${vol.organization}\n`;
            text += `${vol.startDate} - ${vol.endDate || "Present"}\n`;
            text += `${vol.description}\n`;
        });
    }

    return text;
}

/**
 * Formats resume content as JSON string for easy copying/pasting
 */
export function formatResumeContentAsJSON(content: ResumeContent, pretty: boolean = true): string {
    return JSON.stringify(content, null, pretty ? 2 : 0);
}

/**
 * Parses JSON string into resume content
 */
export function parseJSONToResumeContent(json: string): ResumeContent {
    try {
        const parsed = JSON.parse(json);
        return parsed as ResumeContent;
    } catch (error) {
        throw new Error("Invalid JSON format");
    }
}

