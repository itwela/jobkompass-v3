'use client'

/**
 * D04 command bar: "> Ask JobKompass or type a command", the person's real context counts and ⌘K.
 * Enter sends the text into a new chat (the page does the routing).
 */
import { forwardRef, useState } from "react";
import { cn } from "@/lib/utils";

const JkJobsCommandBar = forwardRef<HTMLInputElement, {
  counts: { resumes: number; letters: number; jobs: number };
  onSubmit: (text: string) => void;
  onEscape?: () => void;
  className?: string;
}>(function JkJobsCommandBar({ counts, onSubmit, onEscape, className }, ref) {
  const [value, setValue] = useState("");
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); const t = value.trim(); if (t.length > 1) { onSubmit(t); setValue(""); } }}
      className={cn("flex h-12 items-center gap-3 rounded-full border border-input bg-card pl-[22px] pr-[18px] shadow-[0_10px_40px_-12px_var(--scrim)] transition-[border-color] focus-within:border-plan", className)}
    >
      <span aria-hidden className="font-mono text-[14px] font-bold text-plan">&gt;</span>
      <input
        ref={ref}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Escape") { e.currentTarget.blur(); onEscape?.(); } }}
        placeholder="Ask JobKompass or type a command"
        aria-label="Ask JobKompass"
        className="min-w-0 flex-1 bg-transparent text-[14.5px] text-foreground outline-none placeholder:text-subtle-foreground"
      />
      <span className="hidden shrink-0 font-mono text-[11.5px] text-subtle-foreground lg:inline">
        {plural(counts.resumes, "resume", "resumes")}, {plural(counts.letters, "cover letter", "cover letters")}, {plural(counts.jobs, "job", "jobs")}
      </span>
      <kbd className="hidden h-5 shrink-0 items-center rounded-md bg-accent px-2 font-mono text-[10.5px] font-medium text-muted-foreground sm:inline-flex">⌘K</kbd>
    </form>
  );
});

export default JkJobsCommandBar;
