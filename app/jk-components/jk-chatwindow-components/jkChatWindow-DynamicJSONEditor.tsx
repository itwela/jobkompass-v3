'use client'

/**
 * The live resume editor (D08 desktop / M15 phone). Opens from My Documents.
 *
 * Saving still works the way it always has: every save POSTs the content to
 * /api/resume/export/{template}, uploads the PDF and swaps it in with
 * replaceResumeFile — so "Saved" always means the stored PDF matches the editor.
 * Saves run automatically a moment after you stop typing (and on ⌘S / leaving).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Lock, X } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { getResumeExportRoute, getDefaultResumeTemplateId, RESUME_TEMPLATES, resolveResumeTemplateId, resumeTemplateMinRank } from "@/lib/templates";
import { rankLabel, type PlanRank } from "@/convex/plans";
import { trackResumeExported } from "@/lib/analytics/client";
import { toDownloadFileName } from "@/lib/downloadFileName";
import { cleanResumeContent, countPdfPages, linkedCompanyFor, templateShortName } from "@/lib/documents/documentMeta";
import type { ResumeContent } from "@/lib/resume/types";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { useJobs } from "@/providers/jkJobsProvider";
import JkResumePage from "../jk-onboarding/jkResumePage";
import JkResumeSectionEditor, { focusFor, resumeTabs, type JkResumeTab } from "../jk-documents/jkResumeSectionEditor";
import { JkEditorTopBar, JkSavePill, type JkSaveState } from "../jk-documents/jkEditorTopBar";
import { hasRenderableResume } from "../jk-documents/jkDocThumb";
import JkUpgradeModal from "../jkUpgradeModal";

interface DynamicJSONEditorProps {
    resumeId: Id<"resumes">;
    onClose: () => void;
}

const AUTOSAVE_MS = 2500;
const PAGE_W = 480; // D08 page width at 100%
const PAGE_H = 660;

const emptyContent = (): ResumeContent => ({ personalInfo: { email: "" } });

export default function JkCW_DynamicJSONEditor({ resumeId, onClose }: DynamicJSONEditorProps) {
    const resume = useQuery(api.documents.getResume, { resumeId });
    const rank = (useQuery(api.usage.currentPlanRank, {}) ?? 0) as PlanRank;
    const fileUrl = useQuery(api.documents.getFileUrl, resume?.fileId ? { fileId: resume.fileId } : "skip");
    const generateUploadUrl = useMutation(api.documents.generateUploadUrl);
    const replaceResumeFile = useMutation(api.documents.replaceResumeFile);
    const shareResume = useMutation(api.resumeShares.shareResume);
    const { allJobs } = useJobs();

    const [content, setContent] = useState<ResumeContent | null>(null);
    const [saveState, setSaveState] = useState<JkSaveState>("saved");
    const [template, setTemplate] = useState<string>(getDefaultResumeTemplateId());
    const [switching, setSwitching] = useState<string | null>(null);
    const [isDownloading, setIsDownloading] = useState(false);
    const [isSharing, setIsSharing] = useState(false);
    const [tab, setTab] = useState<JkResumeTab>("experience");
    const [item, setItem] = useState(0);
    const [pages, setPages] = useState<number | null>(null);
    const [showPreview, setShowPreview] = useState(false);
    const [upgradeFor, setUpgradeFor] = useState<string | null>(null);

    // Latest values for async save code.
    const contentRef = useRef<ResumeContent | null>(null);
    const templateRef = useRef(template);
    const dirtyRef = useRef(false);
    const savingRef = useRef<Promise<boolean> | null>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    contentRef.current = content;
    templateRef.current = template;

    // Load once from the stored resume.
    useEffect(() => {
        if (!resume || content) return;
        const c = (resume.content && typeof resume.content === "object" ? resume.content : emptyContent()) as ResumeContent;
        setContent(c);
        setTemplate(resolveResumeTemplateId(resume.template || getDefaultResumeTemplateId()));
        if (!(c.experience?.length)) setTab(c.personalInfo?.summary ? "summary" : "header");
    }, [resume, content]);

    // Real page count of the stored PDF.
    useEffect(() => {
        if (!fileUrl) return;
        let cancelled = false;
        fetch(fileUrl)
            .then((r) => (r.ok ? r.arrayBuffer() : null))
            .then((buf) => { if (!cancelled && buf) setPages(countPdfPages(new Uint8Array(buf))); })
            .catch(() => {});
        return () => { cancelled = true; };
    }, [fileUrl]);

    /** Regenerate the PDF from the editor content and store it on this resume. */
    const save = useCallback(async (): Promise<boolean> => {
        if (savingRef.current) {
            await savingRef.current;
            if (!dirtyRef.current) return true;
        }
        const run = (async () => {
            const raw = contentRef.current;
            if (!raw) return false;
            const contentToSave = cleanResumeContent(raw);
            dirtyRef.current = false;
            setSaveState("saving");
            try {
                const pdfResponse = await fetch(getResumeExportRoute(templateRef.current), {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ content: contentToSave }),
                });
                if (!pdfResponse.ok) {
                    const errorData = await pdfResponse.json().catch(() => ({}));
                    throw new Error(errorData.message || errorData.error || "PDF generation failed");
                }
                const pdfBlob = await pdfResponse.blob();
                const uploadUrl = await generateUploadUrl();
                const uploadResponse = await fetch(uploadUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/pdf" },
                    body: pdfBlob,
                });
                if (!uploadResponse.ok) throw new Error("Failed to upload PDF to storage");
                const { storageId } = await uploadResponse.json();
                const firstName = contentToSave.personalInfo?.firstName || "";
                const lastName = contentToSave.personalInfo?.lastName || "";
                await replaceResumeFile({
                    resumeId,
                    newFileId: storageId as Id<"_storage">,
                    fileName: `resume-${firstName}-${lastName}.pdf`.replace(/\s+/g, "-"),
                    fileSize: pdfBlob.size,
                    content: contentToSave,
                });
                setPages(countPdfPages(new Uint8Array(await pdfBlob.arrayBuffer())));
                setSaveState(dirtyRef.current ? "unsaved" : "saved");
                return true;
            } catch (error) {
                console.error("Failed to save resume:", error);
                dirtyRef.current = true;
                setSaveState("error");
                toast.error("Couldn't save your resume", { description: error instanceof Error ? error.message : undefined });
                return false;
            }
        })();
        savingRef.current = run;
        try {
            return await run;
        } finally {
            if (savingRef.current === run) savingRef.current = null;
        }
    }, [generateUploadUrl, replaceResumeFile, resumeId]);

    const flush = useCallback(async () => {
        if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
        if (dirtyRef.current) return save();
        if (savingRef.current) return savingRef.current;
        return true;
    }, [save]);

    const onChange = (next: ResumeContent) => {
        setContent(next);
        dirtyRef.current = true;
        setSaveState("unsaved");
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => { timerRef.current = null; void save(); }, AUTOSAVE_MS);
    };

    // ⌘S / Ctrl+S saves now; leaving the page saves what's pending.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") { e.preventDefault(); void flush(); }
        };
        const onUnload = (e: BeforeUnloadEvent) => { if (dirtyRef.current || savingRef.current) e.preventDefault(); };
        window.addEventListener("keydown", onKey);
        window.addEventListener("beforeunload", onUnload);
        return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("beforeunload", onUnload); };
    }, [flush]);
    useEffect(() => () => { if (timerRef.current) { clearTimeout(timerRef.current); if (dirtyRef.current) void save(); } }, [save]);

    const close = () => { void flush(); onClose(); };

    const switchTemplate = async (next: string) => {
        if (next === template || switching) return;
        if (rank < resumeTemplateMinRank(next)) { setUpgradeFor(next); return; }
        setSwitching(next);
        try {
            // The switch route re-renders the stored content, so store the latest first.
            const ok = await flush();
            if (!ok) return;
            const res = await fetch("/api/resume/switch-template", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ resumeId, templateId: next }),
            });
            if (res.status === 402) { setUpgradeFor(next); return; }
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.message || body.error || "Template switch failed");
            }
            setTemplate(next);
            setPages(null);
            setSaveState("saved");
        } catch (error) {
            toast.error("Couldn't switch the template", { description: error instanceof Error ? error.message : undefined });
        } finally {
            setSwitching(null);
        }
    };

    const share = async () => {
        setIsSharing(true);
        try {
            if (!resume?.fileId) await flush();
            const result = await shareResume({ resumeId });
            if (result.shared) {
                try { await navigator.clipboard.writeText(result.url); toast.success("Share link copied", { description: result.url }); }
                catch { toast.success("Share link ready", { description: result.url }); }
            }
        } catch (error) {
            console.error("Failed to share:", error);
            toast.error("Couldn't create a share link");
        } finally {
            setIsSharing(false);
        }
    };

    const download = async () => {
        if (!content) return;
        setIsDownloading(true);
        try {
            const response = await fetch(getResumeExportRoute(template), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content: cleanResumeContent(content) }),
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || errorData.error || "PDF generation failed");
            }
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = toDownloadFileName(resume?.name || "resume");
            document.body.appendChild(a);
            a.click();
            a.remove();
            // Revoking right away can cancel the download before the browser reads the blob (mobile Safari).
            setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
            trackResumeExported({ method: "export", template_id: template });
        } catch (error) {
            console.error("Download error:", error);
            toast.error("Couldn't download the PDF", { description: error instanceof Error ? error.message : undefined });
        } finally {
            setIsDownloading(false);
        }
    };

    const company = useMemo(() => (resume ? linkedCompanyFor({ _id: resume._id, name: resume.name, documentType: "resume" }, allJobs) : null), [resume, allJobs]);
    const tabs = content ? resumeTabs(content) : [];
    const activeTab = tabs.includes(tab) ? tab : "header";
    const focus = focusFor(activeTab, item);
    const title = resume?.name || "Resume";

    if (resume === undefined || !content) {
        return (
            <div className="flex min-h-0 flex-1 flex-col">
                <div className="h-14 border-b border-border lg:h-[72px]" />
                <div className="grid flex-1 gap-6 p-5 lg:grid-cols-[minmax(0,560px)_1fr] lg:p-8">
                    <div className="space-y-4">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-11 animate-pulse rounded-xl bg-card" />)}</div>
                    <div className="hidden animate-pulse rounded-[4px] bg-card lg:block" />
                </div>
            </div>
        );
    }

    const templateRow = (
        <JkTemplateRow template={template} rank={rank} switching={switching} pages={pages} onPick={(id) => void switchTemplate(id)} />
    );

    return (
        <div key={String(resumeId)} data-enter className="flex min-h-full flex-col lg:h-full lg:min-h-0">
            <JkEditorTopBar
                title={title}
                onBack={close}
                status={<JkSavePill state={saveState} />}
                aside={company}
                actions={
                    <>
                        <Button variant="secondary" onClick={() => void share()} disabled={isSharing} className="h-[38px] bg-popover px-4 text-[13.5px]">
                            {isSharing ? "Copying…" : "Share link"}
                        </Button>
                        <Button onClick={() => void download()} disabled={isDownloading} className="h-[38px] px-4 text-[13.5px]">
                            {isDownloading ? "Preparing…" : "Download PDF"}
                        </Button>
                    </>
                }
            />

            <div className="flex flex-1 flex-col lg:grid lg:min-h-0 lg:grid-cols-[minmax(440px,560px)_minmax(0,1fr)]">
                {/* Left: section tabs, fields, template row */}
                <div className="jk-enter flex min-w-0 flex-col lg:min-h-0 lg:border-r lg:border-border" style={{ "--i": 1 } as React.CSSProperties}>
                    <div className="flex flex-1 flex-col lg:min-h-0 lg:overflow-y-auto">
                        <JkResumeSectionEditor
                            content={content}
                            onChange={onChange}
                            tab={activeTab}
                            onTab={setTab}
                            item={item}
                            onItem={setItem}
                            resumeName={resume?.name}
                        />
                        <div className="border-t border-border px-5 pb-6 pt-5 lg:hidden">{templateRow}</div>
                    </div>
                    <div className="hidden h-[60px] shrink-0 items-center border-t border-border px-8 lg:flex">{templateRow}</div>
                </div>

                {/* Right: live page with the section being edited highlighted */}
                <aside aria-label="Preview" className="jk-enter hidden min-w-0 flex-col bg-card lg:flex lg:min-h-0" style={{ "--i": 2 } as React.CSSProperties}>
                    <JkLivePreview content={content} focus={focus} pages={pages} />
                </aside>
            </div>

            {/* Phone: bottom actions above the tab bar (M15). */}
            <div className="sticky z-20 mt-auto flex gap-2 border-t border-border bg-card px-5 pb-3 pt-3.5 lg:hidden" style={{ bottom: "calc(var(--jk-tabbar-h, 0px))" }}>
                <Button onClick={() => void download()} disabled={isDownloading} className="h-11 flex-[1.9] text-[15px]">{isDownloading ? "Preparing…" : "Download PDF"}</Button>
                <Button variant="secondary" onClick={() => setShowPreview(true)} className="h-11 flex-1 bg-popover text-[15px]">Preview</Button>
                <Button variant="secondary" onClick={() => void share()} disabled={isSharing} aria-label="Share link" className="hidden h-11 flex-1 bg-popover text-[15px] sm:inline-flex">Share link</Button>
            </div>

            {showPreview && (
                <div role="dialog" aria-modal="true" aria-label="Preview" className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-sm lg:hidden">
                    <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-5">
                        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-subtle-foreground">Preview{pages ? ` · ${pages} page${pages === 1 ? "" : "s"}` : ""}</p>
                        <button type="button" aria-label="Close preview" onClick={() => setShowPreview(false)} className="flex size-10 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"><X className="size-5" /></button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-5">
                        <JkFitPage content={content} focus={focus} />
                    </div>
                    <div className="flex gap-2 border-t border-border bg-card px-5 py-3.5">
                        <Button onClick={() => void download()} disabled={isDownloading} className="h-11 flex-1 text-[15px]">{isDownloading ? "Preparing…" : "Download PDF"}</Button>
                        <Button variant="secondary" onClick={() => void share()} disabled={isSharing} className="h-11 flex-1 bg-popover text-[15px]">Share link</Button>
                    </div>
                </div>
            )}

            <JkUpgradeModal
                isOpen={upgradeFor !== null}
                onClose={() => setUpgradeFor(null)}
                feature={`The ${templateShortName(RESUME_TEMPLATES.find((t) => t.id === upgradeFor)?.name) ?? "this"} template`}
                currentLimit={upgradeFor ? `Needs the ${rankLabel(resumeTemplateMinRank(upgradeFor))} plan` : ""}
                currentPlan={rankLabel(rank)}
            />
        </div>
    );
}

