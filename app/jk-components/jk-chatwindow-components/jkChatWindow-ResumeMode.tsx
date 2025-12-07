'use client'

import JkCW_ResumeForm from "./jkChatWindow-ResumeForm";
import { Button } from "@/components/ui/button";
import { useJobKompassChatWindow } from "@/providers/jkChatWindowProvider";

export default function JkCW_ResumeMode() {
  const { allModes, setCurrentMode } = useJobKompassChatWindow();
  const editorMode = allModes.find(m => m.id === '/resume-editor');
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex h-full max-w-5xl flex-col gap-6 px-6 py-8 sm:px-8">
        <header className="space-y-2 border-b border-border pb-6">
          <div className="flex items-end justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">My Resumes</h1>
              <p className="text-sm text-muted-foreground">
                Keep polished versions ready for different roles. Select a resume to preview, edit, or export.
              </p>
            </div>
            {editorMode && (
              <Button onClick={() => setCurrentMode(editorMode)} variant="default">
                Open Resume Editor
              </Button>
            )}
          </div>
        </header>

        <JkCW_ResumeForm />

      </div>
    </div>
  );
}