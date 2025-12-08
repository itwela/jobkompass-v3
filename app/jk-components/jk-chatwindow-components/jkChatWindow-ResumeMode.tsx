'use client'

import JkCW_ResumeForm from "./jkChatWindow-ResumeForm";

export default function JkCW_ResumeMode() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex h-full max-w-5xl flex-col gap-6 px-6 py-8 sm:px-8">
        <header className="space-y-2 border-b border-border pb-6">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">My Resumes</h1>
            <p className="text-sm text-muted-foreground">
              Upload and manage your resume files. Add labels and tags to organize them.
            </p>
          </div>
        </header>

        <JkCW_ResumeForm />

      </div>
    </div>
  );
}