'use client'

import { createContext, useContext, ReactNode, useState, useMemo } from 'react';

export interface HelpGuide {
  id: string;
  title: string;
  description: string;
  icon: string;
  sections: HelpSection[];
}

export interface HelpSection {
  title: string;
  content: string | HelpContentItem[];
  type: 'text' | 'list' | 'steps' | 'tips';
}

export interface HelpContentItem {
  title?: string;
  description: string;
  action?: {
    label: string;
    modeId?: string;
    command?: string;
  };
}

interface HelpContextType {
  guides: HelpGuide[];
  activeGuide: HelpGuide | null;
  setActiveGuide: (guide: HelpGuide | null) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filteredGuides: HelpGuide[];
}

const HelpContext = createContext<HelpContextType | undefined>(undefined);

// Define all help guides with structured content
const helpGuides: HelpGuide[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    description: 'New to JobKompass? Learn the basics to get up and running quickly.',
    icon: '🚀',
    sections: [
      {
        title: 'Welcome to JobKompass',
        type: 'text',
        content: 'JobKompass is your all-in-one career management platform. Organize your job search, manage resumes and cover letters, and track applications—all in one place. Sign in to unlock everything.',
      },
      {
        title: 'Quick Start Steps',
        type: 'steps',
        content: [
          {
            description: 'Sign in using the JobKompass icon in the sidebar (or Get started on the landing page)',
          },
          {
            description: 'Paste your resume into Chat—ask the AI to tweak it and it can create a resume for you right in the chat',
          },
          {
            description: 'Add jobs in My Jobs (click Add Job, or ask the AI in Chat to save a job to your job dashboard from a link)',
          },
          {
            description: 'Use Chat for resume tips, cover letters, and job-search advice; you can edit documents later in My Documents',
          },
        ],
      },
      {
        title: 'Where to Go Next',
        type: 'list',
        content: [
          {
            title: 'Chat',
            description: 'Paste your resume here; the AI can tweak it and create a resume or cover letter on the spot.',
            action: { label: 'Go to Chat', modeId: '/chat' },
          },
          {
            title: 'My Documents',
            description: 'Edit and download resumes and cover letters. Upload a PDF resume and we extract it into an editable format. Use any as a reference resume for jobs.',
            action: { label: 'Go to Documents', modeId: '/documents' },
          },
          {
            title: 'My Jobs',
            description: 'Track applications and status (Applied, Interviewing, Offered, etc.)',
            action: { label: 'Go to Jobs', modeId: '/my-jobs' },
          },
          {
            title: 'Links & Resources',
            description: 'Save job boards, articles, and tools in one place',
            action: { label: 'Go to Resources', modeId: '/resources' },
          },
        ],
      },
    ],
  },
  {
    id: 'resumes',
    title: 'Resumes & Documents',
    description: 'Create resumes and cover letters in Chat, then edit and download them in My Documents.',
    icon: '📄',
    sections: [
      {
        title: 'Why Use My Documents?',
        type: 'text',
        content: 'My Documents is where you edit and download resumes and cover letters. You can upload a PDF resume and we\'ll extract it into an editable format with AI. Or create them in Chat: paste your resume, ask the AI to tweak it, and it can make a resume or cover letter for you. Use any as a reference resume for jobs.',
      },
      {
        title: 'Getting the Best Results',
        type: 'tips',
        content: [
          {
            description: 'Paste your resume into Chat and ask the AI to improve it or create a new version—it can generate a document right in the chat',
          },
          {
            description: 'Open My Documents later to edit the content, then Save to update the stored PDF and Download when you\'re ready to apply',
          },
          {
            description: 'Use any saved resume as a reference resume when creating tailored versions for specific jobs',
          },
          {
            description: 'Always download as PDF for applications—our export is ATS-friendly',
          },
        ],
      },
      {
        title: 'Resume Best Practices',
        type: 'list',
        content: [
          {
            title: 'ATS Optimization',
            description: 'Use clear section headers (Experience, Education, Skills). Include keywords from the job description. Keep formatting clean.',
          },
          {
            title: 'Content',
            description: 'Start bullets with action verbs. Quantify results with numbers. Keep descriptions concise.',
          },
          {
            title: 'Customization',
            description: 'Tailor content for each role. Use Chat to get AI suggestions based on a job description.',
          },
        ],
      },
      {
        title: 'How to Use',
        type: 'steps',
        content: [
          {
            description: 'In Chat: paste your resume and ask the AI to tweak it or create a new one—it can make the document for you right there',
          },
          {
            description: 'Open My Documents from the sidebar (or type /documents in Chat) to see your saved resumes and cover letters',
          },
          {
            description: 'Click a document to open the editor; edit content then Save to update the PDF',
          },
          {
            description: 'Use Download to get a PDF for applications; use documents as reference resumes when applying to jobs',
          },
        ],
      },
    ],
  },
  {
    id: 'job-tracking',
    title: 'Job Tracking',
    description: 'Track applications and status in one place with My Jobs.',
    icon: '💼',
    sections: [
      {
        title: 'Why Use My Jobs?',
        type: 'text',
        content: 'My Jobs keeps all your applications in one place. Add a job by link or form, update status as you go, and never lose track of follow-ups.',
      },
      {
        title: 'Getting the Best Results',
        type: 'tips',
        content: [
          {
            description: 'Click "Add Job" and paste a job URL—we\'ll pull in title, company, and details when possible',
          },
          {
            description: 'You can also have the AI add a job from Chat: paste a link and ask it to save the job to your job dashboard',
          },
          {
            description: 'Update status as you move through the process: Applied, Interviewing, Offered, Rejected',
          },
          {
            description: 'Click a job card to expand and view or edit full details and notes',
          },
        ],
      },
      {
        title: 'Job Status Guide',
        type: 'list',
        content: [
          {
            title: 'Interested',
            description: 'Considering but haven\'t applied yet',
          },
          {
            title: 'Applied',
            description: 'Application submitted',
          },
          {
            title: 'Interviewing',
            description: 'In the interview process',
          },
          {
            title: 'Offered',
            description: 'Offer received',
          },
          {
            title: 'Rejected',
            description: 'Not moving forward or withdrew',
          },
        ],
      },
      {
        title: 'How to Use',
        type: 'steps',
        content: [
          {
            description: 'Open My Jobs from the sidebar or type /my-jobs in Chat',
          },
          {
            description: 'Click "Add Job" to add manually, or paste a job link in Chat and ask the AI to add it to your job dashboard',
          },
          {
            description: 'We\'ll try to fill in title, company, and other details from the link',
          },
          {
            description: 'Update status and notes as you progress; click a card to expand and edit',
          },
        ],
      },
    ],
  },
  {
    id: 'ai-chat',
    title: 'Chat (AI Assistant)',
    description: 'Paste your resume, get tweaks and new documents on the spot, plus job search advice and quick actions.',
    icon: '💬',
    sections: [
      {
        title: 'What Is Chat?',
        type: 'text',
        content: 'Chat is JobKompass\'s AI assistant. Paste your resume and ask it to tweak or create a new one—it can make a resume or cover letter for you right in the chat. You can edit it later in My Documents and use it as a reference for jobs. Chat can also add jobs from links, give job-search and interview advice, and use your existing documents and jobs for personalized suggestions.',
      },
      {
        title: 'What the AI Can Do',
        type: 'list',
        content: [
          {
            title: 'Resumes & Cover Letters',
            description: 'Generate a resume or cover letter from scratch, or improve an existing one. Ask for ATS-friendly wording and structure.',
          },
          {
            title: 'Job Search & Applications',
            description: 'Paste a job link and ask the AI to add it to My Jobs. Ask for interview prep, salary tips, and application strategy.',
          },
          {
            title: 'Career Guidance',
            description: 'Ask about career moves, skills, and industry trends. The AI can reference your saved documents and jobs when you ask.',
          },
        ],
      },
      {
        title: 'Getting the Best Results',
        type: 'tips',
        content: [
          {
            description: 'Be specific: "Create a resume for a backend engineer role" works better than "make a resume"',
          },
          {
            description: 'Reference your data: "Improve my current resume" or "Compare my resume to this job"',
          },
          {
            description: 'Follow up in the same thread—the AI keeps context for the conversation',
          },
        ],
      },
    ],
  },
  {
    id: 'resources',
    title: 'Links & Resources',
    description: 'Save job boards, articles, and tools in one place.',
    icon: '🔗',
    sections: [
      {
        title: 'Why Use Links & Resources?',
        type: 'text',
        content: 'Keep job boards, company pages, articles, and tools in one place. You can also add information you use over and over in applications—boilerplate answers, contact details, common phrases—so it\'s always easy to find and copy quickly when you need it.',
      },
      {
        title: 'Getting the Best Results',
        type: 'tips',
        content: [
          {
            description: 'Store text you reuse often: application answers, contact info, elevator pitch, or anything you copy into forms—then reference and copy it quickly whenever you need it',
          },
          {
            description: 'Use categories (Job Board, Company, Networking, Learning, Tools) to stay organized',
          },
          {
            description: 'Add a short description so you remember why you saved a link or note',
          },
          {
            description: 'Use search and filters to find resources quickly',
          },
        ],
      },
      {
        title: 'Resource Categories',
        type: 'list',
        content: [
          {
            title: 'Job Board',
            description: 'LinkedIn, Indeed, company career pages, niche boards',
          },
          {
            title: 'Company',
            description: 'Company research, reviews, culture',
          },
          {
            title: 'Networking',
            description: 'Events, groups, alumni networks',
          },
          {
            title: 'Learning',
            description: 'Courses, certs, skill-building',
          },
          {
            title: 'Tools',
            description: 'Resume tools, portfolios, interview prep, salary calculators',
          },
        ],
      },
      {
        title: 'How to Use',
        type: 'steps',
        content: [
          {
            description: 'Open Links & Resources from the sidebar',
          },
          {
            description: 'Click "New Note" to add a link or a note (title, URL if you have one, description, category)',
          },
          {
            description: 'Add reusable text—application answers, contact info, phrases—so you can copy it quickly whenever you apply',
          },
          {
            description: 'Click a note to edit it later; use search and filters to find things',
          },
        ],
      },
    ],
  },
  {
    id: 'workflow',
    title: 'Complete Workflow',
    description: 'A simple flow from setup to applications and follow-up.',
    icon: '🔄',
    sections: [
      {
        title: 'The JobKompass Workflow',
        type: 'text',
        content: 'Use this flow to get the most out of JobKompass: set up once, then discover jobs, apply, and follow up—all in one place.',
      },
      {
        title: '1. Setup',
        type: 'steps',
        content: [
          {
            description: 'Paste your resume into Chat and ask the AI to tweak it or create a new one—it can make the document for you on the spot',
          },
          {
            description: 'Edit and download from My Documents; use any as a reference resume for jobs',
          },
          {
            description: 'Save useful links (job boards, companies) in Links & Resources',
          },
        ],
      },
      {
        title: '2. Finding Jobs',
        type: 'steps',
        content: [
          {
            description: 'Browse job boards and company sites; save job links in Links & Resources so you can get back to them',
          },
          {
            description: 'Have the AI add a job to your job dashboard: paste a link in Chat or in My Documents and ask it to save the job to My Jobs—or click Add Job in My Jobs to add it yourself',
          },
          {
            description: 'Ask the AI for job-search or industry advice when you need it',
          },
        ],
      },
      {
        title: '3. Applying',
        type: 'steps',
        content: [
          {
            description: 'Open the job in My Jobs and review the description',
          },
          {
            description: 'Use Chat to tailor your resume and generate a cover letter (paste or reference your saved resume)',
          },
          {
            description: 'Download resume and cover letter as PDFs, submit, then update job status',
          },
        ],
      },
      {
        title: '4. Interview & Follow-up',
        type: 'steps',
        content: [
          {
            description: 'Set status to Interviewing when you get a response',
          },
          {
            description: 'Use Chat for interview prep; add notes on the job in My Jobs',
          },
          {
            description: 'Update status to Offered or Rejected and keep notes for next time',
          },
        ],
      },
      {
        title: 'Pro Tips',
        type: 'tips',
        content: [
          {
            description: 'Check My Jobs often so you don\'t miss follow-ups',
          },
          {
            description: 'Use Chat as your hub—it can see your documents and jobs',
          },
          {
            description: 'Keep one or two resume versions ready for different role types',
          },
        ],
      },
    ],
  },
];