/** TEMPLATE  (Jake) (Joseph) (Mar)  ·  N PAGE — locked templates show a lock and open the upgrade sheet. */
function JkTemplateRow({ template, rank, switching, pages, onPick }: { template: string; rank: PlanRank; switching: string | null; pages: number | null; onPick: (id: string) => void }) {
    return (
        <div className="flex w-full flex-wrap items-center gap-x-5 gap-y-3">
            <p className="w-full font-mono text-[10px] uppercase leading-[13px] tracking-[0.12em] text-subtle-foreground lg:w-auto">Template</p>
            <div role="radiogroup" aria-label="Template" className="flex items-center gap-1.5">
                {RESUME_TEMPLATES.map((t) => {
                    const active = t.id === template;
                    const locked = rank < resumeTemplateMinRank(t.id);
                    return (
                        <button
                            key={t.id}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            disabled={switching !== null}
                            onClick={() => onPick(t.id)}
                            title={locked ? `${templateShortName(t.name)} needs the ${rankLabel(resumeTemplateMinRank(t.id))} plan` : undefined}
                            className={cn(
                                "flex h-11 items-center gap-1.5 rounded-full border px-6 text-[15px] font-medium transition-colors disabled:cursor-wait lg:h-7 lg:px-4 lg:text-[12.5px]",
                                active ? "border-plan bg-accent text-foreground" : "border-input text-muted-foreground hover:text-foreground",
                                switching === t.id && "animate-pulse",
                            )}
                        >
                            {templateShortName(t.name)}
                            {locked && <Lock aria-label="Paid plan" className="size-3 text-plan-text" />}
                        </button>
                    );
                })}
            </div>
            {pages ? <p className="ml-auto font-mono text-[10px] uppercase tracking-[0.12em] text-subtle-foreground lg:hidden">{pages} page{pages === 1 ? "" : "s"}</p> : null}
        </div>
    );
}

