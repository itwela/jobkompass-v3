import type { Metadata } from "next";
import { JobKompassThemeProvider } from "@/providers/jkThemeProvider";
import "./globals.css";
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

export const metadata: Metadata = {
  title: "Jobkompass - A Kompass Product",
  description: "Created by Itwela Ibomu",
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
          <JobKompassThemeProvider>
            <JkResourcesProvider>
              <JkJobsProvider>
              <JkHelpProvider>
                <JobKompassResumeProvider>
                  <JobKompassDocumentsProvider>
                    <JobKompassChatWindowProvider>
                      <JkToastProvider>
                      <html lang="en">
                        <body className={`antialiased min-h-screen bg-background text-foreground`}>
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
        </JkAuthProvider>
      </JkConvexProviders>
    </ConvexAuthNextjsServerProvider>
    );
}
