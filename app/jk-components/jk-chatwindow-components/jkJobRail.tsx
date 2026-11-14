'use client'

/**
 * D03 right rail: the job the table is focused on (J/K or click). Read-only summary; any row
 * opens the full editor (D05). Actions: Write resume (G), View posting, Prep.
 */
import { cn } from "@/lib/utils";
import { appliedDate } from "@/lib/jkJobs";
import type { Job } from "@/providers/jkJobsProvider";
import { Button } from "@/components/ui/button";
import JkArt from "../jkArt";
import { JkStatusGlyph } from "../jkStatusChip";
import { JkCompBars, JkJobLogo, JkKbd, JkMonoLabel } from "../jk-jobs/jkJobBits";

function Row({ label, children, onClick }: { label: string; children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="grid min-h-10 w-full grid-cols-[150px_minmax(0,1fr)] items-center border-b border-border py-2.5 text-left transition-colors hover:bg-popover/50">
      <JkMonoLabel>{label}</JkMonoLabel>
      <span className="min-w-0">{children}</span>
    </button>
  );
}

export default function JkJobRail({
  job, onOpen, onWriteResume, onPrep, className,
}: {
  job: Job | null;
  onOpen: () => void;
  onWriteResume: () => void;
  onPrep: () => void;
  className?: string;
}) {
  if (!job) {
    return (
      <aside className={cn("flex flex-col items-center justify-center px-8 text-center", className)}>
        <p className="text-[14px] text-muted-foreground">Pick a job to see it here.</p>
        <p className="mt-2 flex items-center gap-1.5 text-[12.5px] text-subtle-foreground"><JkKbd>J</JkKbd><JkKbd>K</JkKbd> to move</p>
      </aside>
    );
  }
  const date = appliedDate(job.dateApplied);
  const words = [...new Set([...(job.keywords ?? [])])].slice(0, 8);
  return (
    <aside aria-label="Job details" className={cn("flex min-h-0 flex-col", className)}>
      <div key={job._id} className="min-h-0 flex-1 overflow-y-auto overscroll-contain [animation:jk-enter_0.45s_cubic-bezier(0.16,1,0.3,1)_both]">
        <div className="relative isolate h-[150px]">
          <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden">
            <JkArt name="hero" variant="section" fade="none" position="right 34%" />
            <div className="absolute inset-0 bg-background/20" />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent from-35% to-background" />
          </div>
          <JkJobLogo company={job.company} link={job.link} size={44} className="absolute bottom-[23px] left-[27px] shadow-lg" />
        </div>
        <div className="px-[27px] pb-6">
          <div className="flex items-center justify-between">
            <JkMonoLabel className="text-[10.5px] font-medium tracking-[0.14em]">Job details</JkMonoLabel>
            <span className="flex gap-1.5" aria-label="Press J or K to move between jobs"><JkKbd>J</JkKbd><JkKbd>K</JkKbd></span>
          </div>
          <button type="button" onClick={onOpen} className="mt-2 block text-left">
            <h2 className="text-[23px] font-medium leading-[27px] tracking-[-0.4px] text-foreground hover:underline hover:decoration-border-strong hover:underline-offset-4">{job.title}</h2>
          </button>
          <p className="mt-1 text-[14.5px] text-muted-foreground">{job.company}</p>

          <div className="mt-[18px] border-t border-border">
            <Row label="Status" onClick={onOpen}>
              <span className="flex items-center gap-[11px] text-[14px] text-foreground"><JkStatusGlyph status={job.status} className="size-[13px]" />{job.status}</span>
            </Row>
            <Row label="Applied" onClick={onOpen}>
              <span className={cn("font-mono text-[14px]", date ? "text-foreground" : "text-subtle-foreground")}>{date ?? "-"}</span>
            </Row>
            <Row label="Compensation" onClick={onOpen}>
              <span className="flex items-center gap-3">
                <JkCompBars compensation={job.compensation} className="text-[13px]" />
                {job.compensation && <span className="truncate text-[13px] text-muted-foreground">{job.compensation}</span>}
              </span>
            </Row>
            <Row label="Resume used" onClick={onOpen}>
              <span className={cn("block truncate text-[14px]", job.resumeUsed ? "text-foreground" : "text-subtle-foreground")}>{job.resumeUsed || "none yet"}</span>
            </Row>
            <Row label="Cover letter" onClick={onOpen}>
              <span className={cn("block truncate text-[14px]", job.coverLetterUsed ? "text-foreground" : "text-subtle-foreground")}>{job.coverLetterUsed || "none yet"}</span>
            </Row>
          </div>

          {words.length > 0 && (
            <>
              <JkMonoLabel as="p" className="mt-[18px]">Keywords</JkMonoLabel>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {words.map((w) => (
                  <span key={w} className="inline-flex h-[26px] items-center rounded-full border border-input px-[14px] text-[12.5px] font-medium text-foreground">{w}</span>
                ))}
              </div>
            </>
          )}

          <JkMonoLabel as="p" className="mt-[22px]">Notes</JkMonoLabel>
          <button type="button" onClick={onOpen} className="mt-2.5 block w-full rounded-[14px] border border-border bg-card px-4 py-[13px] text-left text-[13.5px] leading-5 text-muted-foreground transition-colors hover:border-input">
            <span className="line-clamp-4 whitespace-pre-line">{job.notes?.trim() || "Add a note"}</span>
          </button>
        </div>
      </div>
      <div className="flex shrink-0 gap-2 border-t border-border bg-background px-[27px] py-4">
        <Button onClick={onWriteResume} className="h-10 gap-2 px-[18px] text-[14px]">
          Write resume
          <kbd className="inline-flex h-[18px] min-w-5 items-center justify-center rounded-[5px] bg-primary-foreground/15 px-1 font-mono text-[10.5px] font-semibold">G</kbd>
        </Button>
        <Button variant="secondary" className="h-10 px-5 text-[14px]" disabled={!job.link} onClick={() => job.link && window.open(job.link, "_blank", "noopener,noreferrer")}>
          View posting
        </Button>
        <Button variant="secondary" className="h-10 px-5 text-[14px]" onClick={onPrep}>Prep</Button>
      </div>
    </aside>
  );
}
