'use client'

import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useJobKompassChatWindow } from "@/providers/jkChatWindowProvider";
import { useJobKompassResume } from "@/providers/jkResumeProvider";
import { useJobs } from "@/providers/jkJobsProvider";
import JkContextPanel from "./jkContextPanel";
import { useCallback, useState } from "react";
import { Send, Plus, FileText, Briefcase, X } from "lucide-react";

interface JkInputSectionProps {
  hideFileUpload?: boolean;
  hideContextMenu?: boolean;
  placeholder?: string;
  onSend?: (value: string) => void;
  value?: string;
  onChange?: (value: string) => void;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
}

export default function JkInputSection({
  hideFileUpload = false,
  hideContextMenu = false,
  placeholder,
  onSend,
  value: controlledValue,
  onChange: controlledOnChange,
  textareaRef: externalTextareaRef,
}: JkInputSectionProps = {}) {
  const { 
    textareaRef: contextTextareaRef, textValue, setTextValue,
    allModes, currentMode, setCurrentMode,
    isFileMode, setIsFileMode, droppedFile, setDroppedFile, fileName, setFileName,
    attachedResumeIds, attachedJobIds, removeResumeAttachment, removeJobAttachment,
    setIsFileModalOpen
  } = useJobKompassChatWindow();
  
  const { resumes } = useJobKompassResume();
  const { allJobs } = useJobs();

  // Use external ref if provided, otherwise use context ref
  const textareaRef = externalTextareaRef || contextTextareaRef;
  
  // Use controlled value if provided, otherwise use context value
  const inputValue = controlledValue !== undefined ? controlledValue : textValue;
  const setInputValue = controlledOnChange || setTextValue;

  const [isDragOver, setIsDragOver] = useState(false);

  // File drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [setDroppedFile, setFileName, setIsFileMode, setCurrentMode, allModes]);

  const handleFileSelect = useCallback((file: File) => {
    setDroppedFile(file);
    setFileName(file.name);
    setIsFileMode(true);
    // Switch to file mode
    const fileMode = allModes.find(mode => mode.id === '/file');
    if (fileMode) {
      setCurrentMode(fileMode);
    }
  }, [setDroppedFile, setFileName, setIsFileMode, setCurrentMode, allModes]);

  const clearFile = useCallback(() => {
    setDroppedFile(null);
    setFileName(null);
    setIsFileMode(false);
  }, [setDroppedFile, setFileName, setIsFileMode]);

  const handleSend = useCallback(() => {
    if (onSend && inputValue.trim().length > 2) {
      onSend(inputValue);
    } else if (currentMode.id === '/chat' && inputValue.trim().length > 2) {
      window.dispatchEvent(new Event('jk:sendChat'));
    }
  }, [onSend, inputValue, currentMode]);

  return (
    <div className="relative w-full">
      {/* CONTEXT PANEL - Shows user's resumes and jobs */}
      {!hideContextMenu && <JkContextPanel />}
      
      {/* Main Input Container */}
      <div 
        className={`
          relative w-full rounded-2xl border border-border bg-card
          transition-all duration-200 ease-out
          ${isDragOver ? 'border-primary bg-muted/50' : ''}
          ${textValue ? 'shadow-lg' : 'shadow-sm'}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Drag Overlay */}
        {isDragOver && (
          <div className="absolute inset-0 flex items-center justify-center bg-primary/5 rounded-2xl z-10 pointer-events-none">
            <div className="text-lg font-medium text-primary">Drop file here to switch to File Mode</div>
          </div>
        )}

        {/* File Mode Indicator & Context Attachments */}
        {((isFileMode || fileName) || attachedResumeIds.length > 0 || attachedJobIds.length > 0) && (
          <div className="px-4 pt-3 pb-2 flex flex-wrap items-center gap-2">
            {/* File attachment */}
            {fileName ? (
              <div className="inline-flex items-center gap-2 px-2 py-1 text-xs bg-accent rounded-md">
                <span>📄 {fileName}</span>
                <button 
                  onClick={clearFile}
                  className="hover:bg-background/20 rounded px-1 transition-colors"
                  aria-label="Remove file"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : isFileMode && (
              <div className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-primary text-primary-foreground rounded-md">
                📁 File Mode
              </div>
            )}

            {/* Resume attachments */}
            {attachedResumeIds.map((resumeId) => {
              const resume = resumes?.find((r: any) => r._id === resumeId);
              if (!resume) return null;
              return (
                <div 
                  key={resumeId}
                  className="inline-flex items-center gap-2 px-2 py-1 text-xs bg-primary/10 text-primary border border-primary/20 rounded-md"
                >
                  <FileText className="h-3 w-3" />
                  <span>{resume.name || `Resume ${resumeId.slice(-6)}`}</span>
                  <button 
                    onClick={() => removeResumeAttachment(resumeId)}
                    className="hover:bg-primary/20 rounded px-1 transition-colors"
                    aria-label="Remove resume"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })}

            {/* Job attachments */}
            {attachedJobIds.map((jobId) => {
              const job = allJobs?.find((j: any) => j._id === jobId);
              if (!job) return null;
              return (
                <div 
                  key={jobId}
                  className="inline-flex items-center gap-2 px-2 py-1 text-xs bg-primary/10 text-primary border border-primary/20 rounded-md"
                >
                  <Briefcase className="h-3 w-3" />
                  <span>{job.title} @ {job.company}</span>
                  <button 
                    onClick={() => removeJobAttachment(jobId)}
                    className="hover:bg-primary/20 rounded px-1 transition-colors"
                    aria-label="Remove job"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Input Area with inline controls */}
        <div className="flex items-end gap-2 px-2 py-3">
          <div className="flex items-center gap-4 flex-1">
            {!hideFileUpload && (
              <Button 
                size="icon"
                variant="ghost"
                onClick={() => setIsFileModalOpen(true)}
                className="h-7 w-7 text-muted-foreground hover:text-foreground shrink-0"
                aria-label="Add file"
              >
                <Plus className="h-4 w-4" />
              </Button>
            )}
            
            <div className="flex-1 min-w-0">
              <Textarea
                ref={textareaRef}
                placeholder={placeholder || (isFileMode && !hideFileUpload
                  ? "Describe what you want to do with the file..." 
                  : "Send a message...")}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                aria-label="Message input"
                rows={1}
                className="min-h-[40px] max-h-[200px] resize-none border-0 shadow-none focus-visible:ring-0 focus-visible:outline-none px-0 pt-3 text-base leading-relaxed"
                style={{ fieldSizing: 'content' } as any}
              />
            </div>
            
          </div>
          { inputValue.trim().length > 2 && (
          <Button 
            size="icon"
            className="h-9 w-9 rounded-full bg-primary hover:bg-primary/90 disabled:opacity-40 transition-all shrink-0"
            onClick={handleSend}
            aria-label="Send message"
            disabled={inputValue.trim().length <= 2}
          >
            <Send className="h-4 w-4" />
          </Button>
          )}
        </div>
      </div>
    </div>
  )

}
