'use client'

/**
 * New chat (D01 desktop, M03 phone): the night-voyage painting as a band, a greeting
 * that changes each visit ("What's the next move, {first name}?"), the composer, four action cards that start real flows, and the context
 * counts. Phone shows three cards and no counts, as M03 does.
 */
import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import JkArt from "../jkArt";
import { JkJobLogo } from "../jk-jobs/jkJobBits";
import JkInputSection from "../jkInputSection";
import { useJobs } from "@/providers/jkJobsProvider";
import { useJobKompassDocuments } from "@/providers/jkDocumentsProvider";
import { useJobKompassResume } from "@/providers/jkResumeProvider";
import { cn } from "@/lib/utils";

export type JkChatAction = "tailor" | "save" | "letter" | "prep";

const CARDS: { id: JkChatAction; tick: string; title: string; sub: string; subPhone?: string; phone: boolean }[] = [
  { id: "tailor", tick: "bg-bar-1", title: "Tailor a resume", sub: "to a job in My Jobs", phone: true },
  { id: "save", tick: "bg-bar-2", title: "Save a job", sub: "from a link or pasted text", subPhone: "from a link", phone: true },
  { id: "letter", tick: "bg-bar-3", title: "Write a cover letter", sub: "for a job you applied to", phone: true },
  { id: "prep", tick: "bg-bar-4", title: "Build a prep deck", sub: "pitch, flashcards, questions", phone: false },
];

/**
 * New-chat greetings. One is picked at random each time the screen opens, never the
 * same one twice in a row. Keep each line to about 21 characters so it fits one line
 * on a phone, where the name sits on the line below.
 */
const GREETINGS: { text: string; end: "?" | "." }[] = [
  { text: "What's the next move", end: "?" },
  { text: "Which role is next", end: "?" },
  { text: "Where are we applying", end: "?" },
  { text: "What are we landing", end: "?" },
  { text: "Ready for an offer", end: "?" },
  { text: "Let's get you hired", end: "." },
];
const GREETING_KEY = "jk:lastChatGreeting";

/** A random greeting index that differs from the one shown last time. */
function pickGreeting(): number {
  let last = -1;
  try {
    last = Number.parseInt(window.localStorage.getItem(GREETING_KEY) ?? "", 10);
  } catch {}
  let next = Math.floor(Math.random() * GREETINGS.length);
  if (next === last) next = (next + 1) % GREETINGS.length;
  try {
    window.localStorage.setItem(GREETING_KEY, String(next));
  } catch {}
  return next;
}

/** "itwela ibomu" -> "Itwela" */
export function jkFirstName(name?: string | null) {
  const first = (name ?? "").trim().split(/\s+/)[0] ?? "";
  return first ? first[0].toUpperCase() + first.slice(1) : "";
}

