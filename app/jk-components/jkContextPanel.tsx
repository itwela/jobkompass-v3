'use client'

/**
 * Chat context: what the next message can see (D01 / D02).
 * - JkContextChip: one attached item, "Resume · Software Engineer, base" with a logo-colour tick.
 * - JkContextChips: every attached resume, cover letter and job as chips.
 * - JkContextPanel (default): the picker that opens above the composer to attach items.
 */
import { useEffect, useState } from "react";
import { Check, Upload, X } from "lucide-react";
import { useJobKompassResume } from "@/providers/jkResumeProvider";
import { useJobKompassDocuments } from "@/providers/jkDocumentsProvider";
import { useJobs } from "@/providers/jkJobsProvider";
import { useJobKompassChatWindow } from "@/providers/jkChatWindowProvider";
import JkSegmented from "./jk-app/jkSegmented";
import { JkJobLogo } from "./jk-jobs/jkJobBits";
import { cn } from "@/lib/utils";

type Tone = "bar-2" | "bar-3" | "bar-4";
const TICK: Record<Tone, string> = { "bar-2": "bg-bar-2", "bar-3": "bg-bar-3", "bar-4": "bg-bar-4" };

export function JkContextChip({ tone, label, onRemove, className }: { tone: Tone; label: string; onRemove?: () => void; className?: string }) {
  return (
    <span className={cn("group inline-flex h-[26px] min-w-0 max-w-full shrink items-center gap-[10px] rounded-full border border-input bg-popover pl-3 pr-[14px]", className)}>
      <span aria-hidden className={cn("h-3 w-[3px] shrink-0 rounded-full", TICK[tone])} />
      <span className="truncate text-[12.5px] font-medium leading-[15px] text-muted-foreground">{label}</span>
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label={`Remove ${label}`} className="-mr-1.5 flex size-4 shrink-0 items-center justify-center rounded-full text-subtle-foreground hover:text-foreground">
          <X className="size-3" />
        </button>
      )}
    </span>
  );
}

/** "Job · PTC GTM AI": company first, then the title, short enough for a chip. */
export function jobChipLabel(job: { company?: string; title?: string }) {
  return `Job · ${[job.company, job.title].filter(Boolean).join(" ")}`;
}

export function JkContextChips({ removable = true, className }: { removable?: boolean; className?: string }) {
  const { resumes } = useJobKompassResume();
  const { coverLetterList } = useJobKompassDocuments();
  const { allJobs } = useJobs();
  const { attachedResumeIds, attachedCoverLetterIds, attachedJobIds, removeResumeAttachment, removeCoverLetterAttachment, removeJobAttachment } = useJobKompassChatWindow();
  const chips: React.ReactNode[] = [];
  attachedResumeIds.forEach((id) => {
    const r = resumes?.find((x: any) => x._id === id);
    if (r) chips.push(<JkContextChip key={id} tone="bar-2" label={`Resume · ${r.name || "Untitled"}`} onRemove={removable ? () => removeResumeAttachment(id) : undefined} />);
  });
  attachedCoverLetterIds.forEach((id) => {
    const c = coverLetterList?.find((x: any) => x._id === id);
    if (c) chips.push(<JkContextChip key={id} tone="bar-3" label={`Letter · ${c.name || "Untitled"}`} onRemove={removable ? () => removeCoverLetterAttachment(id) : undefined} />);
  });
  attachedJobIds.forEach((id) => {
    const j = allJobs?.find((x: any) => x._id === id);
    if (j) chips.push(<JkContextChip key={id} tone="bar-4" label={jobChipLabel(j)} onRemove={removable ? () => removeJobAttachment(id) : undefined} />);
  });
  if (!chips.length) return null;
  return <div className={cn("flex min-w-0 flex-wrap items-center gap-2", className)}>{chips}</div>;
}

type Tab = "resumes" | "coverLetters" | "jobs";

