'use client'

import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useJobKompassChatWindow } from "@/providers/jkChatWindowProvider";
import Jk_AutoFill from "./jk-AutoFill";
import { useCallback, useState } from "react";
import { Send, Plus } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export default function JkInputSection() {
  const { 
    textareaRef, textValue, setTextValue,
    allModes, currentMode, setCurrentMode,
    isFileMode, setIsFileMode, droppedFile, setDroppedFile, fileName, setFileName } = useJobKompassChatWindow()

  const [isDragOver, setIsDragOver] = useState(false)

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
      const file = files[0]; // Take the first file
      setDroppedFile(file);
      setFileName(file.name);
      setIsFileMode(true);
      // Switch to file mode
      const fileMode = allModes.find(mode => mode.id === '/file');
      if (fileMode) {
        setCurrentMode(fileMode);
      }
    }
  }, [setDroppedFile, setFileName, setIsFileMode, setCurrentMode, allModes]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      setDroppedFile(file);
      setFileName(file.name);
      setIsFileMode(true);
      // Switch to file mode
      const fileMode = allModes.find(mode => mode.id === '/file');
      if (fileMode) {
        setCurrentMode(fileMode);
      }
    }
  }, [setDroppedFile, setFileName, setIsFileMode, setCurrentMode, allModes]);

  const clearFile = useCallback(() => {
    setDroppedFile(null);
    setFileName(null);
    setIsFileMode(false);
  }, [setDroppedFile, setFileName, setIsFileMode]);

  return (
    <div className="relative w-full">
      {/* AUTOFILL CONTAINER HELPER */}
      {textValue.includes('/') && (
        <div className="absolute bottom-full left-0 w-full flex justify-center mb-2 z-50">
          <Jk_AutoFill />
        </div>
      )}

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

        {/* File Mode Indicator */}
        {(isFileMode || fileName) && (
          <div className="px-4 pt-3 pb-2 flex items-center gap-2">
            {fileName ? (
              <div className="inline-flex items-center gap-2 px-2 py-1 text-xs bg-accent rounded-md">
                <span>📄 {fileName}</span>
                <button 
                  onClick={clearFile}
                  className="hover:bg-background/20 rounded px-1 transition-colors"
                  aria-label="Remove file"
                >
                  ✕
                </button>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-primary text-primary-foreground rounded-md">
                📁 File Mode
              </div>
            )}
          </div>
        )}

        {/* Input Area with inline controls */}
        <div className="flex items-end gap-2 px-4 py-3">
          <div className="flex items-center gap-4 flex-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground shrink-0"
                  aria-label="Add attachments or options"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="top" className="w-40">
                <DropdownMenuItem 
                  className="cursor-pointer"
                  onClick={() => document.getElementById('file-input')?.click()}
                >
                  Add file
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            <input
              type="file"
              id="file-input"
              className="hidden"
              onChange={handleFileInput}
              accept="*/*"
            />
            
            <div className="flex-1 min-w-0">
              <Textarea
                ref={textareaRef}
                placeholder={isFileMode 
                  ? "Describe what you want to do with the file..." 
                  : "Send a message..."}
                value={textValue}
                onChange={(e) => setTextValue(e.target.value)}
                onKeyDown={(e) => {
                  if (currentMode.id === '/chat' && e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    window.dispatchEvent(new Event('jk:sendChat'))
                  }
                }}
                aria-label="Message input"
                rows={1}
                className="min-h-[40px] max-h-[200px] resize-none border-0 shadow-none focus-visible:ring-0 focus-visible:outline-none px-0 pt-3 text-base leading-relaxed"
                style={{ fieldSizing: 'content' } as any}
              />
            </div>
            
          </div>
          { textValue.trim().length > 2 && (
          <Button 
            size="icon"
            className="h-9 w-9 rounded-full bg-primary hover:bg-primary/90 disabled:opacity-40 transition-all shrink-0"
            onClick={() => {
              if (currentMode.id === '/chat') {
                window.dispatchEvent(new Event('jk:sendChat'))
                return;
              }
            }}
            aria-label="Send message"
            disabled={textValue.trim().length <= 2}
          >
            <Send className="h-4 w-4" />
          </Button>
          )}
        </div>
      </div>
    </div>
  )

}