export default function JkChatHero({ firstName, onAction, busy }: { firstName: string; onAction: (a: JkChatAction) => void; busy?: boolean }) {
  const { allJobs } = useJobs();
  const { resumeList, coverLetterList } = useJobKompassDocuments();
  // Picked after mount so the server and the browser never disagree on the text.
  const [greeting, setGreeting] = useState<number | null>(null);
  useEffect(() => setGreeting(pickGreeting()), []);
  const line = GREETINGS[greeting ?? 0];
  const counts = [
    { tick: "bg-bar-2", n: resumeList.length, label: "resumes" },
    { tick: "bg-bar-3", n: coverLetterList.length, label: "cover letters" },
    { tick: "bg-bar-4", n: allJobs.length, label: "jobs" },
  ];
  return (
    <div className="relative">
      {/* Painting band: 250px on phones, 380px from sm; the copy starts where it dissolves. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[250px] overflow-hidden sm:h-[380px]">
        <JkArt name="hero" variant="section" fade="none" position="62% 58%" />
        <div className="absolute inset-x-0 top-0 h-[120px] bg-gradient-to-b from-background/70 to-transparent max-sm:hidden" />
        <div className="absolute inset-x-0 bottom-0 h-[121px] bg-gradient-to-b from-transparent to-background sm:h-[200px]" />
      </div>

      <div data-enter className="relative mx-auto w-full max-w-[880px] px-5 pb-8 pt-[268px] @container sm:px-5 sm:pt-[377px]">
        <p className="jk-enter flex items-center gap-[11px] font-mono text-[11px] uppercase leading-[15px] tracking-[0.13em] text-muted-foreground" style={{ "--i": 0 } as React.CSSProperties}>
          <span aria-hidden className="h-[14px] w-[3px] rounded-full bg-plan" />
          New chat
        </p>
        <h1 aria-hidden={greeting === null} className="jk-enter mt-3 text-[34px] font-medium leading-[38px] tracking-[-0.8px] text-foreground sm:mt-2 sm:text-[48px] sm:leading-[57px] sm:tracking-[-1.1px]" style={{ "--i": 1, visibility: greeting === null ? "hidden" : undefined } as React.CSSProperties}>
          {line.text}{firstName ? <>,<br className="sm:hidden" /> {firstName}{line.end}</> : line.end}
        </h1>
        <p className="jk-enter mt-[6px] hidden text-[16px] leading-[19px] text-muted-foreground sm:block" style={{ "--i": 2 } as React.CSSProperties}>
          Paste a posting, ask for a resume, or pick up a job you already saved.
        </p>

        {/* Desktop: composer, then cards. Phone: cards, then composer (M03). One composer, reordered. */}
        <div className="flex flex-col">
        <div className="jk-enter order-2 mt-[18px] sm:order-1 sm:mt-7" style={{ "--i": 3 } as React.CSSProperties}>
          <JkInputSection variant="hero" busy={busy} />
        </div>

        <div className="jk-enter order-1 mt-[22px] sm:order-2 grid grid-cols-1 gap-2 sm:mt-7 sm:grid-cols-2 sm:gap-3 @[760px]:grid-cols-4" style={{ "--i": 4 } as React.CSSProperties}>
          {CARDS.map((c) => (
            <button key={c.id} type="button" onClick={() => onAction(c.id)}
              className={cn(
                "group rounded-[16px] border border-border bg-card px-4 text-left transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-input sm:rounded-[18px] sm:px-[18px] sm:pb-[18px] sm:pt-5",
                "flex h-[52px] items-center gap-[13px] sm:block sm:h-[84px]",
                !c.phone && "max-sm:hidden",
              )}>
              <span aria-hidden className={cn("h-[14px] w-[3px] shrink-0 rounded-full sm:hidden", c.tick)} />
              <span className="hidden items-center gap-[9px] sm:flex">
                <span aria-hidden className={cn("h-[14px] w-[3px] rounded-full", c.tick)} />
                <span className="font-mono text-[11px] leading-[15px] tracking-[0.11em] text-subtle-foreground">0{CARDS.indexOf(c) + 1}</span>
              </span>
              <span className="min-w-0 flex-1 truncate text-[15px] font-medium leading-[18px] text-foreground sm:mt-[7px] sm:block">{c.title}</span>
              <span className="shrink-0 text-[12px] leading-[14px] text-subtle-foreground sm:mt-[3px] sm:block">
                <span className="sm:hidden">{c.subPhone ?? c.sub}</span>
                <span className="hidden sm:inline">{c.sub}</span>
              </span>
            </button>
          ))}
        </div>

        <div className="jk-enter order-3 mt-[42px] hidden flex-wrap items-center gap-x-[38px] gap-y-3 sm:flex" style={{ "--i": 5 } as React.CSSProperties}>
          <span className="font-mono text-[10px] font-medium uppercase leading-[13px] tracking-[0.16em] text-subtle-foreground">Context</span>
          {counts.map((c) => (
            <span key={c.label} className="flex items-center gap-[9px]">
              <span aria-hidden className={cn("h-3 w-[3px] rounded-full", c.tick)} />
              <span className="font-mono text-[13px] font-medium leading-[17px] text-foreground">{c.n}</span>
              <span className="text-[13px] leading-[15px] text-muted-foreground">{c.label}</span>
            </span>
          ))}
        </div>
        </div>
      </div>
    </div>
  );
}

/** Pick a saved job to tailor a resume to, write a letter for, or prep. */
export function JkChatJobPicker({ open, title, onPick, onClose, onSaveJob }: { open: boolean; title: string; onPick: (jobId: string) => void; onClose: () => void; onSaveJob: () => void }) {
  const { allJobs } = useJobs();
  const [q, setQ] = useState("");
  const jobs = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return allJobs.filter((j) => !needle || `${j.title} ${j.company}`.toLowerCase().includes(needle));
  }, [allJobs, q]);
  if (!open) return null;
  return createPortal(
    
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-scrim p-0 sm:items-center sm:p-6" onClick={onClose}>
      <div role="dialog" aria-modal aria-label={title} onClick={(e) => e.stopPropagation()}
        className="flex max-h-[80dvh] w-full max-w-[520px] flex-col overflow-hidden rounded-t-[24px] border border-input bg-card sm:rounded-[24px]">
        <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-5">
          <p className="text-[18px] font-medium tracking-[-0.2px] text-foreground">{title}</p>
          <button type="button" onClick={onClose} aria-label="Close" className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"><X className="size-4" /></button>
        </div>
        {allJobs.length > 6 && (
          <label className="mx-5 mb-2 flex h-11 items-center gap-2 rounded-[14px] border border-input bg-popover px-3">
            <Search className="size-4 text-subtle-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a job" className="min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-subtle-foreground" />
          </label>
        )}
        <div className="chat-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          {allJobs.length === 0 ? (
            <div className="px-3 py-8 text-center">
              <p className="text-[14px] text-muted-foreground">No saved jobs yet.</p>
              <button type="button" onClick={onSaveJob} className="mt-3 text-[14px] font-medium text-foreground underline underline-offset-4">Save a job first</button>
            </div>
          ) : jobs.map((j) => (
            <button key={j._id} type="button" onClick={() => onPick(String(j._id))} className="flex w-full items-center gap-3 rounded-[14px] px-3 py-[10px] text-left transition-colors hover:bg-accent">
              <JkJobLogo company={j.company} link={j.link} size={32} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14.5px] leading-[18px] text-foreground">{j.title}</span>
                <span className="block truncate font-mono text-[11px] leading-[15px] text-subtle-foreground">{[j.company, j.status].filter(Boolean).join(" · ")}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** The base resume a tailoring starts from: the active one, else the newest with content. */
export function useBaseResumeId() {
  const { resumes } = useJobKompassResume();
  const list = (resumes ?? []) as any[];
  const base = list.find((r) => r.isActive && r.content) ?? [...list].filter((r) => r.content).sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))[0];
  return base?._id as string | undefined;
}
