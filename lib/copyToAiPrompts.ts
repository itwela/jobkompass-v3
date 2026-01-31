/**
 * Prompts and AI options for "Copy to your AI" flow in template selector.
 * User copies a prompt, pastes into ChatGPT/Claude/etc., gets structured output to use in JobKompass.
 */

export interface CopyToAiOption {
  id: string;
  name: string;
  logoUrl: string;
  url: string;
}

export const COPY_TO_AI_OPTIONS: CopyToAiOption[] = [
  { id: 'chatgpt', name: 'ChatGPT', logoUrl: 'https://openai.com/favicon.ico', url: 'https://chat.openai.com/' },
  { id: 'claude', name: 'Claude', logoUrl: 'https://claude.ai/favicon.ico', url: 'https://claude.ai/' },
  { id: 'gemini', name: 'Gemini', logoUrl: 'https://www.google.com/favicon.ico', url: 'https://gemini.google.com/' },
  { id: 'copilot', name: 'Copilot', logoUrl: 'https://www.microsoft.com/favicon.ico', url: 'https://copilot.microsoft.com/' },
  { id: 'perplexity', name: 'Perplexity', logoUrl: 'https://www.perplexity.ai/favicon.ico', url: 'https://www.perplexity.ai/' },
];

const RESUME_PROMPT = `Based on everything you know about me, craft my resume information. Provide the fields below in a clear, structured format so I can use them:

**PERSONAL INFO**
- firstName, lastName, email (required)
- citizenship, location (optional)
- linkedin, github, portfolio URLs (optional)

**EXPERIENCE** (array of jobs)
For each: company, title, location (optional), date (e.g. "Jan 2020 - Present"), details (array of bullet points)

**EDUCATION** (array)
For each: name, degree, field (optional), location (optional), startDate (optional), endDate, details (optional - GPA, honors)

**PROJECTS** (array, optional)
For each: name, description, date (optional), technologies (optional), details (optional)

**SKILLS** (optional)
- technical: array of technical skills
- additional: array of soft skills

**ADDITIONAL** (optional)
- interests, hobbies, languages, references (arrays)

**TARGET COMPANY** (optional): Company name if tailoring for a specific role`;

const COVER_LETTER_PROMPT = `Based on everything you know about me, craft my cover letter content for this role. Provide the fields below in a clear, structured format:

**PERSONAL INFO**
- firstName, lastName, email (required)
- phone, location (optional)

**JOB INFO**
- company (required)
- position (required)
- hiringManagerName (optional)
- companyAddress (optional)

**LETTER CONTENT**
- openingParagraph: Introduce yourself and express interest. Mention how you found the job and why you're excited.
- bodyParagraphs: Array of 2-3 paragraphs highlighting relevant experience, skills, achievements. Match qualifications to job requirements.
- closingParagraph: Summarize interest, thank them, express enthusiasm for next steps`;

export function getCopyPromptForTemplate(
  type: 'resume' | 'cover-letter',
  jobTitle?: string,
  jobCompany?: string
): string {
  const base = type === 'resume' ? RESUME_PROMPT : COVER_LETTER_PROMPT;
  if (jobTitle || jobCompany) {
    const context = [
      jobCompany && `Company: ${jobCompany}`,
      jobTitle && `Position: ${jobTitle}`,
    ]
      .filter(Boolean)
      .join('\n');
    return `This is for:\n${context}\n\n---\n\n${base}`;
  }
  return base;
}
