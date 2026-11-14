'use client'

/**
 * The chat composer (D01, D02, M03, M04).
 * - variant "hero": the new-chat box. Desktop: 112px, text on top, + / context chips / send below.
 *   Phone: the same 56px pill as "dock".
 * - variant "dock": the pill under a conversation, with the Context row above it (sm+).
 * "+" opens the context picker (resumes, letters, jobs, file upload).
 */
import { Textarea } from "@/components/ui/textarea";
import { useJobKompassChatWindow } from "@/providers/jkChatWindowProvider";
import JkContextPanel, { JkContextChips } from "./jkContextPanel";
import { useCallback, useState } from "react";
import { ArrowUp, ChevronDown, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface JkInputSectionProps {
  hideFileUpload?: boolean;
  hideContextMenu?: boolean;
  placeholder?: string;
  onSend?: (value: string) => void;
  value?: string;
  onChange?: (value: string) => void;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
  variant?: "hero" | "dock";
  /** Disables sending (e.g. while a reply is being written). */
  busy?: boolean;
}

function RoundPlus({ onClick, open }: { onClick: () => void; open: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-label={open ? "Close context" : "Add context or a file"} aria-expanded={open}
      className="flex size-[30px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-input text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground">
      <Plus className={cn("size-[13px] transition-transform", open && "rotate-45")} strokeWidth={1.75} />
    </button>
  );
}

function SendButton({ onClick, disabled, busy }: { onClick: () => void; disabled: boolean; busy?: boolean }) {
  // Stays solid while the box is empty (as the frames show it); dims only while a reply is written.
  return (
    <button type="button" onClick={onClick} aria-disabled={disabled} disabled={busy} aria-label="Send message"
      className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40">
      <ArrowUp className="size-[15px]" strokeWidth={1.75} />
    </button>
  );
}

export default function JkInputSection({
  hideFileUpload = false,
  hideContextMenu = false,
  placeholder,
  onSend,
  value: controlledValue,
  onChange: controlledOnChange,
  textareaRef: externalTextareaRef,
  variant = "dock",
  busy = false,
}: JkInputSectionProps = {}) {
  const {
    textareaRef: contextTextareaRef, textValue, setTextValue,
    allModes, currentMode, setCurrentMode,
    isFileMode, setIsFileMode, setDroppedFile, fileName, setFileName,
    attachedResumeIds, attachedJobIds, attachedCoverLetterIds,
    setIsFileModalOpen,
  } = useJobKompassChatWindow();

  const textareaRef = externalTextareaRef || contextTextareaRef;
  const inputValue = controlledValue !== undefined ? controlledValue : textValue;
  const setInputValue = controlledOnChange || setTextValue;

  const [isDragOver, setIsDragOver] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const closePicker = useCallback(() => setPickerOpen(false), []);
  const hasAttachments = attachedResumeIds.length + attachedJobIds.length + attachedCoverLetterIds.length > 0;
  const canSend = inputValue.trim().length > 2 && !busy;

  const handleFileSelect = useCallback((file: File) => {
    setDroppedFile(file);
    setFileName(file.name);
    setIsFileMode(true);
    const fileMode = allModes.find(mode => mode.id === '/file');
    if (fileMode) setCurrentMode(fileMode);
  }, [setDroppedFile, setFileName, setIsFileMode, setCurrentMode, allModes]);

  const clearFile = useCallback(() => {
    setDroppedFile(null);
    setFileName(null);
    setIsFileMode(false);
  }, [setDroppedFile, setFileName, setIsFileMode]);

  const handleSend = useCallback(() => {
    if (!canSend) return;
    if (onSend) onSend(inputValue);
    else if (currentMode.id === '/chat') window.dispatchEvent(new Event('jk:sendChat'));
  }, [onSend, inputValue, currentMode, canSend]);

  const togglePicker = () => {
    if (hideContextMenu) { if (!hideFileUpload) setIsFileModalOpen(true); return; }
    setPickerOpen((o) => !o);
  };

  const dropHandlers = {
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); },
    onDragLeave: (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(false); },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault(); e.stopPropagation(); setIsDragOver(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0 && !hideFileUpload) handleFileSelect(files[0]);
    },
  };

  const textarea = (className: string) => (
    <Textarea
      ref={textareaRef}
      placeholder={placeholder || (isFileMode && !hideFileUpload ? "Describe what you want to do with the file..." : "Send a message...")}
      value={inputValue}
      onChange={(e) => setInputValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
      }}
      aria-label="Message input"
      rows={1}
      className={cn("max-h-[200px] resize-none rounded-none border-0 bg-transparent p-0 text-[15px] leading-[20px] text-foreground shadow-none placeholder:text-subtle-foreground focus-visible:ring-0 focus-visible:outline-none dark:bg-transparent", className)}
      style={{ fieldSizing: 'content' } as React.CSSProperties}
    />
  );

  const fileChip = fileName ? (
    <span className="inline-flex h-[26px] items-center gap-2 rounded-full border border-input bg-popover px-3 text-[12.5px] font-medium text-muted-foreground">
      <span aria-hidden className="h-3 w-[3px] rounded-full bg-bar-1" />
      <span className="max-w-[200px] truncate">File · {fileName}</span>
      <button type="button" onClick={clearFile} aria-label="Remove file" className="text-subtle-foreground hover:text-foreground"><X className="size-3" /></button>
    </span>
  ) : null;

  const picker = !hideContextMenu && <JkContextPanel open={pickerOpen} onClose={closePicker} />;

  if (variant === "hero") {
    return (
      <div className="relative w-full" {...dropHandlers}>
        {picker}
        <div data-drag={isDragOver ? "" : undefined}
          className="w-full rounded-[28px] border border-input bg-card px-[13px] py-[10px] transition-colors data-[drag]:border-bar-3 sm:min-h-[112px] sm:rounded-[24px] sm:px-6 sm:pb-[15px] sm:pt-[21px]">
          {/* Phone: one row. Desktop: text on top, controls below. */}
          <div className="flex items-center gap-[13px] sm:hidden">
            <RoundPlus onClick={togglePicker} open={pickerOpen} />
            <div className="min-w-0 flex-1 py-[8px]">{textarea("min-h-[20px]")}</div>
            <SendButton onClick={handleSend} disabled={!canSend} busy={busy} />
          </div>
          {(hasAttachments || fileName) && (
            <div className="mt-2 flex flex-wrap gap-2 sm:hidden">{fileChip}<JkContextChips /></div>
          )}
          <div className="hidden sm:block">
            {textarea("min-h-[22px] text-[16px] leading-[22px]")}
            <div className="mt-[19px] flex items-center gap-[11px]">
              <span className="ml-px"><RoundPlus onClick={togglePicker} open={pickerOpen} /></span>
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-[10px]">{fileChip}<JkContextChips /></div>
              <SendButton onClick={handleSend} disabled={!canSend} busy={busy} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full" {...dropHandlers}>
      {picker}
      {!hideContextMenu && (
        <div className="mb-3 hidden h-11 w-full items-center gap-[14px] rounded-[14px] border border-border bg-card pl-5 pr-3 sm:flex">
          <button type="button" onClick={() => setPickerOpen((o) => !o)} aria-expanded={pickerOpen} className="flex shrink-0 items-center gap-[14px] self-stretch">
            <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", pickerOpen && "rotate-180")} strokeWidth={1.75} />
            <span className="text-[14px] font-medium text-foreground">Context</span>
          </button>
          {hasAttachments ? (
            <JkContextChips className="min-w-0 flex-1 flex-nowrap overflow-hidden" />
          ) : (
            <button type="button" onClick={() => setPickerOpen(true)} className="min-w-0 flex-1 self-stretch truncate text-left text-[12.5px] text-subtle-foreground hover:text-muted-foreground">Attach a resume or a job</button>
          )}
        </div>
      )}
      <div data-drag={isDragOver ? "" : undefined}
        className="w-full rounded-[28px] border border-input bg-card px-[13px] py-[10px] transition-colors data-[drag]:border-bar-3">
        {fileName && <div className="mb-2 flex flex-wrap gap-2 px-1">{fileChip}</div>}
        {hasAttachments && !hideContextMenu && <div className="mb-2 flex flex-wrap gap-2 px-1 sm:hidden"><JkContextChips /></div>}
        <div className="flex items-center gap-[13px]">
          {(!hideFileUpload || !hideContextMenu) && <RoundPlus onClick={togglePicker} open={pickerOpen} />}
          <div className="min-w-0 flex-1 py-[8px]">{textarea("min-h-[20px]")}</div>
          <SendButton onClick={handleSend} disabled={!canSend} busy={busy} />
        </div>
      </div>
    </div>
  );
}
