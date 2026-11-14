'use client'

/**
 * The three ways My Jobs lists jobs:
 *   JkJobsTable      D03 table: title · company (logo) · status glyph · applied date · comp band
 *   JkJobsGrouped    D04 columns per status with counts, up to 4 cards each, then "N more"
 *   JkJobsPhoneList  M01 rows: glyph, title, company · status, comp band
 * All three take the already-filtered jobs from useJobs() and report clicks up; the page
 * (jkChatWindow-MyJobsMode.tsx) owns focus (J/K), selection and dialogs.
 */
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { appliedDate } from "@/lib/jkJobs";
import { STATUS_BG, STATUS_TEXT, statusKey } from "@/lib/jkStatus";
import type { Job } from "@/providers/jkJobsProvider";
import type { Id } from "@/convex/_generated/dataModel";
import { JkStatusGlyph } from "../jkStatusChip";
import { JkCompBars, JkJobLogo, JkMonoLabel } from "../jk-jobs/jkJobBits";

type JobId = Id<"jobs">;

const enter = (i: number) => ({ "--i": Math.min(i, 14) } as React.CSSProperties);

function SelectBox({ on, label }: { on: boolean; label: string }) {
  return (
    <span
      role="checkbox"
      aria-checked={on}
      aria-label={label}
      className={cn(
        "flex size-[18px] shrink-0 items-center justify-center rounded-[6px] border transition-colors",
        on ? "border-primary bg-primary text-primary-foreground" : "border-border-strong",
      )}
    >
      {on && <Check className="size-3" strokeWidth={3} />}
    </span>
  );
}

const TABLE_COLS = "grid grid-cols-[minmax(0,1fr)_minmax(120px,166px)_124px_84px_56px] items-center gap-x-0";

export function JkJobsTable({
  jobs, total, focusedId, selectionMode, selectedIds, onRowClick, onRowOpen, onToggle,
}: {
  jobs: Job[];
  total: number;
  focusedId: JobId | null;
  selectionMode: boolean;
  selectedIds: JobId[];
  onRowClick: (id: JobId) => void;
  onRowOpen: (id: JobId) => void;
  onToggle: (id: JobId) => void;
}) {
  return (
    <div role="table" aria-label="Jobs" aria-rowcount={jobs.length} className="min-w-0">
      <div role="row" className={cn(TABLE_COLS, "sticky top-0 z-[1] h-10 border-b border-border bg-background pl-8 pr-5")}>
        {["Title", "Company", "Status", "Applied", "Comp"].map((h) => (
          <JkMonoLabel key={h} as="span" className="tracking-[0.12em]">
            <span role="columnheader">{h}</span>
          </JkMonoLabel>
        ))}
      </div>
      <div data-enter className="relative">
        {jobs.map((job, i) => {
          const focused = job._id === focusedId;
          const selected = selectedIds.includes(job._id);
          const date = appliedDate(job.dateApplied);
          return (
            <div
              key={job._id}
              role="row"
              data-job-row={job._id}
              aria-selected={selectionMode ? selected : focused}
              tabIndex={-1}
              onClick={() => (selectionMode ? onToggle(job._id) : onRowClick(job._id))}
              onDoubleClick={() => !selectionMode && onRowOpen(job._id)}
              className={cn(
                "jk-enter group relative h-11 cursor-pointer border-b border-border pl-8 pr-5 transition-colors duration-150",
                TABLE_COLS,
                focused ? "bg-popover" : "hover:bg-popover/60",
                selected && "bg-accent/60",
              )}
              style={enter(i)}
            >
              {focused && !selectionMode && <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-plan" />}
              <div role="cell" className="flex min-w-0 items-center gap-3 pr-4">
                {selectionMode && <SelectBox on={selected} label={`Select ${job.title}`} />}
                <span className="truncate text-[14.5px] font-medium text-foreground">{job.title}</span>
              </div>
              <div role="cell" className="flex min-w-0 items-center gap-2 pr-3">
                <JkJobLogo company={job.company} link={job.link} size={20} />
                <span className="truncate text-[13.5px] text-muted-foreground">{job.company}</span>
              </div>
              <div role="cell" className="flex min-w-0 items-center gap-[11px]">
                <JkStatusGlyph status={job.status} className="size-[13px]" />
                <span className="truncate text-[13.5px] text-foreground">{job.status}</span>
              </div>
              <div role="cell" className="truncate font-mono text-[12px] text-muted-foreground">{date ?? "-"}</div>
              <div role="cell"><JkCompBars compensation={job.compensation} /></div>
            </div>
          );
        })}
      </div>
      <p className="px-8 pb-8 pt-4 font-mono text-[10px] uppercase tracking-[0.12em] text-subtle-foreground" aria-live="polite">
        {jobs.length} of {total} shown
      </p>
    </div>
  );
}

/** Column order for D04. Empty statuses get no column. */
export const GROUP_ORDER = ["Interviewing", "Applied", "Callback", "Offered", "Interested", "Rejected", "Ghosted"] as const;
const CARDS_PER_COLUMN = 4;

function shortDate(job: Job) {
  const d = appliedDate(job.dateApplied);
  return d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d.slice(5) : d;
}

export function JkJobCard({ job, focused, selectionMode, selected, onClick, style }: {
  job: Job; focused: boolean; selectionMode: boolean; selected: boolean; onClick: () => void; style?: React.CSSProperties;
}) {
  const d = shortDate(job);
  const eyebrow = statusKey(job.status) === "interested" ? "Saved" : d ? `Applied ${d}` : job.status;
  return (
    <button
      type="button"
      data-job-row={job._id}
      onClick={onClick}
      aria-pressed={selectionMode ? selected : undefined}
      style={style}
      className={cn(
        "jk-enter group flex h-[110px] w-full flex-col rounded-[18px] border bg-card px-4 pb-3 pt-[14px] text-left transition-[border-color,transform] duration-200 hover:-translate-y-px",
        focused || selected ? "border-plan" : "border-border hover:border-input",
      )}
    >
      <div className="flex w-full items-center justify-between gap-2">
        <span className={cn("truncate font-mono text-[10.5px] uppercase tracking-[0.04em]", focused ? "text-plan-text" : "text-subtle-foreground")}>{eyebrow}</span>
        {selectionMode ? <SelectBox on={selected} label={`Select ${job.title}`} /> : <JkCompBars compensation={job.compensation} className="text-[11px]" />}
      </div>
      <span className="mt-2 w-full truncate text-[15px] font-medium leading-[18px] text-foreground">{job.title}</span>
      <span className="mt-1 flex w-full min-w-0 items-center gap-2">
        <JkJobLogo company={job.company} link={job.link} size={16} />
        <span className="truncate text-[13px] text-muted-foreground">{job.company}</span>
      </span>
      <span className="mt-auto w-full truncate border-t border-border pt-[5px] font-mono text-[11px] text-subtle-foreground">
        {job.resumeUsed ? job.resumeUsed.replace(/^.*?resume\s*[-–—:]\s*/i, "Resume - ") : "no resume yet"}
      </span>
    </button>
  );
}

export function JkJobsGrouped({
  jobs, focusedId, selectionMode, selectedIds, onCardClick, onMore,
}: {
  jobs: Job[];
  focusedId: JobId | null;
  selectionMode: boolean;
  selectedIds: JobId[];
  onCardClick: (id: JobId) => void;
  /** "N more": show that whole status (the page switches to the table filtered to it). */
  onMore: (status: string) => void;
}) {
  const known = new Set<string>(GROUP_ORDER);
  const others = [...new Set(jobs.map((j) => j.status).filter((s) => !known.has(s)))];
  const columns = [...GROUP_ORDER, ...others]
    .map((status) => ({ status, items: jobs.filter((j) => j.status === status) }))
    .filter((c) => c.items.length > 0);

  return (
    <div data-enter className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] items-start gap-3 px-5 pb-28 pt-[18px] lg:px-8">
      {columns.map((col, ci) => {
        const k = statusKey(col.status);
        const shown = col.items.slice(0, CARDS_PER_COLUMN);
        const more = col.items.length - shown.length;
        return (
          <section key={col.status} aria-label={`${col.status}, ${col.items.length}`} className="flex min-w-0 flex-col gap-3">
            <header
              className={cn("jk-enter flex h-[42px] items-center gap-[11px] rounded-[14px] px-3.5", {
                interested: "bg-status-interested/14", applied: "bg-status-applied/14", callback: "bg-status-callback/14",
                interviewing: "bg-status-interviewing/14", offered: "bg-status-offered/14", rejected: "bg-status-rejected/14", ghosted: "bg-status-ghosted/14",
              }[k])}
              style={enter(ci)}
            >
              <span aria-hidden className={cn("h-3.5 w-[3px] rounded-full", STATUS_BG[k])} />
              <span className="text-[15px] font-medium text-foreground">{col.status}</span>
              <span className="ml-auto font-mono text-[12.5px] font-medium text-foreground">{col.items.length}</span>
            </header>
            {shown.map((job, i) => (
              <JkJobCard
                key={job._id}
                job={job}
                focused={!selectionMode && job._id === focusedId}
                selectionMode={selectionMode}
                selected={selectedIds.includes(job._id)}
                onClick={() => onCardClick(job._id)}
                style={enter(ci + i + 1)}
              />
            ))}
            {more > 0 && (
              <button type="button" onClick={() => onMore(col.status)} className="jk-enter self-start text-[12.5px] text-subtle-foreground transition-colors hover:text-foreground" style={enter(ci + shown.length + 1)}>
                {more} more
              </button>
            )}
          </section>
        );
      })}
    </div>
  );
}

