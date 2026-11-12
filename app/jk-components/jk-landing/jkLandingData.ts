// Copy for the landing page. Kept in one place so sections stay presentational.


export interface FAQItem {
  question: string;
  answer: string;
}

export const faqData: FAQItem[] = [
  {
    question: "What is JobKompass?",
    answer: "JobKompass is a career management platform that helps you organize your job search, manage resumes, and streamline your application process. It's designed to make your career journey more efficient and organized."
  },
  {
    question: "How do I get started?",
    answer: "Simply click Get started to begin. You can upload a PDF resume in My Documents and we'll extract it, or paste your resume into Chat and ask the AI to tweak or create one for you. Add your first job in My Jobs and the platform will guide you through the rest."
  },
  {
    question: "Is my data secure?",
    answer: "Yes, we take data security seriously. All your information is encrypted and stored securely. We never share your personal data with third parties."
  },
  {
    question: "Can I customize my resume?",
    answer: "Yes. We currently offer one resume template, with more on the way soon. You can still customize your resume for each job—edit, format, and tailor it to match specific job requirements."
  },
  {
    question: "How do I track my job applications?",
    answer: "You can add jobs to your dashboard and track their status. The platform helps you organize applications by company, position, and status, making it easy to stay on top of your job search."
  },
  {
    question: "What is the JobKompass CLI, and do I need it?",
    answer: "The jk CLI is an optional command-line tool that does everything the app does, so an AI agent like Claude Code or Cursor can manage your job search for you—adding jobs, generating tailored resumes, saving links. If you don't use a terminal, ignore it; the web app does everything on its own. If you do, install it with npm install -g jobkompass-cli and create a key in Settings under Command Line & AI Agents."
  },
  {
    question: "Is there a mobile app?",
    answer: "JobKompass is currently available as a web application that works on all devices. We're working on dedicated mobile apps and will notify waitlist members when they're available."
  }
];


export const CLI_STEPS: { label: string; command: string; note: string }[] = [
  {
    label: "Install it",
    command: "npm install -g jobkompass-cli",
    note: "Needs Node 18 or newer.",
  },
  {
    label: "Connect your account",
    command: "jk auth login <your-key>",
    note: "Create a key in Settings → Command Line & AI Agents.",
  },
  {
    label: "Let your agent take over",
    command: "jk schema",
    note: "Returns every command as JSON, so your agent knows how to use it.",
  },
];

export const CLI_NOTES: { title: string; body: string }[] = [
  { title: "Deletes need a flag", body: "Destructive commands refuse to run without --yes, so an agent can't quietly wipe your data." },
  { title: "Keys are hashed", body: "We store only a hash of your key. Revoke any key from Settings and it stops working immediately." },
  { title: "Built for scripts", body: "JSON output when piped, and exit codes that separate your mistakes from server errors." },
];
