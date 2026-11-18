'use client'

/**
 * Job details editor. Desktop D05: dialog with the lighthouse band, every field editable,
 * Delete / Prep for interview / Save. Phone M02: a full page (back · "Job") with label-value
 * rows that edit in place and Write resume / Prep at the bottom.
 * Opens when useJobs().selectedJobId is set.
 */
import { JkConfirmButton } from "../jkConfirm";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronLeft } from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { appliedDate } from "@/lib/jkJobs";
import { JOB_STATUSES } from "@/lib/jkStatus";
import { useJobs, type Job } from "@/providers/jkJobsProvider";
import { useJobKompassResume } from "@/providers/jkResumeProvider";
import { useJobKompassDocuments } from "@/providers/jkDocumentsProvider";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import { jkFieldCls } from "../jkField";
import { JkStatusGlyph } from "../jkStatusChip";
import { JkJobsDialog, JkMonoLabel } from "../jk-jobs/jkJobBits";

interface Form {
  title: string; company: string; link: string; status: string; dateApplied: string; compensation: string;
  resumeUsed: string; coverLetterUsed: string; keywords: string[]; description: string; notes: string;
}

const fromJob = (j: Job): Form => ({
  title: j.title ?? "", company: j.company ?? "", link: j.link ?? "", status: j.status ?? "Interested",
  dateApplied: j.dateApplied ?? "", compensation: j.compensation ?? "", resumeUsed: j.resumeUsed ?? "",
  coverLetterUsed: j.coverLetterUsed ?? "", keywords: j.keywords ?? [], description: j.description ?? "", notes: j.notes ?? "",
});

const today = () => { const d = new Date(); const p = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };

