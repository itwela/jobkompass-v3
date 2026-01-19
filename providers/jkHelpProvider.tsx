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
        content: 'JobKompass is your all-in-one career management platform. Whether you\'re job hunting, building your resume, or tracking applications, we\'ve got you covered.',
      },
      {
        title: 'Quick Start Steps',
        type: 'steps',
        content: [
          {
            description: 'Sign in using the JobKompass icon in the sidebar to access all features',
          },
          {
            description: 'Upload your resume in Documents mode to get started with resume management',
          },
          {
            description: 'Add your first job application in Jobs mode to begin tracking',
          },
          {
            description: 'Chat with our AI assistant to get personalized career guidance',
          },
        ],
      },
      {
        title: 'Where to Go Next',
        type: 'list',
        content: [
          {
            title: 'Chat Mode',
            description: 'Get instant AI-powered help with resumes, cover letters, and job search advice',
            action: { label: 'Go to Chat', modeId: '/chat' },
          },
          {
            title: 'Documents Mode',
            description: 'Upload and manage your resumes and cover letters',
            action: { label: 'Go to Documents', modeId: '/documents' },
          },
          {
            title: 'Jobs Mode',
            description: 'Track your job applications and stay organized',
            action: { label: 'Go to Jobs', modeId: '/my-jobs' },
          },
        ],
      },
    ],
  },
  {
    id: 'resumes',
    title: 'Resumes & Documents',
    description: 'Master resume creation, optimization, and management to land your dream job.',
    icon: '📄',
    sections: [
      {
        title: 'Why Use Documents Mode?',
        type: 'text',
        content: 'The Documents mode is your central hub for all your career documents. Upload, organize, and manage multiple versions of your resume and cover letters with ease.',
      },
      {
        title: 'Getting the Best Results',
        type: 'tips',
        content: [
          {
            description: 'Upload your existing resume to get started - our AI can analyze and improve it',
          },
          {
            description: 'Use multiple resume versions for different job types (technical, creative, leadership, etc.)',
          },
          {
            description: 'Add labels and tags to organize your documents - e.g., "Software Engineer", "Marketing Manager"',
          },
          {
            description: 'Download your resume as PDF for applications - always use PDF format for ATS compatibility',
          },
        ],
      },
      {
        title: 'Resume Best Practices',
        type: 'list',
        content: [
          {
            title: 'ATS Optimization',
            description: 'Use standard section headers (Experience, Education, Skills). Include relevant keywords from job descriptions. Keep formatting clean and simple.',
          },
          {
            title: 'Content Guidelines',
            description: 'Start bullet points with action verbs. Quantify achievements with numbers. Keep descriptions concise but impactful.',
          },
          {
            title: 'Customization',
            description: 'Tailor your resume for each application. Use the Chat mode to get AI assistance in customizing content for specific roles.',
          },
        ],
      },
      {
        title: 'How to Use',
        type: 'steps',
        content: [
          {
            description: 'Navigate to Documents mode using the sidebar or typing "/documents"',
          },
          {
            description: 'Click "Upload Document" to add your resume or cover letter',
          },
          {
            description: 'Add labels and tags to organize your documents',
          },
          {
            description: 'Use Chat mode to ask for resume improvements or generate new versions',
          },
          {
            description: 'Download your optimized resume as PDF when ready to apply',
          },
        ],
      },
    ],
  },
  {
    id: 'job-tracking',
    title: 'Job Tracking',
    description: 'Organize and manage your job applications efficiently with our job tracker.',
    icon: '💼',
    sections: [
      {
        title: 'Why Track Your Jobs?',
        type: 'text',
        content: 'Keeping track of your job applications helps you stay organized, follow up at the right times, and never miss an opportunity. Our Jobs mode makes this effortless.',
      },
      {
        title: 'Getting the Best Results',
        type: 'tips',
        content: [
          {
            description: 'Add jobs quickly using the Chat mode - just paste a job link and say "/add job" or ask the AI to add it',
          },
          {
            description: 'Update job status regularly to keep your pipeline current (Interested, Applied, Interviewing, Offered, Rejected)',
          },
          {
            description: 'Add notes for each job - interview questions, company insights, contact information',
          },
          {
            description: 'Use the expanded view to see all details and take action',
          },
        ],
      },
      {
        title: 'Job Status Guide',
        type: 'list',
        content: [
          {
            title: 'Interested',
            description: 'Jobs you\'re considering but haven\'t applied to yet',
          },
          {
            title: 'Applied',
            description: 'Jobs you\'ve submitted applications for',
          },
          {
            title: 'Interviewing',
            description: 'Jobs where you\'re in the interview process',
          },
          {
            title: 'Offered',
            description: 'Jobs where you\'ve received an offer',
          },
          {
            title: 'Rejected',
            description: 'Jobs you didn\'t get or withdrew from',
          },
        ],
      },
      {
        title: 'How to Use',
        type: 'steps',
        content: [
          {
            description: 'Go to Jobs mode from the sidebar or type "/my-jobs"',
          },
          {
            description: 'Add a job by clicking "Add Job" or using Chat mode with a job link',
          },
          {
            description: 'The AI will automatically extract job details from the link',
          },
          {
            description: 'Update status as you progress through the application process',
          },
          {
            description: 'Click on any job card to expand and view/edit full details',
          },
        ],
      },
    ],
  },
  {
    id: 'ai-chat',
    title: 'AI Chat Assistant',
    description: 'Leverage our AI assistant for personalized career guidance and document help.',
    icon: '💬',
    sections: [
      {
        title: 'Your AI Career Assistant',
        type: 'text',
        content: 'Our AI assistant is trained specifically on career guidance, resume optimization, and job search strategies. It can help you at every step of your career journey.',
      },
      {
        title: 'What the AI Can Do',
        type: 'list',
        content: [
          {
            title: 'Resume Creation & Editing',
            description: 'Create new resumes from scratch or improve existing ones. Get suggestions for ATS optimization, formatting, and content improvements.',
          },
          {
            title: 'Cover Letter Writing',
            description: 'Generate tailored cover letters for specific job applications. Get help with tone, structure, and key points.',
          },
          {
            title: 'Job Search Strategy',
            description: 'Get advice on finding jobs, networking, interview preparation, and salary negotiation.',
          },
          {
            title: 'Career Guidance',
            description: 'Ask questions about career transitions, skill development, industry trends, and more.',
          },
          {
            title: 'Document Management',
            description: 'The AI can access your existing resumes and jobs to provide personalized advice based on what you already have.',
          },
        ],
      },
      {
        title: 'Getting the Best Results',
        type: 'tips',
        content: [
          {
            description: 'Be specific in your requests - "Create a resume for a software engineer position" works better than "make a resume"',
          },
          {
            description: 'Attach relevant documents - the AI can read your resumes and job descriptions to provide better suggestions',
          },
          {
            description: 'Reference your existing data - ask things like "improve my current resume" or "compare my resume to this job posting"',
          },
          {
            description: 'Use commands like "/add job [link]" or "/download-resume" for quick actions',
          },
          {
            description: 'Ask follow-up questions - the AI remembers context within a conversation thread',
          },
        ],
      },
      {
        title: 'Quick Commands',
        type: 'list',
        content: [
          {
            title: '/add job [link]',
            description: 'Automatically add a job from a URL',
          },
          {
            title: '/download-resume',
            description: 'Download your resume as PDF',
          },
          {
            title: '/start',
            description: 'Get a personalized getting started guide',
          },
        ],
      },
    ],
  },
  {
    id: 'resources',
    title: 'Links & Resources',
    description: 'Save and organize job boards, helpful articles, tools, and networking resources.',
    icon: '🔗',
    sections: [
      {
        title: 'Why Save Resources?',
        type: 'text',
        content: 'During your job search, you\'ll come across countless useful links - job boards, company research, career advice articles, networking platforms, and tools. Save them all in one place for easy access.',
      },
      {
        title: 'Getting the Best Results',
        type: 'tips',
        content: [
          {
            description: 'Categorize your resources using the predefined categories (Job Board, Company, Networking, Learning, Tools, etc.)',
          },
          {
            description: 'Add descriptions and notes to remember why you saved a resource',
          },
          {
            description: 'Use the search feature to quickly find saved resources',
          },
          {
            description: 'Filter by category to see resources by type',
          },
          {
            description: 'The AI can automatically save resources it mentions during conversations',
          },
        ],
      },
      {
        title: 'Resource Categories',
        type: 'list',
        content: [
          {
            title: 'Job Board',
            description: 'LinkedIn, Indeed, company career pages, specialized job boards',
          },
          {
            title: 'Company',
            description: 'Company research, Glassdoor reviews, company culture info',
          },
          {
            title: 'Networking',
            description: 'Professional networks, events, industry groups, alumni networks',
          },
          {
            title: 'Learning',
            description: 'Courses, tutorials, certifications, skill development resources',
          },
          {
            title: 'Tools',
            description: 'Resume builders, portfolio sites, interview prep tools, salary calculators',
          },
        ],
      },
      {
        title: 'How to Use',
        type: 'steps',
        content: [
          {
            description: 'Go to Links & Resources mode from the sidebar',
          },
          {
            description: 'Click "New Note" to manually add a resource, or let the AI save resources automatically',
          },
          {
            description: 'Fill in the title, URL, description, and select a category',
          },
          {
            description: 'Click on any sticky note to edit it later',
          },
          {
            description: 'Use search and filters to find resources quickly',
          },
        ],
      },
    ],
  },
  {
    id: 'workflow',
    title: 'Complete Workflow',
    description: 'Learn the optimal workflow for using JobKompass throughout your job search.',
    icon: '🔄',
    sections: [
      {
        title: 'The JobKompass Workflow',
        type: 'text',
        content: 'Follow this recommended workflow to get the most out of JobKompass and streamline your job search process.',
      },
      {
        title: '1. Setup Phase',
        type: 'steps',
        content: [
          {
            description: 'Upload your existing resume(s) in Documents mode',
          },
          {
            description: 'Ask the AI in Chat mode to analyze and suggest improvements',
          },
          {
            description: 'Create optimized versions for different job types',
          },
          {
            description: 'Save useful resources like job boards and company pages',
          },
        ],
      },
      {
        title: '2. Job Discovery',
        type: 'steps',
        content: [
          {
            description: 'Browse job boards and company websites',
          },
          {
            description: 'Use Resources mode to save interesting opportunities',
          },
          {
            description: 'Ask the AI for job search strategies in your field',
          },
          {
            description: 'Add jobs to track in Jobs mode as you find them',
          },
        ],
      },
      {
        title: '3. Application Phase',
        type: 'steps',
        content: [
          {
            description: 'For each job, review the job description in Jobs mode',
          },
          {
            description: 'Use Chat mode to customize your resume for the specific role',
          },
          {
            description: 'Generate a tailored cover letter using the AI assistant',
          },
          {
            description: 'Download your customized resume and cover letter',
          },
          {
            description: 'Submit your application and update job status',
          },
        ],
      },
      {
        title: '4. Interview & Follow-up',
        type: 'steps',
        content: [
          {
            description: 'Update job status to "Interviewing" when you get responses',
          },
          {
            description: 'Use Chat mode for interview preparation and practice',
          },
          {
            description: 'Add interview notes and company insights in Jobs mode',
          },
          {
            description: 'Use Resources mode to save helpful interview prep materials',
          },
          {
            description: 'Update status as you progress (Offered, Rejected, etc.)',
          },
        ],
      },
      {
        title: 'Pro Tips',
        type: 'tips',
        content: [
          {
            description: 'Check your Jobs mode regularly to follow up on applications',
          },
          {
            description: 'Keep multiple resume versions ready for different types of roles',
          },
          {
            description: 'Let the AI save resources automatically during conversations',
          },
          {
            description: 'Use Chat mode as your central hub - it can access all your data',
          },
          {
            description: 'Regularly review and update your documents and job statuses',
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
