import type { Metadata } from "next";
import { JobKompassThemeProvider } from "@/providers/jkThemeProvider";
import "./globals.css";
import { JobKompassChatWindowProvider } from "@/providers/jkChatWindowProvider";
import JobKompassResumeProvider from "@/providers/jkResumeProvider";

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
    <JobKompassThemeProvider>
      <JobKompassResumeProvider>

        <JobKompassChatWindowProvider>
          <html lang="en">
            <body
              className={`antialiased`}
            >
              {children}
            </body>
          </html>
        </JobKompassChatWindowProvider>
      </JobKompassResumeProvider>
    </JobKompassThemeProvider>
  );
}