/** Native select styled as a field; keeps an unknown current value as an option. */
function DocSelect({ id, value, options, placeholder, onChange, className }: { id: string; value: string; options: string[]; placeholder: string; onChange: (v: string) => void; className?: string }) {
  const all = value && !options.includes(value) ? [value, ...options] : options;
  return (
    <div className="relative">
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={cn(jkFieldCls, "h-11 cursor-pointer appearance-none pr-9", !value && "text-subtle-foreground", className)}>
        <option value="">{placeholder}</option>
        {all.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-subtle-foreground" />
    </div>
  );
}

function StatusSelect({ id, value, onChange, big }: { id: string; value: string; onChange: (v: string) => void; big?: boolean }) {
  const all: string[] = JOB_STATUSES.includes(value as never) ? [...JOB_STATUSES] : [value, ...JOB_STATUSES];
  return (
    <label htmlFor={id} className={cn("relative inline-flex cursor-pointer items-center", big ? "h-[52px] w-full gap-3 rounded-full border border-input bg-card pl-5 pr-12 text-[15px]" : "h-7 gap-[11px] rounded-full pr-6 text-[14px] hover:text-foreground")}>
      <JkStatusGlyph status={value} className="size-[13px]" />
      <span className="text-foreground">{value}</span>
      <ChevronDown aria-hidden className={cn("pointer-events-none absolute text-muted-foreground", big ? "right-5 size-5" : "right-0 size-3.5")} />
      <select id={id} aria-label="Status" value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 cursor-pointer appearance-none opacity-0">
        {all.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
    </label>
  );
}

function Keywords({ value, onChange, size = "md" }: { value: string[]; onChange: (v: string[]) => void; size?: "md" | "lg" }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const w = draft.trim().replace(/,$/, "");
    if (w && !value.some((x) => x.toLowerCase() === w.toLowerCase())) onChange([...value, w]);
    setDraft("");
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {value.map((w) => (
        <button
          key={w}
          type="button"
          onClick={() => onChange(value.filter((x) => x !== w))}
          aria-label={`Remove ${w}`}
          className={cn("inline-flex items-center gap-1 rounded-full border border-input bg-popover font-medium text-foreground transition-colors hover:border-border-strong", size === "lg" ? "h-[30px] px-4 text-[13px]" : "h-7 px-[17px] text-[12.5px]")}
        >
          {w} <span aria-hidden className="text-muted-foreground">×</span>
        </button>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); }
          else if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={add}
        placeholder="Add a keyword and press Enter"
        aria-label="Add a keyword"
        className="h-7 min-w-[190px] flex-1 bg-transparent px-2 text-[13px] text-foreground outline-none placeholder:text-subtle-foreground"
      />
    </div>
  );
}

export default function JkJobExpanded({ onWriteResume, onPrep }: { onWriteResume: (job: Job) => void; onPrep: (job: Job) => void }) {
  const { allJobs, selectedJobId, setSelectedJobId, handleUpdateJob, handleDeleteJob } = useJobs();
  const { resumes } = useJobKompassResume();
  const { coverLetterList } = useJobKompassDocuments();
  const markJobAsSeen = useMutation(api.jobs.markJobAsSeen);
  const job = selectedJobId ? allJobs.find((j) => j._id === selectedJobId) ?? null : null;

  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Load the job into the form when a different job opens (not on every live update).
  useEffect(() => {
    setForm(job ? fromJob(job) : null);
    setConfirmDelete(false);
    if (job) markJobAsSeen({ jobId: job._id }).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?._id]);

  const resumeNames = useMemo(() => [...new Set((resumes ?? []).map((r: { name?: string; title?: string }) => r.name || r.title || "Untitled resume"))], [resumes]);
  const letterNames = useMemo(() => [...new Set((coverLetterList ?? []).map((c: { name?: string }) => c.name || "Untitled cover letter"))], [coverLetterList]);

  const dirty = !!(job && form && JSON.stringify(fromJob(job)) !== JSON.stringify(form));
  const close = () => setSelectedJobId(null);
  const set = <K extends keyof Form>(k: K) => (v: Form[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const setStatus = (status: string) => setForm((f) => {
    if (!f) return f;
    // Moving past Interested with no applied date: stamp today, the date the person applied.
    const stamp = !f.dateApplied && status !== "Interested" && status !== f.status ? today() : f.dateApplied;
    return { ...f, status, dateApplied: stamp };
  });

  const save = async () => {
    if (!job || !form || !dirty) return;
    if (!form.title.trim() || !form.company.trim()) { toast.error("A job needs a title and a company."); return; }
    setSaving(true);
    try {
      await handleUpdateJob(job._id, {
        ...form,
        title: form.title.trim(),
        company: form.company.trim(),
        link: form.link.trim(),
        dateApplied: form.dateApplied.trim() || undefined,
        compensation: form.compensation.trim() || undefined,
        resumeUsed: form.resumeUsed || undefined,
        coverLetterUsed: form.coverLetterUsed || undefined,
      } as never);
      toast.success("Saved");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!job) return;
    await handleDeleteJob(job._id);
    toast.success(`Deleted ${job.title}`);
    close();
  };

  const f = form;
  const date = job ? appliedDate(job.dateApplied) : null;

  const deleteBtn = (
    <JkConfirmButton variant="destructive" className="h-10 px-[22px] text-[13.5px]" onConfirm={remove} busyLabel="Deleting…">Delete job</JkConfirmButton>
  );

  return (
    <JkJobsDialog
      open={!!job && !!f}
      onClose={close}
      label={job ? `${job.title} at ${job.company}` : "Job details"}
      width={840}
      artHeight={129}
      mobile="page"
      mobileHeader={
        <div className="flex h-14 items-center border-b border-border pl-3 pr-5 pt-[env(safe-area-inset-top)]">
          <button type="button" onClick={close} aria-label="Back" className="flex size-9 items-center justify-center rounded-full text-foreground hover:bg-accent">
            <ChevronLeft className="size-5" strokeWidth={1.8} />
          </button>
          <span className="ml-2 text-[20px] font-semibold tracking-[-0.3px] text-foreground">Job</span>
          {dirty && <Button className="ml-auto h-9 px-5 text-[14px]" onClick={save} disabled={saving}>Save</Button>}
        </div>
      }
      header={job && f && (
        <div className="border-b border-border px-8 pb-[17px] pt-7">
          <JkMonoLabel className="text-[10.5px] text-bar-4-ink dark:text-bar-4">Job details</JkMonoLabel>
          <h2 className="mt-2 truncate pr-24 text-[28px] font-medium leading-[33px] tracking-[-0.5px] text-foreground">{f.title || job.title}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-x-10 gap-y-1">
            <StatusSelect id="jk-job-status-d" value={f.status} onChange={setStatus} />
            <span className="text-[13.5px] text-muted-foreground">{f.company}{date ? ` · applied ${date}` : ""}</span>
          </div>
        </div>
      )}
      footer={job && f && (
        <>
          {/* Desktop D05 */}
          <div className="hidden items-center gap-2.5 border-t border-border px-8 py-[17px] md:flex">
            {deleteBtn}
            <Button variant="secondary" className="ml-auto h-10 px-[37px] text-[14.5px]" onClick={() => onPrep(job)}>Prep for interview</Button>
            <Button className="h-10 px-8 text-[14.5px]" onClick={save} disabled={!dirty || saving}>{saving ? "Saving" : "Save"}</Button>
          </div>
          {/* Phone M02 */}
          <div className="flex gap-2 border-t border-border bg-card px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-4 md:hidden">
            <Button className="h-[52px] flex-[196] text-[16px]" onClick={() => onWriteResume(job)}>Write resume</Button>
            <Button variant="secondary" className="h-[52px] flex-[146] text-[16px]" onClick={() => onPrep(job)}>Prep</Button>
          </div>
        </>
      )}
    >
      {job && f && (
        <>
          {/* ── Desktop D05: two-column form ── */}
          <div className="hidden grid-cols-2 gap-x-6 gap-y-4 px-8 pb-8 pt-[21px] md:grid">
            <div>
              <JkMonoLabel as="label" htmlFor="jk-job-title" className="mb-[7px] block font-medium">Job title</JkMonoLabel>
              <input id="jk-job-title" value={f.title} onChange={(e) => set("title")(e.target.value)} className={cn(jkFieldCls, "h-11")} />
            </div>
            <div>
              <JkMonoLabel as="label" htmlFor="jk-job-company" className="mb-[7px] block font-medium">Company</JkMonoLabel>
              <input id="jk-job-company" value={f.company} onChange={(e) => set("company")(e.target.value)} className={cn(jkFieldCls, "h-11")} />
            </div>
            <div>
              <JkMonoLabel as="label" htmlFor="jk-job-link" className="mb-[7px] block font-medium">Job link</JkMonoLabel>
              <input id="jk-job-link" value={f.link} onChange={(e) => set("link")(e.target.value)} placeholder="https://" className={cn(jkFieldCls, "h-11 font-mono")} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <JkMonoLabel as="label" htmlFor="jk-job-date" className="mb-[7px] block font-medium">Date applied</JkMonoLabel>
                <input id="jk-job-date" value={f.dateApplied} onChange={(e) => set("dateApplied")(e.target.value)} placeholder="YYYY-MM-DD" className={cn(jkFieldCls, "h-11 font-mono")} />
              </div>
              <div>
                <JkMonoLabel as="label" htmlFor="jk-job-comp" className="mb-[7px] block font-medium">Compensation</JkMonoLabel>
                <input id="jk-job-comp" value={f.compensation} onChange={(e) => set("compensation")(e.target.value)} placeholder="$150k - $180k" className={cn(jkFieldCls, "h-11")} />
              </div>
            </div>
            <div>
              <JkMonoLabel as="label" htmlFor="jk-job-resume" className="mb-[7px] block font-medium">Resume used</JkMonoLabel>
              <DocSelect id="jk-job-resume" value={f.resumeUsed} options={resumeNames} placeholder="Select a resume..." onChange={set("resumeUsed")} />
            </div>
            <div>
              <JkMonoLabel as="label" htmlFor="jk-job-letter" className="mb-[7px] block font-medium">Cover letter</JkMonoLabel>
              <DocSelect id="jk-job-letter" value={f.coverLetterUsed} options={letterNames} placeholder="Select a cover letter..." onChange={set("coverLetterUsed")} />
            </div>
            <div className="col-span-2">
              <JkMonoLabel as="p" className="mb-[9px] font-medium">Keywords</JkMonoLabel>
              <Keywords value={f.keywords} onChange={set("keywords")} />
            </div>
            <div className="mt-2">
              <JkMonoLabel as="label" htmlFor="jk-job-desc" className="mb-[7px] block font-medium">Description</JkMonoLabel>
              <textarea id="jk-job-desc" value={f.description} onChange={(e) => set("description")(e.target.value)} rows={6} className={cn(jkFieldCls, "h-[150px] resize-y py-3 text-[13px] leading-[19.5px] text-muted-foreground focus-visible:text-foreground")} />
            </div>
            <div className="mt-2">
              <JkMonoLabel as="label" htmlFor="jk-job-notes" className="mb-[7px] block font-medium">Notes</JkMonoLabel>
              <textarea id="jk-job-notes" value={f.notes} onChange={(e) => set("notes")(e.target.value)} rows={6} placeholder="Recruiter, call times, anything to remember" className={cn(jkFieldCls, "h-[150px] resize-y py-3 text-[13px] leading-[19.5px]")} />
            </div>
          </div>

          {/* ── Phone M02: rows that edit in place ── */}
          <div className="px-5 pb-8 pt-5 md:hidden">
            <textarea
              aria-label="Job title"
              value={f.title}
              onChange={(e) => set("title")(e.target.value)}
              rows={2}
              className="w-full resize-none bg-transparent text-[30px] font-medium leading-9 tracking-[-0.7px] text-foreground outline-none"
            />
            <input aria-label="Company" value={f.company} onChange={(e) => set("company")(e.target.value)} className="mt-0.5 w-full bg-transparent text-[15px] text-muted-foreground outline-none" />
            <div className="mt-[18px]"><StatusSelect id="jk-job-status-m" value={f.status} onChange={setStatus} big /></div>
            <div className="mt-6 border-t border-border">
              {([
                ["Applied", "dateApplied", "YYYY-MM-DD"],
                ["Compensation", "compensation", "Add pay"],
                ["Job link", "link", "https://"],
              ] as const).map(([label, key, ph]) => (
                <label key={key} className="flex h-[46px] items-center gap-4 border-b border-border">
                  <JkMonoLabel className="shrink-0">{label}</JkMonoLabel>
                  <input value={f[key]} onChange={(e) => set(key)(e.target.value)} placeholder={ph} className="min-w-0 flex-1 bg-transparent text-right text-[14px] text-foreground outline-none placeholder:text-subtle-foreground" />
                </label>
              ))}
              {([
                ["Resume used", "resumeUsed", resumeNames],
                ["Cover letter", "coverLetterUsed", letterNames],
              ] as const).map(([label, key, opts]) => (
                <label key={key} className="relative flex h-[46px] items-center gap-4 border-b border-border">
                  <JkMonoLabel className="shrink-0">{label}</JkMonoLabel>
                  <span className={cn("ml-auto truncate text-[14px]", f[key] ? "text-foreground" : "text-subtle-foreground")}>{f[key] || "none yet"}</span>
                  <select aria-label={label} value={f[key]} onChange={(e) => set(key)(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0">
                    <option value="">none yet</option>
                    {(f[key] && !opts.includes(f[key]) ? [f[key], ...opts] : opts).map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </label>
              ))}
            </div>
            <JkMonoLabel as="p" className="mt-5">Keywords</JkMonoLabel>
            <div className="mt-3"><Keywords value={f.keywords} onChange={set("keywords")} size="lg" /></div>
            <JkMonoLabel as="label" htmlFor="jk-job-notes-m" className="mt-6 block">Notes</JkMonoLabel>
            <textarea id="jk-job-notes-m" value={f.notes} onChange={(e) => set("notes")(e.target.value)} rows={4} placeholder="Add a note" className={cn(jkFieldCls, "mt-2.5 rounded-2xl px-4 py-3.5 text-[14px] leading-[21px] text-muted-foreground focus-visible:text-foreground")} />
            <JkMonoLabel as="label" htmlFor="jk-job-desc-m" className="mt-6 block">Description</JkMonoLabel>
            <textarea id="jk-job-desc-m" value={f.description} onChange={(e) => set("description")(e.target.value)} rows={6} className={cn(jkFieldCls, "mt-2.5 rounded-2xl px-4 py-3.5 text-[13.5px] leading-5 text-muted-foreground focus-visible:text-foreground")} />
            <div className="mt-6">{deleteBtn}</div>
          </div>
        </>
      )}
    </JkJobsDialog>
  );
}
