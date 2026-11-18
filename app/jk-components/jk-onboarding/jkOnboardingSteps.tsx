'use client'

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { JkFormError, jkFieldCls } from "@/app/jk-components/jkField";
import JkCompanyLogo from "@/app/jk-components/jkCompanyLogo";
import { JkStatusGlyph } from "@/app/jk-components/jkStatusChip";
import JkResumePage from "./jkResumePage";
import { JkOnbHeading, JkOnbLabel } from "./jkOnboardingShell";
import { cn } from "@/lib/utils";
import type { ResumeContent } from "@/lib/resume/types";
import type { ResumeChange, ResumeMarks } from "@/lib/onboarding/resumeChanges";

export interface OnbBase { content: ResumeContent; fileName: string | null; pages?: number; label?: string }
export interface OnbJob { jobId: string; company: string; title: string; location?: string; compensation?: string; keywords: string[]; link: string | null }
export interface OnbResult { resumeId: string; storageId: string; fileName: string; content: ResumeContent; changes: ResumeChange[]; marks: ResumeMarks; job: { title: string; company: string } }

export const primaryBtn = "h-[54px] w-full px-6 text-[16.5px] lg:h-[52px] lg:text-[16px]";

async function postJson<T>(url: string, body: unknown): Promise<{ ok: true; data: T } | { ok: false; error: string; code?: string }> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.error || "Something went wrong. Try again.", code: data.code };
    return { ok: true, data: data as T };
  } catch {
    return { ok: false, error: "Could not reach JobKompass. Check your connection." };
  }
}

function Spinner({ className }: { className?: string }) {
  return <JkStatusGlyph status="Interested" className={cn("animate-spin [animation-duration:1.4s]", className)} />;
}

/* ─── Step 1: Add the resume you already have ──────────────────────────────── */

