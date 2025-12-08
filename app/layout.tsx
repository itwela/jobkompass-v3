import type { Metadata } from "next";
import { JobKompassThemeProvider } from "@/providers/jkThemeProvider";
import "./globals.css";
import { JobKompassChatWindowProvider } from "@/providers/jkChatWindowProvider";
import JobKompassResumeProvider from "@/providers/jkResumeProvider";
import { JkConvexProviders } from "@/providers/jkConvexProvider";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import { JkAuthProvider } from "@/providers/jkAuthProvider";
import { JkResourcesProvider } from "@/providers/jkResourcesProvider";
import { JkJobsProvider } from "@/providers/jkJobsProvider";

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
                <JobKompassResumeProvider>
                  <JobKompassChatWindowProvider>
                    <html lang="en">
                      <body className={`antialiased min-h-screen bg-background text-foreground`}>
                        {children}
                      </body>
                    </html>
                  </JobKompassChatWindowProvider>
                </JobKompassResumeProvider>
              </JkJobsProvider>
            </JkResourcesProvider>
          </JobKompassThemeProvider>
        </JkAuthProvider>
      </JkConvexProviders>
    </ConvexAuthNextjsServerProvider>
  );
}