export function JkJobsPhoneList({
  jobs, total, selectionMode, selectedIds, onOpen, onToggle,
}: {
  jobs: Job[];
  total: number;
  selectionMode: boolean;
  selectedIds: JobId[];
  onOpen: (id: JobId) => void;
  onToggle: (id: JobId) => void;
}) {
  return (
    <div className="px-5">
      <ul data-enter className="border-t border-border">
        {jobs.map((job, i) => {
          const k = statusKey(job.status);
          const selected = selectedIds.includes(job._id);
          return (
            <li key={job._id} className="jk-enter border-b border-border" style={enter(i)}>
              <button
                type="button"
                data-job-row={job._id}
                onClick={() => (selectionMode ? onToggle(job._id) : onOpen(job._id))}
                className={cn("flex min-h-20 w-full items-start gap-[13px] py-[17px] text-left", selected && "bg-accent/40")}
              >
                <span className="mt-[3px]">{selectionMode ? <SelectBox on={selected} label={`Select ${job.title}`} /> : <JkStatusGlyph status={job.status} className="size-[13px]" />}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[16px] font-medium leading-[19px] text-foreground">{job.title}</span>
                  <span className="mt-1.5 flex min-w-0 items-baseline gap-3 text-[13px] leading-[15px]">
                    <span className="truncate text-muted-foreground">{job.company}</span>
                    <span className={cn("shrink-0", STATUS_TEXT[k])}>· {job.status}</span>
                    <JkCompBars compensation={job.compensation} className="ml-auto shrink-0 pl-2 text-[11px]" />
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="pb-28 pt-4 font-mono text-[10px] uppercase tracking-[0.12em] text-subtle-foreground">{jobs.length} of {total} shown</p>
    </div>
  );
}

export default JkJobsTable;