/** Picker for what the next message can see. Opens above the composer. */
export default function JkContextPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("resumes");
  const { resumes } = useJobKompassResume();
  const { coverLetterList } = useJobKompassDocuments();
  const { allJobs } = useJobs();
  const {
    attachedResumeIds, attachedCoverLetterIds, attachedJobIds,
    addResumeAttachment, removeResumeAttachment, addCoverLetterAttachment, removeCoverLetterAttachment,
    addJobAttachment, removeJobAttachment, setIsFileModalOpen,
  } = useJobKompassChatWindow();

  // Close when a message is sent or Escape is pressed.
  useEffect(() => {
    if (!open) return;
    const close = () => onClose();
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("jk:sendChat", close);
    window.addEventListener("keydown", key);
    return () => { window.removeEventListener("jk:sendChat", close); window.removeEventListener("keydown", key); };
  }, [open, onClose]);

  if (!open) return null;

  // Newest activity first (edited, else created); the base resume always leads.
  const when = (d: any) => d.updatedAt ?? d.createdAt ?? d._creationTime ?? 0;
  const recent = (list: any[] | undefined | null) => [...(list ?? [])].sort((x, y) => when(y) - when(x));
  const resumeRows = recent(resumes).sort((x, y) => Number(!!y.isActive) - Number(!!x.isActive)).map((r: any) => ({ id: r._id, title: r.name || "Untitled", sub: r.isActive ? "Base resume" : new Date(when(r)).toLocaleDateString(), base: !!r.isActive, on: attachedResumeIds.includes(r._id), toggle: () => (attachedResumeIds.includes(r._id) ? removeResumeAttachment(r._id) : addResumeAttachment(r._id)) }));
  const letterRows = recent(coverLetterList).map((c: any) => ({ id: c._id, title: c.name || "Untitled", sub: new Date(when(c)).toLocaleDateString(), on: attachedCoverLetterIds.includes(c._id), toggle: () => (attachedCoverLetterIds.includes(c._id) ? removeCoverLetterAttachment(c._id) : addCoverLetterAttachment(c._id)) }));
  const jobRows = (allJobs ?? []).map((j: any) => ({ id: j._id, title: j.title, sub: [j.company, j.status].filter(Boolean).join(" · "), company: j.company, link: j.link, on: attachedJobIds.includes(j._id), toggle: () => (attachedJobIds.includes(j._id) ? removeJobAttachment(j._id) : addJobAttachment(j._id)) }));
  const rows = tab === "resumes" ? resumeRows : tab === "coverLetters" ? letterRows : jobRows;
  const empty = tab === "resumes" ? "No resumes yet." : tab === "coverLetters" ? "No cover letters yet." : "No saved jobs yet.";

  return (
    <div className="absolute inset-x-0 bottom-[calc(100%+8px)] z-30 overflow-hidden rounded-[20px] border border-input bg-card shadow-2xl">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <JkSegmented<Tab>
          size="sm"
          ariaLabel="Context type"
          value={tab}
          onChange={setTab}
          options={[
            { value: "resumes", label: `Resumes ${resumeRows.length}` },
            { value: "coverLetters", label: `Letters ${letterRows.length}` },
            { value: "jobs", label: `Jobs ${jobRows.length}` },
          ]}
        />
        <button type="button" onClick={onClose} aria-label="Close context" className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground">
          <X className="size-4" />
        </button>
      </div>
      <div className="chat-scroll max-h-[min(300px,45dvh)] overflow-y-auto p-2">
        {rows.length === 0 && <p className="px-3 py-6 text-center text-[13px] text-muted-foreground">{empty}</p>}
        {rows.map((row: any) => (
          <button key={row.id} type="button" onClick={row.toggle} data-on={row.on ? "" : undefined}
            className="flex w-full items-center gap-3 rounded-[12px] px-3 py-[9px] text-left transition-colors hover:bg-accent data-[on]:bg-accent">
            {tab === "jobs" ? <JkJobLogo company={row.company || row.title} link={row.link} size={24} /> : <span aria-hidden className={cn("h-4 w-[3px] shrink-0 rounded-full", row.base ? "bg-plan" : tab === "resumes" ? "bg-bar-2" : "bg-bar-3")} />}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] leading-[18px] text-foreground">{row.title}</span>
              <span className={cn("block truncate font-mono text-[11px] leading-[15px]", row.base ? "text-plan-text" : "text-subtle-foreground")}>{row.sub}</span>
            </span>
            {row.on && <Check className="size-4 shrink-0 text-bar-3" />}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-[10px]">
        <p className="text-[12px] text-subtle-foreground">Attached items are read with your next message.</p>
        <button type="button" onClick={() => { onClose(); setIsFileModalOpen(true); }} className="inline-flex shrink-0 items-center gap-1.5 text-[12.5px] font-medium text-muted-foreground hover:text-foreground">
          <Upload className="size-3.5" /> Upload a file
        </button>
      </div>
    </div>
  );
}
