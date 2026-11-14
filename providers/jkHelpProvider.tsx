'use client'

/**
 * Help & Guides content (D14 / M16). Short how-to guides grouped Start / Documents /
 * Automation. Each has a lede, numbered steps, and a "What you get" visual the Help screen
 * draws. Read time is counted from the words, not typed in.
 */
import { createContext, useContext, ReactNode, useState, useMemo } from 'react';

export type HelpGroup = 'Start' | 'Documents' | 'Automation';
export type HelpVisual = 'tailored' | 'resume' | 'job' | 'folders' | 'share' | 'extension' | 'cli';

export interface HelpStep {
  title: string;
  body: string;
}

export interface HelpGuide {
  id: string;
  group: HelpGroup;
  title: string;
  lede: string;
  steps: HelpStep[];
  visual: HelpVisual;
  /** Mono caption under the visual. */
  caption: string;
  /** Where "Open" takes you in the app. */
  modeId?: string;
}

export const HELP_GROUPS: HelpGroup[] = ['Start', 'Documents', 'Automation'];

export const HELP_GUIDES: HelpGuide[] = [
  {
    id: 'save-first-job',
    group: 'Start',
    title: 'Save your first job',
    lede: 'Every resume and cover letter starts from a saved job. Saving keeps the full posting, so you can write from it later.',
    steps: [
      { title: 'Open My Jobs', body: 'Press Add job and paste the link to the posting.' },
      { title: 'Or ask in Chat', body: 'Paste the link in Chat and say "add this to my jobs".' },
      { title: 'Set the status', body: 'Move it from Interested to Applied, Interviewing or Offered as things change.' },
    ],
    visual: 'job',
    caption: 'One row per job · status you control',
    modeId: '/my-jobs',
  },
  {
    id: 'tailored-resume',
    group: 'Start',
    title: 'Write a tailored resume',
    lede: 'JobKompass rewrites your base resume for one posting. It only uses experience you already have.',
    steps: [
      { title: 'Pick the job', body: 'Open My Jobs and select a job, or paste a new link in Chat.' },
      { title: 'Ask for the resume', body: 'Type "tailor my resume to this job". It reads the posting and your base resume.' },
      { title: 'Read the changes', body: 'Every edit is marked on the page with the reason. Must-haves you lack are listed, not invented.' },
      { title: 'Download or keep editing', body: 'The PDF is saved to My Documents and linked to the job.' },
    ],
    visual: 'tailored',
    caption: '3 changes · each with a reason',
    modeId: '/chat',
  },
  {
    id: 'base-resume',
    group: 'Start',
    title: 'Set your base resume',
    lede: 'Your base resume is the one JobKompass tailors from. Keep it complete; each tailored copy picks what fits.',
    steps: [
      { title: 'Upload or paste it', body: 'Add a PDF in My Documents, or paste the text in Chat.' },
      { title: 'Mark it as your base', body: 'The first resume you add becomes your base. Change it from the resume\'s menu in My Documents.' },
      { title: 'Keep it current', body: 'Add new roles and projects here first. Tailored resumes only use what is in it.' },
    ],
    visual: 'resume',
    caption: 'Your base resume · the source for every copy',
    modeId: '/documents',
  },
  {
    id: 'folders-favorites',
    group: 'Documents',
    title: 'Folders and favorites',
    lede: 'Group resumes and cover letters by company or role, and star the ones you send most.',
    steps: [
      { title: 'Make a folder', body: 'In My Documents, press New folder and name it.' },
      { title: 'Move documents in', body: 'Open a document\'s menu and pick the folder.' },
      { title: 'Star the keepers', body: 'Favorites sit at the top so the good versions are easy to find.' },
    ],
    visual: 'folders',
    caption: 'Folders on the left · favorites first',
    modeId: '/documents',
  },
  {
    id: 'edit-resume',
    group: 'Documents',
    title: 'Edit a resume',
    lede: 'Change any line of a saved resume yourself. Saving makes a fresh PDF in the same template.',
    steps: [
      { title: 'Open it', body: 'Select the resume in My Documents and choose Edit.' },
      { title: 'Change what you need', body: 'Edit sections, bullets and skills directly. Edits do not count against your AI documents.' },
      { title: 'Save', body: 'The PDF is rebuilt and replaces the old one.' },
    ],
    visual: 'resume',
    caption: 'Unlimited edits on every plan',
    modeId: '/documents',
  },
  {
    id: 'share-link',
    group: 'Documents',
    title: 'Share a resume link',
    lede: 'Send a link instead of an attachment. Turn it off any time and the link stops working.',
    steps: [
      { title: 'Open the menu', body: 'In My Documents, open the resume\'s menu.' },
      { title: 'Copy share link', body: 'The link is copied. Anyone with it can view and download the PDF.' },
      { title: 'Turn it off', body: 'Pick Turn off share link from the same menu when you are done.' },
    ],
    visual: 'share',
    caption: 'One link per resume · off when you say',
    modeId: '/documents',
  },
  {
    id: 'chrome-extension',
    group: 'Automation',
    title: 'Install the Chrome extension',
    lede: 'Save a posting from any job site in one click, without copying the link.',
    steps: [
      { title: 'Add it to Chrome', body: 'Install JobKompass from the Chrome Web Store.' },
      { title: 'Connect it', body: 'Create a key in Settings under Chrome extension and paste it into the extension.' },
      { title: 'Save from any posting', body: 'Open a job page and press the JobKompass button. It lands in My Jobs.' },
    ],
    visual: 'extension',
    caption: 'Plus and Pro',
    modeId: '/settings',
  },
  {
    id: 'jk-cli',
    group: 'Automation',
    title: 'Use the jk CLI with an agent',
    lede: 'jk does what the app does from a terminal, so Claude Code, Cursor or any agent can run your search for you.',
    steps: [
      { title: 'Install it', body: 'Run npm install -g jobkompass-cli.' },
      { title: 'Log in', body: 'Create a key in Settings under CLI keys, then run jk auth login with it.' },
      { title: 'Hand it to your agent', body: 'Ask your agent to add jobs or write resumes. It runs jk commands for you.' },
    ],
    visual: 'cli',
    caption: 'Pro',
    modeId: '/settings',
  },
];

/** Minutes to read a guide, from its words at 200 a minute. */
export function helpReadMinutes(g: HelpGuide): number {
  const text = [g.title, g.lede, ...g.steps.flatMap((s) => [s.title, s.body])].join(' ');
  return Math.max(1, Math.ceil(text.split(/\s+/).length / 200));
}

interface HelpContextType {
  guides: HelpGuide[];
  activeGuide: HelpGuide;
  setActiveGuide: (guide: HelpGuide) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filteredGuides: HelpGuide[];
}

const HelpContext = createContext<HelpContextType | undefined>(undefined);

export function JkHelpProvider({ children }: { children: ReactNode }) {
  const [activeGuide, setActiveGuide] = useState<HelpGuide>(HELP_GUIDES[1]);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredGuides = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return HELP_GUIDES;
    return HELP_GUIDES.filter((g) =>
      [g.title, g.lede, g.group, ...g.steps.flatMap((s) => [s.title, s.body])].join(' ').toLowerCase().includes(q));
  }, [searchQuery]);

  return (
    <HelpContext.Provider value={{ guides: HELP_GUIDES, activeGuide, setActiveGuide, searchQuery, setSearchQuery, filteredGuides }}>
      {children}
    </HelpContext.Provider>
  );
}

export function useHelp() {
  const context = useContext(HelpContext);
  if (context === undefined) throw new Error('useHelp must be used within a JkHelpProvider');
  return context;
}
