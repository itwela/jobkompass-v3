'use client'

/**
 * A resume the chat wrote, in the three places it shows up (frames D02, M04, M05):
 * - JkChatResultCard: the gold-ruled card in the conversation.
 * - JkChatArtifactsPanel: the right panel on wide screens (page + margin notes + must-haves).
 * - JkChatChangesSheet: "What changed and why", full screen below the panel breakpoint.
 * All three read the same artifact (tool result) merged with the live resume document.
 */
import { createPortal } from "react-dom";
import { useLayoutEffect, useRef, useState } from "react";
import { ChevronLeft, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import JkResumePage from "@/app/jk-components/jk-onboarding/jkResumePage";
import { useJobKompassResume } from "@/providers/jkResumeProvider";
import { useJobKompassDocuments } from "@/providers/jkDocumentsProvider";
import { useJobKompassChatWindow } from "@/providers/jkChatWindowProvider";
import { useSubscription } from "@/providers/jkSubscriptionProvider";
import { RESUME_TEMPLATES, canUseResumeTemplate } from "@/lib/templates";
import { useRouter } from "next/navigation";
import type { ChatArtifact, ResumeTailoring } from "@/lib/chat/toolTrace";
import type { ResumeContent } from "@/lib/resume/types";
import type { Id } from "@/convex/_generated/dataModel";
import JkSegmented from "@/app/jk-components/jk-app/jkSegmented";
import { JkResumeScorecardLine } from "@/app/jk-components/jk-resume-questions/jkResumeQuestionsCard";

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

/** The artifact merged with its live document (content, current file, stored tailoring). */
export function useChatArtifact(artifact: ChatArtifact | null | undefined) {
  const { resumes } = useJobKompassResume();
  const doc = artifact?.resumeId ? (resumes ?? []).find((r: any) => String(r._id) === String(artifact.resumeId)) : undefined;
  const tailoring: ResumeTailoring | undefined = artifact?.tailoring ?? (doc as any)?.tailoring;
  return {
    doc,
    content: (doc?.content ?? null) as ResumeContent | null,
    tailoring,
    storageId: (doc?.fileId ?? artifact?.storageId) as Id<"_storage"> | undefined,
    template: doc?.template as string | undefined,
    missing: !!artifact?.resumeId && resumes !== undefined && !doc,
  };
}

/** Download, and open the resume in the editor (My Documents). */
export function useArtifactActions() {
  const { downloadFirstVersionResume, selectDocument } = useJobKompassDocuments();
  const { allModes, setCurrentMode } = useJobKompassChatWindow();
  return {
    download: (storageId: Id<"_storage"> | undefined, fileName: string) => downloadFirstVersionResume(storageId, fileName),
    openInEditor: (resumeId?: string) => {
      if (!resumeId) return;
      selectDocument(resumeId, "resume");
      const docs = allModes.find((m) => m.id === "/documents");
      if (!docs) return;
      setCurrentMode(docs);
      // The editor lives inside My Documents; it listens for this once mounted (same as Search).
      setTimeout(() => window.dispatchEvent(new CustomEvent("jk:openDocumentEdit", { detail: { documentId: resumeId, documentType: "resume" } })), 120);
    },
  };
}

/** Small mono pill: "3 CHANGES", "8/10 MUST-HAVES". */
function Pill({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("inline-flex h-[18px] shrink-0 items-center rounded-full bg-bar-4/14 px-[7px] font-mono text-[9.5px] font-bold uppercase leading-none tracking-[0.08em] text-bar-4-ink dark:text-bar-4", className)}>{children}</span>;
}

/** A thumbnail of the real page; a plain sheet while the document loads. */
function Thumb({ content, tailoring, width, height }: { content: ResumeContent | null; tailoring?: ResumeTailoring; width: number; height: number }) {
  if (!content) return <div className="shrink-0 rounded-[4px] bg-paper-warm" style={{ width, height }} />;
  return <JkResumePage content={content} marks={tailoring?.marks} width={width} height={height} className="shadow-none" />;
}

/** The card in the conversation (D02 / M04). */
export function JkChatResultCard({ artifact, onOpen, onWriteLetter }: { artifact: ChatArtifact; onOpen: () => void; onWriteLetter?: () => void }) {
  const { content, tailoring, storageId } = useChatArtifact(artifact);
  const { download } = useArtifactActions();
  const isResume = artifact.kind === "resume";
  const pages = tailoring?.pages;
  const changes = tailoring?.changes.length;
  const mh = tailoring?.mustHaves;
  const meta = [pages ? plural(pages, "page") : null, changes != null ? plural(changes, "change") : null].filter(Boolean) as string[];
  return (
    <div className="rounded-[22px] border border-plan bg-card p-4 sm:rounded-[20px] sm:px-4 sm:py-[14px]">
      <div className="flex gap-4">
        {isResume ? (
          <>
            <span className="hidden sm:block"><Thumb content={content} tailoring={tailoring} width={60} height={84} /></span>
            <span className="sm:hidden"><Thumb content={content} tailoring={tailoring} width={70} height={96} /></span>
          </>
        ) : (
          <div className="flex h-[84px] w-[60px] shrink-0 items-center justify-center rounded-[4px] bg-paper-warm font-mono text-[9px] font-bold text-paper-foreground">PDF</div>
        )}
        <div className="min-w-0 flex-1 sm:pt-[9px]">
          <p className="break-words text-[15px] font-medium leading-[20px] text-foreground">{artifact.title}</p>
          {/* Desktop: one mono line. Phone: caps line + must-haves pill. */}
          <p className="mt-1 hidden font-mono text-[11.5px] leading-[15px] text-subtle-foreground sm:block">
            {[...meta, isResume ? "saved to My Documents" : "saved to My Documents"].join(" · ")}
          </p>
          {meta.length > 0 && <p className="mt-2 font-mono text-[9.5px] uppercase leading-[13px] tracking-[0.12em] text-subtle-foreground sm:hidden">{meta.join(" · ")}</p>}
          {mh && mh.total > 0 && <Pill className="mt-2 sm:hidden">{mh.met.length}/{mh.total} must-haves</Pill>}
          <div className="mt-[10px] hidden flex-wrap gap-2 sm:flex">
            {isResume && <Button size="sm" className="h-8 px-6 text-[13px]" onClick={onOpen}>Open in panel</Button>}
            <Button size="sm" variant="secondary" className="h-8 px-[22px] text-[13px]" onClick={() => download(storageId, artifact.fileName)}>Download</Button>
            {isResume && onWriteLetter && <Button size="sm" variant="secondary" className="h-8 px-[22px] text-[13px]" onClick={onWriteLetter}>Write the cover letter</Button>}
          </div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-[100fr_104fr_98fr] gap-2 sm:hidden">
        {isResume && <Button className="h-[42px] text-[14.5px]" onClick={onOpen}>Open</Button>}
        <Button variant="secondary" className={cn("h-[42px] text-[14.5px]", !isResume && "col-span-3")} onClick={() => download(storageId, artifact.fileName)}>Download</Button>
        {isResume && <Button variant="secondary" className="h-[42px] text-[14.5px]" onClick={onWriteLetter} disabled={!onWriteLetter}>Letter</Button>}
      </div>
    </div>
  );
}

/** Must-haves score: segmented bar + what was left out (D02). */
export function JkMustHaves({ tailoring }: { tailoring?: ResumeTailoring }) {
  const mh = tailoring?.mustHaves;
  if (!mh || mh.total === 0) return null;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="text-[15px] font-medium leading-[18px] text-foreground">Must-haves</p>
        <p className="font-mono text-[13px] font-medium text-foreground">{mh.met.length}/{mh.total}</p>
      </div>
      <div className="mt-[10px] flex gap-[6px]" aria-label={`${mh.met.length} of ${mh.total} must-haves on this resume`}>
        {Array.from({ length: mh.total }, (_, i) => (
          <span key={i} className={cn("h-[5px] flex-1 rounded-full", i < mh.met.length ? "bg-bar-4" : "bg-input")} />
        ))}
      </div>
      {mh.missing.length > 0 && (
        <ul className="mt-[18px] space-y-[13px]">
          {mh.missing.map((term) => (
            <li key={term} className="flex items-center gap-3">
              <X className="size-[13px] shrink-0 text-destructive" strokeWidth={2} aria-hidden />
              <span className="min-w-0 flex-1 truncate text-[14px] leading-[17px] text-foreground">{term}</span>
              <span className="shrink-0 font-mono text-[11px] text-subtle-foreground">left out, not on your resume</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The page with a note beside each changed passage, joined by a short rule. */
function PageWithNotes({ content, tailoring, width }: { content: ResumeContent; tailoring?: ResumeTailoring; width: number }) {
  const notesW = 150;
  const gap = 14;
  const pageW = Math.max(240, Math.min(344, width - notesW - gap));
  const pageH = Math.round(pageW * (470 / 344));
  const wrap = useRef<HTMLDivElement>(null);
  const [spots, setSpots] = useState<{ top: number; line: number; from: number }[]>([]);
  const changes = tailoring?.changes ?? [];

  useLayoutEffect(() => {
    const host = wrap.current;
    if (!host) return;
    const place = () => {
      const box = host.getBoundingClientRect();
      let floor = 0;
      const next = changes.map((c) => {
        const el = host.querySelector<HTMLElement>(`[data-mark="${c.section}"]`);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        const mid = r.top - box.top + Math.min(r.height, 60) / 2;
        const top = Math.max(floor, Math.min(mid - 25, pageH - 50));
        floor = top + 56;
        return { top, line: Math.min(Math.max(mid, top + 10), top + 40), from: r.right - box.left };
      });
      setSpots(next.filter(Boolean) as { top: number; line: number; from: number }[]);
    };
    place();
    const id = window.setTimeout(place, 300); // fonts settle
    return () => window.clearTimeout(id);
  }, [content, tailoring, pageW, pageH, changes]);

  return (
    <div ref={wrap} className="relative" style={{ height: pageH }}>
      <JkResumePage content={content} marks={tailoring?.marks} width={pageW} height={pageH} className="rounded-[4px] shadow-none" />
      {changes.map((c, i) => {
        const s = spots[i];
        if (!s) return null;
        return (
          <div key={c.section}>
            <span aria-hidden className="absolute h-px bg-bar-3" style={{ left: s.from, top: s.line, width: pageW + gap + 16 - s.from }} />
            <div className="absolute rounded-[12px] border border-bar-3 bg-card px-3 py-[6px]" style={{ left: pageW + gap + 16, top: s.top, width: Math.min(notesW, width - pageW - gap - 16) }}>
              <p className="font-mono text-[8.5px] font-bold uppercase leading-[11px] tracking-[0.14em] text-bar-4-ink dark:text-bar-4">Changed</p>
              <p className="mt-px text-[11px] leading-[14px] text-foreground">{c.note}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Re-renders a saved resume in another template (server route is the gate). */
function TemplateRow({ resumeId, current }: { resumeId: string; current?: string }) {
  const { rank } = useSubscription();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const value = busy ?? current ?? "jake";
  const pick = async (templateId: string) => {
    if (templateId === current) return;
    if (!canUseResumeTemplate(templateId, rank)) { router.push("/pricing"); return; }
    setBusy(templateId);
    setError(null);
    try {
      const res = await fetch("/api/resume/switch-template", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resumeId, templateId }) });
      if (!res.ok) { const b = await res.json().catch(() => ({})); setError(b.message || b.error || "That template could not be applied."); }
    } catch { setError("That template could not be applied."); } finally { setBusy(null); }
  };
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-[15px] font-medium text-foreground">Template</p>
      <JkSegmented size="sm" ariaLabel="Resume template" value={value} onChange={pick} options={RESUME_TEMPLATES.map((t) => ({ value: t.id, label: t.name.replace("JobKompass ", "") }))} />
      {error && <p className="w-full text-[12.5px] text-destructive">{error}</p>}
    </div>
  );
}

/** Right panel on wide screens (D02). */
export function JkChatArtifactsPanel({ artifacts, selectedKey, onSelect }: { artifacts: ChatArtifact[]; selectedKey: string | null; onSelect: (key: string) => void }) {
  const artifact = artifacts.find((a) => a.key === selectedKey) ?? artifacts[artifacts.length - 1];
  const { content, tailoring, storageId, template } = useChatArtifact(artifact);
  const { download, openInEditor } = useArtifactActions();
  const body = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(520);
  useLayoutEffect(() => {
    const el = body.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  if (!artifact) return null;
  const pages = tailoring?.pages;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-[78px] shrink-0 items-center gap-3 border-b border-border px-7">
        <p className="text-[16px] font-medium text-foreground">Artifacts</p>
        <span className="flex size-5 items-center justify-center rounded-full border-[1.5px] border-input font-mono text-[11px] font-medium text-muted-foreground">{artifacts.length}</span>
        <div className="ml-auto flex gap-2">
          <Button variant="secondary" className="h-9 px-[18px] text-[13.5px]" onClick={() => download(storageId, artifact.fileName)}>Download</Button>
          {artifact.kind === "resume" && <Button className="h-9 px-6 text-[13.5px]" onClick={() => openInEditor(artifact.resumeId)}>Open in editor</Button>}
        </div>
      </div>
      <div className="chat-scroll min-h-0 flex-1 overflow-y-auto px-7 pb-10 pt-[18px]">
        <div ref={body}>
          {/* One row per document this chat wrote; the open one is outlined. */}
          <div className="space-y-2">
            {artifacts.map((a) => (
              <button key={a.key} type="button" onClick={() => onSelect(a.key)} data-active={a.key === artifact.key ? "" : undefined}
                className="flex h-[50px] w-full items-center gap-[14px] rounded-[14px] border border-border bg-card px-[14px] text-left transition-colors hover:border-input data-[active]:border-input">
                <span className="flex h-[26px] w-6 shrink-0 items-center justify-center rounded-[5px] border border-bar-3 font-mono text-[7.5px] font-bold tracking-[0.05em] text-bar-3">PDF</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium leading-[17px] text-foreground">{a.title}</span>
                  <span className="mt-[3px] block font-mono text-[9.5px] uppercase leading-[13px] tracking-[0.12em] text-subtle-foreground">
                    {[a.tailoring?.pages ? plural(a.tailoring.pages, "page") : null, a.seconds ? `${a.seconds}s` : null].filter(Boolean).join(" · ") || (a.kind === "resume" ? "Resume" : "Cover letter")}
                  </span>
                </span>
                {a.tailoring && a.tailoring.changes.length > 0 && <Pill>{plural(a.tailoring.changes.length, "change")}</Pill>}
              </button>
            ))}
          </div>

          {artifact.kind === "resume" && (
            <div className="mt-4">
              {content ? (
                <PageWithNotes content={content} tailoring={tailoring} width={w} />
              ) : (
                <div className="rounded-[4px] bg-paper-warm" style={{ width: Math.min(344, w), height: Math.min(344, w) * (470 / 344) }} />
              )}
              <p className="mt-[10px] font-mono text-[9.5px] uppercase tracking-[0.12em] text-subtle-foreground" style={{ width: Math.max(240, Math.min(344, w - 164)), textAlign: "center" }}>
                Page 1 of {pages ?? 1}
              </p>
              <JkResumeScorecardLine scorecard={artifact.scorecard} className="mt-3" />
              {(tailoring?.mustHaves?.total ?? 0) > 0 && (
                <div className="mt-6 border-t border-border pt-[18px]"><JkMustHaves tailoring={tailoring} /></div>
              )}
              {artifact.resumeId && (
                <div className="mt-6 border-t border-border pt-[18px]"><TemplateRow resumeId={artifact.resumeId} current={template} /></div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** "What changed and why": full screen below the panel breakpoint (M05). */
export function JkChatChangesSheet({ artifact, onClose }: { artifact: ChatArtifact; onClose: () => void }) {
  const { content, tailoring, storageId } = useChatArtifact(artifact);
  const { download, openInEditor } = useArtifactActions();
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(350);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const changes = tailoring?.changes ?? [];
  return createPortal(
    
    <div role="dialog" aria-modal aria-label="What changed and why" className="fixed inset-0 z-[70] flex flex-col bg-background">
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4 sm:px-6">
        <button type="button" onClick={onClose} aria-label="Back to the chat" className="-ml-1 flex size-9 items-center justify-center rounded-full text-foreground hover:bg-accent">
          <ChevronLeft className="size-5" strokeWidth={1.75} />
        </button>
        <p className="text-[20px] font-semibold leading-6 tracking-[-0.015em] text-foreground">Resume</p>
        {changes.length > 0 && <p className="ml-4 font-mono text-[12px] text-subtle-foreground">{plural(changes.length, "change")}</p>}
      </div>
      <div className="chat-scroll min-h-0 flex-1 overflow-y-auto px-5 pb-[300px] pt-5">
        <div ref={box} className="mx-auto w-full max-w-[560px]">
          {content ? (
            <JkResumePage content={content} marks={tailoring?.marks} width={w} height={Math.round(w * (470 / 350))} className="shadow-none" />
          ) : (
            <div className="rounded-[4px] bg-paper-warm" style={{ height: Math.round(w * (470 / 350)) }} />
          )}
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 rounded-t-[20px] border-t border-input bg-card px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-[10px]">
        <div className="mx-auto w-full max-w-[560px]">
          <span aria-hidden className="mx-auto block h-1 w-10 rounded-full bg-border-strong" />
          <p className="mt-[22px] font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-subtle-foreground">What changed and why</p>
          <JkResumeScorecardLine scorecard={artifact.scorecard} className="mt-2" />
          {changes.length > 0 ? (
            <ul className="mt-4 space-y-[18px]">
              {changes.map((c) => (
                <li key={c.section} className="flex gap-[13px]">
                  <span aria-hidden className="mt-0.5 h-[26px] w-[3px] shrink-0 rounded-full bg-bar-3" />
                  <span>
                    <span className="block text-[14px] font-medium leading-[17px] text-foreground">{c.title}</span>
                    <span className="mt-px block text-[12.5px] leading-[15px] text-muted-foreground">{c.note}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-[13px] text-muted-foreground">No differences from your base resume.</p>
          )}
          <div className="mt-6 grid grid-cols-[220fr_122fr] gap-2">
            <Button className="h-[52px] text-[16px]" onClick={() => download(storageId, artifact.fileName)}>Download PDF</Button>
            <Button variant="secondary" className="h-[52px] text-[16px]" onClick={() => { onClose(); openInEditor(artifact.resumeId); }}>Edit</Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