/** D08 preview column: "PREVIEW · PAGE 1 OF N", zoom %, the page scaled to fit. */
function JkLivePreview({ content, focus, pages }: { content: ResumeContent; focus: ReturnType<typeof focusFor>; pages: number | null }) {
    const boxRef = useRef<HTMLDivElement | null>(null);
    const [w, setW] = useState(PAGE_W);
    useEffect(() => {
        const el = boxRef.current;
        if (!el) return;
        const ro = new ResizeObserver(() => {
            const rect = el.getBoundingClientRect();
            const byW = rect.width - 64;
            const byH = ((rect.height - 16) * PAGE_W) / PAGE_H;
            setW(Math.max(260, Math.min(PAGE_W, byW, Math.max(byH, 340))));
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, []);
    const scroller = useRef<HTMLDivElement | null>(null);
    // Keep the highlighted section in view as you move between sections.
    useEffect(() => {
        const box = scroller.current;
        const el = box?.querySelector("[data-focus]") as HTMLElement | null;
        if (!box || !el) return;
        const top = el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop;
        if (top < box.scrollTop || top > box.scrollTop + box.clientHeight - 80) box.scrollTo({ top: Math.max(0, top - 120), behavior: "smooth" });
    }, [focus?.section, focus?.index]);
    return (
        <>
            <div className="flex h-[52px] shrink-0 items-end justify-between px-8 pb-2 font-mono text-[10px] uppercase leading-[13px] tracking-[0.12em] text-subtle-foreground">
                <span>Preview{pages ? ` · ${pages} page${pages === 1 ? "" : "s"}` : ""}</span>
                <span>{Math.round((w / PAGE_W) * 100)}%</span>
            </div>
            <div ref={boxRef} className="min-h-0 flex-1">
                <div ref={scroller} className="flex h-full justify-center overflow-y-auto px-8 pb-8 pt-4">
                    {hasRenderableResume(content) ? (
                        <JkResumePage content={content} focus={focus} width={w} height="auto" className="shadow-[0_24px_60px_var(--scrim)]" />
                    ) : (
                        <p className="mt-20 text-[14px] text-muted-foreground">Fill in the header to see your page.</p>
                    )}
                </div>
            </div>
        </>
    );
}

/** Phone preview: the page at the screen's width. */
function JkFitPage({ content, focus }: { content: ResumeContent; focus: ReturnType<typeof focusFor> }) {
    const ref = useRef<HTMLDivElement | null>(null);
    const [w, setW] = useState(340);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const ro = new ResizeObserver(() => setW(Math.min(PAGE_W, el.clientWidth)));
        ro.observe(el);
        return () => ro.disconnect();
    }, []);
    return (
        <div ref={ref} className="mx-auto w-full max-w-[480px]">
            <JkResumePage content={content} focus={focus} width={w} height="auto" />
        </div>
    );
}
