import type { Metadata } from "next";
import { Ubuntu } from "next/font/google";
import { JobKompassThemeProvider } from "@/providers/jkThemeProvider";
import "./globals.css";

const ubuntu = Ubuntu({
  weight: ["300", "400", "500", "700"],
  subsets: ["latin"],
  variable: "--font-ubuntu",
  display: "swap",
});
import { JobKompassChatWindowProvider } from "@/providers/jkChatWindowProvider";
import JobKompassResumeProvider from "@/providers/jkResumeProvider";
import { JobKompassDocumentsProvider } from "@/providers/jkDocumentsProvider";
import { JkConvexProviders } from "@/providers/jkConvexProvider";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import { JkAuthProvider } from "@/providers/jkAuthProvider";
import { JkResourcesProvider } from "@/providers/jkResourcesProvider";
import { JkJobsProvider } from "@/providers/jkJobsProvider";
import { JkHelpProvider } from "@/providers/jkHelpProvider";
import { JkToastProvider } from "@/providers/jkToastProvider";
import { SubscriptionProvider } from "@/providers/jkSubscriptionProvider";

export const metadata: Metadata = {
  title: {
    default: "JobKompass - Career Management Platform | Organize Your Job Search",
    template: "%s | JobKompass"
  },
  description: "100% AI-powered career management platform. Manage your job search with artificial intelligence, organize applications, and create tailored resumes and cover letters using advanced AI technology. Chat with AI to refine and improve your documents with intelligent career guidance.",
  keywords: [
    "AI career management",
    "artificial intelligence job search",
    "AI resume builder",
    "AI cover letter generator",
    "AI-powered career platform",
    "100% AI job tracker",
    "AI career guidance",
    "AI interview prep",
    "GPT-powered resume builder",
    "machine learning job search",
    "AI document refinement",
    "intelligent career management",
    "AI job application tracker",
    "AI-powered ATS optimization",
    "artificial intelligence career assistant",
    "job search",
    "career management",
    "resume builder",
    "cover letter generator",
    "job application tracker",
    "career guidance",
    "interview prep",
    "AI resume",
    "ATS optimization",
    "job organizer"
  ],
  authors: [{ name: "JobKompass" }],
  creator: "JobKompass",
  publisher: "JobKompass",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://jobkompass.com",
    siteName: "JobKompass",
    title: "JobKompass - 100% AI-Powered Career Management Platform",
    description: "AI-powered career management platform using artificial intelligence. Manage your job search with AI, organize applications, and create tailored resumes and cover letters using advanced AI technology. Chat with AI to refine and improve your documents with intelligent career guidance.",
    images: [
      {
        url: "/images/jobkompass_logo.png",
        width: 1200,
        height: 630,
        alt: "JobKompass - Career Management Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "JobKompass - Career Management Platform",
    description: "Manage your job search, organize applications, and create tailored resumes and cover letters—all in one place.",
    images: ["/images/jobkompass_logo.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    // Add your verification codes here when available
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ConvexAuthNextjsServerProvider>
      <JkConvexProviders>
        <JkAuthProvider>
          <SubscriptionProvider>
            <JobKompassThemeProvider>
              <JkResourcesProvider>
                <JkJobsProvider>
                <JkHelpProvider>
                  <JobKompassResumeProvider>
                    <JobKompassDocumentsProvider>
                      <JobKompassChatWindowProvider>
                        <JkToastProvider>
                      <html lang="en" className={ubuntu.variable}>
                        <body className={`${ubuntu.className} antialiased min-h-screen bg-background text-foreground`}>
                          {children}
                        </body>
                      </html>
                        </JkToastProvider>
                      </JobKompassChatWindowProvider>
                    </JobKompassDocumentsProvider>
                  </JobKompassResumeProvider>
                </JkHelpProvider>
                </JkJobsProvider>
              </JkResourcesProvider>
            </JobKompassThemeProvider>
          </SubscriptionProvider>
        </JkAuthProvider>
      </JkConvexProviders>
    </ConvexAuthNextjsServerProvider>
    );
}