export function JkOnbResumeStep({ base, onBase, onContinue }: { base: OnbBase | null; onBase: (b: OnbBase) => void; onContinue: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"file" | "paste">("file");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const read = async (payload: { resumePdf?: string; resumeText?: string; fileName?: string }, label: string) => {
    setError(null);
    setBusy(label);
    const r = await postJson<{ content: ResumeContent; fileName: string | null; pages?: number }>("/api/onboarding/resume", payload);
    setBusy(null);
    if (!r.ok) return setError(r.error), false;
    onBase({ content: r.data.content, fileName: r.data.fileName, pages: r.data.pages });
    setMode("file");
    return true;
  };

  const pickFile = (file?: File | null) => {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) return setError("Choose a PDF, or paste the text instead.");
    if (file.size > 5 * 1024 * 1024) return setError("The PDF must be under 5 MB.");
    const reader = new FileReader();
    reader.onload = () => void read({ resumePdf: String(reader.result), fileName: file.name }, file.name);
    reader.readAsDataURL(file);
  };

  const submit = async () => {
    if (mode === "paste" && text.trim()) {
      if (await read({ resumeText: text }, "Pasted resume")) onContinue();
      return;
    }
    if (base) onContinue();
  };

  const canContinue = !busy && (mode === "paste" ? text.trim().length > 40 : !!base);
  const name = busy ?? base?.fileName ?? base?.label ?? "Pasted resume";
  const meta = busy ? "Reading it…" : base?.fileName ? `${base.pages ? `${base.pages} page${base.pages > 1 ? "s" : ""} · ` : ""}uploaded` : "Saved as your base resume";
  const linkCls = "text-[13px] leading-[15px] text-muted-foreground transition-colors hover:text-foreground";

  return (
    <>
      <JkOnbHeading lines={["Add the resume", "you already have"]} sub="JobKompass reads it once and uses it as the starting point for every resume it writes for you." />

      <input ref={fileRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = ""; }} />

      {mode === "paste" ? (
        <div className="mt-11 rounded-[20px] border-[1.5px] border-dashed border-border-strong bg-card lg:mt-[39px]">
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste your resume text here…"
            className="block min-h-[180px] w-full resize-y rounded-t-[20px] bg-transparent px-[18px] pt-4 text-[14.5px] leading-[22px] text-foreground outline-none placeholder:text-subtle-foreground lg:px-7"
          />
          <div className="mx-[18px] flex justify-between border-t border-border py-[15px] lg:mx-7">
            <button type="button" onClick={() => setMode("file")} className={cn(linkCls, "font-medium")}>Use a PDF instead</button>
            {busy && <span className="flex items-center gap-2 text-[13px] text-muted-foreground"><Spinner className="size-3.5" />Reading it…</span>}
          </div>
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); pickFile(e.dataTransfer.files?.[0]); }}
          className={cn("mt-11 rounded-[20px] border-[1.5px] border-dashed bg-card transition-colors lg:mt-[39px]", dragging ? "border-bar-3" : "border-border-strong")}
        >
          {base || busy ? (
            <div className="flex items-start gap-[17px] px-[23px] pt-6 lg:gap-5 lg:px-[33px] lg:pt-[27px]">
              <FileText aria-hidden className="mt-0.5 size-[19px] shrink-0 text-bar-3" strokeWidth={1.6} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium leading-[18px]">{name}</p>
                <p className="mt-1 text-[12.5px] leading-[15px] text-muted-foreground">{meta}</p>
              </div>
              {busy ? <Spinner className="mt-1 size-4" /> : <Check aria-label="Read" className="mt-1 size-4 shrink-0 text-ok" strokeWidth={1.8} />}
            </div>
          ) : (
            <button type="button" onClick={() => fileRef.current?.click()} className="flex w-full items-start gap-[17px] px-[23px] pt-6 text-left lg:gap-5 lg:px-[33px] lg:pt-[27px]">
              <FileText aria-hidden className="mt-0.5 size-[19px] shrink-0 text-bar-3" strokeWidth={1.6} />
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-medium leading-[18px]">Choose your resume PDF</span>
                <span className="mt-1 block text-[12.5px] leading-[15px] text-muted-foreground">or drop it here</span>
              </span>
            </button>
          )}
          <div className="mx-[18px] mt-[22px] flex justify-between border-t border-border py-[15px] lg:mx-7 lg:mt-[21px]">
            <button type="button" disabled={!!busy} onClick={() => fileRef.current?.click()} className={cn(linkCls, "font-medium")}>{base ? "Replace file" : "Choose file"}</button>
            <button type="button" disabled={!!busy} onClick={() => setMode("paste")} className={linkCls}>
              or paste the text<span className="hidden lg:inline"> instead</span>
            </button>
          </div>
        </div>
      )}

      {error && <div className="mt-4"><JkFormError>{error}</JkFormError></div>}

      {/* Phone: the page sits under the card and runs under the pinned button. */}
      <div className="lg:hidden">
        <JkOnbLabel className="mt-6">Your base resume</JkOnbLabel>
        <div className="mt-[13px] flex justify-center">
          {base ? <JkResumePage content={base.content} width={200} height={262} /> : <EmptyPage width={200} height={262} />}
        </div>
      </div>

      <Button onClick={submit} disabled={!canContinue} className={cn(primaryBtn, "mt-7 hidden lg:inline-flex lg:w-[200px]")}>Continue</Button>
      <JkOnbMobileButton onClick={submit} disabled={!canContinue}>Continue</JkOnbMobileButton>
    </>
  );
}

/** Phone only: the main action pinned to the bottom, with the page fading out under it (M22-M24). */
export function JkOnbMobileBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 lg:hidden">
      <div aria-hidden className="h-[84px] bg-gradient-to-b from-transparent to-background" />
      <div className="pointer-events-auto bg-background px-5 pb-[max(env(safe-area-inset-bottom),38px)]">
        <div className="mx-auto flex max-w-[560px] gap-2">{children}</div>
      </div>
    </div>
  );
}

export function JkOnbMobileButton({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <JkOnbMobileBar>
      <Button onClick={onClick} disabled={disabled} className={primaryBtn}>{children}</Button>
    </JkOnbMobileBar>
  );
}

export function EmptyPage({ width, height, label }: { width: number; height: number; label?: string }) {
  return (
    <div className="grid shrink-0 place-items-center rounded-[4px] border-[1.5px] border-dashed border-border-strong px-6 text-center text-[13px] leading-5 text-subtle-foreground" style={{ width, height }}>
      {label ?? "Your resume shows here once it is read."}
    </div>
  );
}

export function JkOnbResumeAside({ base }: { base: OnbBase | null }) {
  return (
    <>
      <JkOnbLabel>Your base resume</JkOnbLabel>
      <div className="mt-[27px] flex justify-center">
        <FitPage>{(w) => (base ? <JkResumePage content={base.content} width={w} /> : <EmptyPage width={w} height={(w * 580) / 440} />)}</FitPage>
      </div>
      <p className="mt-[39px] text-[14px] leading-[17px] text-muted-foreground">Every tailored version starts from this one.</p>
    </>
  );
}