export function JkHelpProvider({ children }: { children: ReactNode }) {
  const [activeGuide, setActiveGuide] = useState<HelpGuide | null>(helpGuides[0]);
  const [searchQuery, setSearchQuery] = useState('');

  // Filter guides based on search query
  const filteredGuides = useMemo(() => {
    if (!searchQuery.trim()) return helpGuides;

    const query = searchQuery.toLowerCase();
    return helpGuides.filter((guide) => {
      // Search in title, description, and section content
      const matchesTitle = guide.title.toLowerCase().includes(query);
      const matchesDescription = guide.description.toLowerCase().includes(query);
      const matchesContent = guide.sections.some((section) => {
        if (typeof section.content === 'string') {
          return section.content.toLowerCase().includes(query);
        }
        return section.content.some((item) =>
          (item.title?.toLowerCase().includes(query) || 
           item.description.toLowerCase().includes(query))
        );
      });
      return matchesTitle || matchesDescription || matchesContent;
    });
  }, [searchQuery]);

  const value: HelpContextType = {
    guides: helpGuides,
    activeGuide,
    setActiveGuide,
    searchQuery,
    setSearchQuery,
    filteredGuides,
  };

  return (
    <HelpContext.Provider value={value}>
      {children}
    </HelpContext.Provider>
  );
}

export function useHelp() {
  const context = useContext(HelpContext);
  if (!context) {
    throw new Error('useHelp must be used within JkHelpProvider');
  }
  return context;
}
