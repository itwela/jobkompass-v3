import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Free Resume Generator — Extract & Format Your Resume Instantly',
  description:
    'Paste your resume text — we\'ll extract and format it into a professional PDF for free. No signup required to start. Extract experience, education, skills automatically. Download a professionally formatted PDF resume in seconds.',
  keywords: [
    'free resume generator',
    'upload resume PDF',
    'resume extractor',
    'generate resume',
    'resume formatter',
    'extract resume data',
    'free resume builder',
    'resume to PDF',
    'parse resume text',
    'resume information extraction',
    'free resume tool',
  ],
  openGraph: {
    title: 'Free Resume Generator — Extract & Format Your Resume Instantly | JobKompass',
    description:
      'Paste your resume text — we\'ll extract and format it into a professional PDF for free. Extract experience, education, skills automatically. Download a professionally formatted PDF.',
    url: 'https://jobkompass.com/free-resume-parser',
    siteName: 'JobKompass',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Free Resume Generator — Extract & Format Your Resume for Free',
    description: 'Paste your resume text. We extract and format it into a professional PDF. Download in seconds.',
  },
  alternates: {
    canonical: 'https://jobkompass.com/free-resume-parser',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function FreeResumeParserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