/** The page is 440 wide in the frame; it narrows only when the panel does. */
export function FitPage({ children }: { children: (width: number) => React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(440);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.min(440, Math.floor(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return <div ref={ref} className="flex w-full max-w-[440px] justify-center">{children(width)}</div>;
}

/* ─── Step 2: Paste a job you want ─────────────────────────────────────────── */

export function JkOnbJobStep({ job, onJob, onBack, onWrite }: { job: OnbJob | null; onJob: (j: OnbJob) => void; onBack: () => void; onWrite: () => void }) {
  const [link, setLink] = useState(job?.link ?? "");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; code?: string } | null>(null);
  const [needsText, setNeedsText] = useState(false);
  const savedFor = useRef<string | null>(job ? (job.link ?? "") : null);
  // Same value as state, for what the screen shows (a ref must not be read while rendering).
  const [savedKey, setSavedKey] = useState<string | null>(job ? (job.link ?? "") : null);
  const descRef = useRef<HTMLTextAreaElement>(null);

  const save = async (): Promise<boolean> => {
    const key = `${link.trim()}|${description.trim()}`;
    if (job && savedFor.current === key) return true;
    if (!link.trim() && description.trim().length < 80) {
      setError({ text: "Paste a link to the posting, or the full description." });
      return false;
    }
    setBusy(true);
    setError(null);
    const r = await postJson<OnbJob>("/api/onboarding/job", { link: link.trim() || undefined, description: description.trim() || undefined });
    setBusy(false);
    if (!r.ok) {
      setError({ text: r.error, code: r.code });
      if (r.code === "unreadable") { setNeedsText(true); setTimeout(() => descRef.current?.focus(), 0); }
      return false;
    }
    savedFor.current = key;
    setSavedKey(key);
    onJob(r.data);
    return true;
  };

  const write = async () => { if (await save()) onWrite(); };
  const linkSaved = !!job && savedKey === `${link.trim()}|${description.trim()}` && !!link.trim();

  return (
    <>
      <JkOnbHeading lines={["Paste a job", "you want"]} sub="A link is enough. JobKompass saves the full posting, so the resume can be written against it." />

      <form onSubmit={(e) => { e.preventDefault(); void save(); }} className="mt-[34px] lg:mt-[35px]">
        <label htmlFor="job-link" className="mb-[7px] block font-mono text-[10px] font-medium uppercase leading-[13px] tracking-[0.12em] text-subtle-foreground">Job link</label>
        <div className="relative">
          <input
            id="job-link"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            onPaste={(e) => { const v = e.clipboardData.getData("text").trim(); if (/^\S+\.\S+/.test(v)) { setLink(v); setTimeout(() => (e.target as HTMLInputElement).form?.requestSubmit(), 0); } }}
            onBlur={() => { if (link.trim() && !busy) void save(); }}
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            placeholder="Paste the link to the posting"
            className={cn(jkFieldCls, "h-[50px] pr-11 font-mono lg:h-[52px]")}
          />
          <span className="pointer-events-none absolute right-[21px] top-1/2 -translate-y-1/2">
            {busy ? <Spinner className="size-4" /> : linkSaved ? <Check aria-label="Saved" className="size-4 text-ok" strokeWidth={1.8} /> : null}
          </span>
        </div>
        <textarea
          ref={descRef}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Or paste the job description…"
          rows={needsText ? 6 : 2}
          className={cn(jkFieldCls, "mt-5 min-h-16 resize-y rounded-[14px] py-[21px] text-[14px] leading-5 placeholder:text-subtle-foreground", needsText ? "block py-3.5" : "hidden lg:block lg:h-16")}
        />
        <button type="submit" hidden />
      </form>

      {error && (
        <div className="mt-4">
          <JkFormError>{error.text}{error.code === "limit" && <> <Link href="/pricing" className="underline">See plans</Link></>}</JkFormError>
        </div>
      )}

      {/* Phone: the saved card sits under the field. */}
      {job && (
        <div className="lg:hidden">
          <JkOnbLabel className="mt-[30px]">Saved to My Jobs</JkOnbLabel>
          <SavedJobCard job={job} compact className="mt-[11px]" />
        </div>
      )}

      <div className="mt-7 hidden items-center gap-8 lg:flex">
        <Button onClick={write} disabled={busy} className={cn(primaryBtn, "lg:w-[220px]")}>{busy ? "Saving the job…" : "Write my resume"}</Button>
        <button type="button" onClick={onBack} className="text-[14.5px] font-medium text-muted-foreground transition-colors hover:text-foreground">Back</button>
      </div>
      <JkOnbMobileButton onClick={write} disabled={busy}>{busy ? "Saving the job…" : "Write my resume"}</JkOnbMobileButton>
    </>
  );
}

export function SavedJobCard({ job, compact, className }: { job: OnbJob; compact?: boolean; className?: string }) {
  const rows: [string, React.ReactNode][] = [
    ["Status", <span key="s" className="flex items-center gap-[9px] text-[14px]"><JkStatusGlyph status="Interested" className="size-3" />Interested</span>],
    ["Compensation", <span key="c" className="font-mono text-[13px] font-medium">{job.compensation || "Not listed"}</span>],
  ];
  if (!compact && job.keywords.length) {
    rows.push(["Keywords", (
      <span key="k" className="flex flex-wrap gap-1.5">
        {job.keywords.slice(0, 3).map((k) => <span key={k} className="rounded-full border border-input px-[14px] py-[4.5px] text-[12.5px] font-medium leading-[15px]">{k}</span>)}
      </span>
    )]);
  }
  return (
    <div className={cn("rounded-[22px] border border-plan bg-popover px-5 pb-[18px] pt-[22px] lg:rounded-3xl lg:px-8 lg:pb-[30px] lg:pt-[30px]", className)}>
      <p className="font-mono text-[10px] font-medium uppercase leading-[13px] tracking-[0.12em] text-ok lg:text-[10.5px]">Saved</p>
      <p className="mt-3 text-[24px] font-medium leading-[29px] tracking-[-0.4px] lg:mt-[14px] lg:text-[30px] lg:leading-9 lg:tracking-[-0.6px]">{job.title}</p>
      <p className="mt-2 flex items-center gap-2 text-[14px] text-muted-foreground lg:mt-[11px] lg:text-[14.5px]">
        <JkCompanyLogo company={job.company} size="sm" className="size-5 rounded-md" />
        {[job.company, job.location].filter(Boolean).join(" · ")}
      </p>
      <div className="mt-5 lg:mt-[30px]">
        {rows.map(([label, value]) => (
          <div key={label} className="flex min-h-[46px] items-center border-t border-border py-2 lg:min-h-12">
            <span className={cn("shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-subtle-foreground", compact ? "w-[118px]" : "w-[130px] lg:w-[148px]")}>{label}</span>
            {value}
          </div>
        ))}
      </div>
    </div>
  );
}

export function JkOnbJobAside({ job }: { job: OnbJob | null }) {
  return (
    <>
      <JkOnbLabel>Saved to My Jobs</JkOnbLabel>
      <div className="mx-auto mt-[37px] max-w-[520px]">
        {job ? (
          <SavedJobCard job={job} />
        ) : (
          <div className="grid h-[320px] place-items-center rounded-3xl border-[1.5px] border-dashed border-border-strong px-8 text-center text-[13px] leading-5 text-subtle-foreground">
            The job shows here once it is saved.
          </div>
        )}
        <p className="mt-[29px] text-[14px] leading-[17px] text-muted-foreground">Next: a resume written for this posting.</p>
      </div>
    </>
  );
}

/* ─── Step 3: Your resume for this job is ready ────────────────────────────── */

export function JkOnbReadyStep({ job, result, error, onRetry, onDownload, downloading, onOpenJobs }: {
  job: OnbJob | null;
  result: OnbResult | null;
  error: { text: string; code?: string } | null;
  onRetry: () => void;
  onDownload: () => void;
  downloading: boolean;
  onOpenJobs: () => void;
}) {
  const title = result?.job.title ?? job?.title ?? "this job";
  const company = result?.job.company ?? job?.company ?? "";
  if (!result) {
    return (
      <>
        <JkOnbHeading lines={["Writing your resume", "for this job"]} sub={`Reading ${title}${company ? ` at ${company}` : ""} against your base resume. This takes about a minute.`} />
        {error ? (
          <div className="mt-8 space-y-4">
            <JkFormError>{error.text}{error.code === "limit" && <> <Link href="/pricing" className="underline">See plans</Link></>}</JkFormError>
            {error.code !== "limit" && <Button onClick={onRetry} className={cn(primaryBtn, "lg:w-[200px]")}>Try again</Button>}
          </div>
        ) : (
          <p className="mt-8 flex items-center gap-2.5 text-[14px] text-muted-foreground"><Spinner className="size-4" />Writing…</p>
        )}
      </>
    );
  }
  return (
    <>
      <JkOnbHeading lines={["Your resume for", "this job is ready"]} sub={<><span className="lg:hidden">From your base resume, for {title}{company ? ` at ${company}` : ""}.</span><span className="hidden lg:inline">Written from your base resume for {title}{company ? ` at ${company}` : ""}.</span></>} />

      <div className="mt-[18px] flex justify-center lg:hidden">
        <JkResumePage content={result.content} marks={result.marks} width={170} height={222} />
      </div>

      <JkOnbLabel className="mt-[26px] lg:mt-[29px]">What changed and why</JkOnbLabel>
      <ul className="mt-[13px] space-y-4 lg:mt-[15px] lg:space-y-[14px]">
        {result.changes.length === 0 && <li className="text-[13px] text-muted-foreground">Your base resume already fits this posting, so nothing needed to move.</li>}
        {result.changes.map((c) => (
          <li key={c.section} className="flex gap-[13px] lg:gap-[15px]">
            <span aria-hidden className="mt-0.5 h-[30px] w-[3px] shrink-0 rounded-full bg-bar-3 lg:h-[34px]" />
            <span>
              <span className="block text-[14.5px] font-medium leading-[17px] lg:text-[15px] lg:leading-[18px]">{c.title}</span>
              <span className="mt-[3px] block text-[12.5px] leading-[15px] text-muted-foreground lg:text-[13px]">{c.note}</span>
            </span>
          </li>
        ))}
      </ul>

      <JkOnbMobileBar>
        <Button onClick={onDownload} disabled={downloading} className={cn(primaryBtn, "w-auto min-w-0 flex-[220] px-3")}>{downloading ? "Downloading…" : "Download PDF"}</Button>
        <Button variant="secondary" onClick={onOpenJobs} className={cn(primaryBtn, "w-auto min-w-0 flex-[122] border-input bg-popover px-3 text-[16px] hover:bg-accent")}>My Jobs</Button>
      </JkOnbMobileBar>

      <div className="mt-7 hidden gap-3 lg:flex">
        <Button onClick={onDownload} disabled={downloading} className={cn(primaryBtn, "lg:w-[200px]")}>{downloading ? "Downloading…" : "Download PDF"}</Button>
        <Button variant="secondary" onClick={onOpenJobs} className={cn(primaryBtn, "border-input bg-popover hover:bg-accent lg:w-[180px]")}>Open My Jobs</Button>
      </div>

      <div className="mt-[30px] hidden border-t border-border pt-[19px] lg:block">
        <JkOnbLabel>Next, when you are ready</JkOnbLabel>
        <ul className="mt-[19px] space-y-[17px]">
          {[
            { title: "Install the Chrome extension", sub: "Save a posting from any site in one click", plan: "Plus", href: "/app?mode=settings" },
            { title: "Set up the jk CLI", sub: "Let Claude Code or Cursor run your search", plan: "Pro", href: "/app?mode=settings" },
          ].map((n) => (
            <li key={n.title}>
              <Link href={n.href} className="group flex gap-[13px]">
                <span aria-hidden className="mt-px size-4 shrink-0 rounded-full border-[1.5px] border-border-strong transition-colors group-hover:border-foreground" />
                <span>
                  <span className="flex items-center gap-[31px] text-[14.5px] font-medium leading-[17px]">
                    {n.title}
                    <span className="rounded-full bg-plan/14 px-2 py-[2.5px] font-mono text-[9.5px] font-bold uppercase leading-[13px] tracking-[0.08em] text-plan-text">{n.plan}</span>
                  </span>
                  <span className="mt-1 block text-[12.5px] leading-[15px] text-muted-foreground">{n.sub}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

export function JkOnbReadyAside({ base, result, job }: { base: OnbBase | null; result: OnbResult | null; job: OnbJob | null }) {
  const t = result?.job ?? job;
  return (
    <>
      <JkOnbLabel>{t ? `Resume · ${t.title}, ${t.company}` : "Resume"}</JkOnbLabel>
      <div className="mt-[27px] flex justify-center">
        <FitPage>{(w) => (result ? <JkResumePage content={result.content} marks={result.marks} width={w} /> : base ? <JkResumePage content={base.content} width={w} /> : <EmptyPage width={w} height={(w * 580) / 440} />)}</FitPage>
      </div>
      <p className="mt-[39px] text-[14px] leading-[17px] text-muted-foreground">{result ? "Blue marks the lines that changed." : "Blue will mark the lines that change."}</p>
    </>
  );
}
