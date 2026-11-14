'use client'

/**
 * My Jobs. Desktop D03 (table + right rail) and D04 (grouped columns + command bar),
 * phone M01 (status chips + list + floating Add job). Dialogs: D05/M02 job details
 * (jkJobExpanded), D06/M13 add job (jkJobInputModal).
 *
 * Keyboard (desktop): J/K or ↓/↑ move, Enter opens, G writes a resume, / searches,
 * X toggles a row while selecting, Esc clears, ⌘K opens the command bar.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, LogIn, Plus, Search, X } from "lucide-react";
import { useJobs, type Job } from "@/providers/jkJobsProvider";
import { useJobKompassResume } from "@/providers/jkResumeProvider";
import { useJobKompassDocuments } from "@/providers/jkDocumentsProvider";
import { useJobKompassChatWindow } from "@/providers/jkChatWindowProvider";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { stepIndex } from "@/lib/jkJobs";
import { JOB_STATUSES, STATUS_BG, statusKey } from "@/lib/jkStatus";
import { toast } from "@/lib/toast";
import { rateLimitMessageFromResponse } from "@/lib/rateLimit/message";
import { Id } from "@/convex/_generated/dataModel";
import JkAppPageHeader from "../jk-app/jkAppPageHeader";
import JkSegmented from "../jk-app/jkSegmented";
import { useJkAppNav } from "../jk-app/jkAppNav";
import JkStatusBar from "../jkStatusBar";
import { JkStatusGlyph } from "../jkStatusChip";
import JkTemplateSelector, { TemplateType, ResumeInputOptions } from "../jkTemplateSelector";
import JkUpgradeModal from "../jkUpgradeModal";
import JkJobInputModal from "../jkJobInputModal";
import { JkJobsGrouped, JkJobsPhoneList, JkJobsTable } from "./jkJobsGrid";
import JkJobExpanded from "./jkJobExpanded";
import JkJobRail from "./jkJobRail";
import JkJobsCommandBar from "./jkJobsCommandBar";

type View = "table" | "grouped";
type JobId = Id<"jobs">;
const VIEW_KEY = "jk:jobs:view";

function useMedia(query: string) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const set = () => setOn(mq.matches);
    set();
    mq.addEventListener("change", set);
    return () => mq.removeEventListener("change", set);
  }, [query]);
  return on;
}

const isTyping = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
};

/** M01 status chips: All + one per non-empty status. */
function StatusChips({ counts, total, active, onSelect }: { counts: { status: string; count: number }[]; total: number; active: string | null; onSelect: (s: string | null) => void }) {
  const chip = "flex h-9 shrink-0 items-center gap-2 rounded-full px-4 text-[14px] font-medium text-foreground transition-colors";
  const tint: Record<string, string> = {
    interested: "bg-status-interested/14", applied: "bg-status-applied/14", callback: "bg-status-callback/14", interviewing: "bg-status-interviewing/14",
    offered: "bg-status-offered/14", rejected: "bg-status-rejected/14", ghosted: "bg-status-ghosted/14",
  };
  return (
    <div className="relative -mx-5">
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-5" role="group" aria-label="Filter by status">
        <button type="button" onClick={() => onSelect(null)} aria-pressed={active === null} className={cn(chip, "border-[1.5px]", active === null ? "border-plan bg-accent" : "border-transparent bg-accent/60")}>
          All <span className="font-mono text-[12px]">{total}</span>
        </button>
        {counts.filter((c) => c.count > 0).map((c) => {
          const k = statusKey(c.status);
          const on = active === c.status;
          return (
            <button key={c.status} type="button" onClick={() => onSelect(on ? null : c.status)} aria-pressed={on} className={cn(chip, "border-[1.5px]", tint[k], on ? "border-plan" : "border-transparent")}>
              <span aria-hidden className={cn("size-2 rounded-full", STATUS_BG[k])} />
              {c.status} <span className="font-mono text-[12px] font-normal text-muted-foreground">{c.count}</span>
            </button>
          );
        })}
        <span aria-hidden className="w-3 shrink-0" />
      </div>
      <span aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-[60px] bg-gradient-to-l from-background to-transparent" />
    </div>
  );
}

export default function JkCW_MyJobsMode() {
  const {
    isAuthenticated, authLoading, jobs, allJobs, filteredJobs, searchQuery, setSearchQuery, statusCounts,
    selectedStatus, setSelectedStatus, selectedJobId, setSelectedJobId,
    selectionMode, setSelectionMode, selectedJobIds, toggleJobSelection, setJobSelection, clearJobSelection,
    handleBulkDeleteJobs, handleBulkStatusJobs,
  } = useJobs();
  const { resumes } = useJobKompassResume();
  const { coverLetterList } = useJobKompassDocuments();
  const { setSelectedInterviewPrepJobId, setCurrentThreadId, setTextValue } = useJobKompassChatWindow();
  const nav = useJkAppNav();
  const { canGenerateDocument, upgradeModal, setUpgradeModal } = useFeatureAccess();

  const wide = useMedia("(min-width: 1280px)"); // rail beside the table
  const desk = useMedia("(min-width: 768px)"); // table / grouped (phone list below)

  const [view, setViewState] = useState<View>("table");
  useEffect(() => { try { const v = localStorage.getItem(VIEW_KEY); if (v === "table" || v === "grouped") setViewState(v); } catch { /* storage blocked */ } }, []);
  const setView = (v: View) => { setViewState(v); try { localStorage.setItem(VIEW_KEY, v); } catch { /* storage blocked */ } };

  const [focusedId, setFocusedId] = useState<JobId | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const cmdRef = useRef<HTMLInputElement>(null);

  // Template selector (Write resume) — the existing generation flow.
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [templateSelectorType, setTemplateSelectorType] = useState<TemplateType>("resume");
  const [jobForGeneration, setJobForGeneration] = useState<Job | null>(null);
  const [referenceResumeId, setReferenceResumeId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Keep the focused job valid as the list filters and changes.
  useEffect(() => {
    if (filteredJobs.length === 0) { if (focusedId) setFocusedId(null); return; }
    if (!focusedId || !filteredJobs.some((j) => j._id === focusedId)) setFocusedId(filteredJobs[0]._id);
  }, [filteredJobs, focusedId]);
  useEffect(() => { if (!selectionMode) setConfirmBulkDelete(false); }, [selectionMode]);

  const focusedJob = useMemo(() => filteredJobs.find((j) => j._id === focusedId) ?? null, [filteredJobs, focusedId]);

  const counts = useMemo(() => {
    const known = JOB_STATUSES.map((s) => ({ status: s as string, count: statusCounts[s] ?? 0 }));
    const extra = Object.keys(statusCounts).filter((s) => !(JOB_STATUSES as readonly string[]).includes(s)).map((s) => ({ status: s, count: statusCounts[s] }));
    return [...known, ...extra];
  }, [statusCounts]);
  const total = allJobs.length;
  const applied = statusCounts["Applied"] ?? 0;
  const interviewing = statusCounts["Interviewing"] ?? 0;
  const ctx = { resumes: Array.isArray(resumes) ? resumes.length : 0, letters: Array.isArray(coverLetterList) ? coverLetterList.length : 0, jobs: total };

  const openWriteResume = useCallback((job: Job) => {
    setTemplateSelectorType("resume");
    setJobForGeneration(job);
    setReferenceResumeId(null);
    setIsTemplateModalOpen(true);
  }, []);
  const openPrep = useCallback((job: Job) => {
    setSelectedJobId(null);
    setSelectedInterviewPrepJobId(job._id);
    nav.go("/interview-prep");
  }, [nav, setSelectedJobId, setSelectedInterviewPrepJobId]);

  const sendToChat = useCallback((text: string) => {
    setCmdOpen(false);
    setCurrentThreadId(null);
    setTextValue(text);
    nav.go("/chat");
    // Chat mounts with the text in its input, then sends it as the first message.
    window.setTimeout(() => window.dispatchEvent(new Event("jk:sendChat")), 350);
  }, [nav, setCurrentThreadId, setTextValue]);

  const scrollToJob = (id: JobId) => {
    requestAnimationFrame(() => document.querySelector(`[data-job-row="${id}"]`)?.scrollIntoView({ block: "nearest" }));
  };
  const move = useCallback((delta: number) => {
    const i = filteredJobs.findIndex((j) => j._id === focusedId);
    const next = stepIndex(i, delta, filteredJobs.length);
    if (next >= 0) { setFocusedId(filteredJobs[next]._id); scrollToJob(filteredJobs[next]._id); }
  }, [filteredJobs, focusedId]);

  // Keyboard.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen(true);
        requestAnimationFrame(() => cmdRef.current?.focus());
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      if (selectedJobId || addOpen || isTemplateModalOpen || document.querySelector("[data-jk-dialog],[role=dialog]")) return;
      const k = e.key;
      if (k === "j" || k === "ArrowDown") { e.preventDefault(); move(1); }
      else if (k === "k" || k === "ArrowUp") { e.preventDefault(); move(-1); }
      else if (k === "Enter" && focusedId) { e.preventDefault(); if (selectionMode) toggleJobSelection(focusedId); else setSelectedJobId(focusedId); }
      else if (k === "x" && selectionMode && focusedId) { e.preventDefault(); toggleJobSelection(focusedId); }
      else if (k === "g" && focusedJob) { e.preventDefault(); openWriteResume(focusedJob); }
      else if (k === "/") { e.preventDefault(); searchRef.current?.focus(); }
      else if (k === "Escape") {
        if (cmdOpen) setCmdOpen(false);
        else if (selectionMode) setSelectionMode(false);
        else if (selectedStatus) setSelectedStatus(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [move, focusedId, focusedJob, selectedJobId, addOpen, isTemplateModalOpen, selectionMode, cmdOpen, selectedStatus, toggleJobSelection, setSelectedJobId, setSelectionMode, setSelectedStatus, openWriteResume]);

  const handleTemplateSelect = async (templateId: string, resumeInput?: ResumeInputOptions) => {
    if (!jobForGeneration) return;
    setIsGenerating(true);
    const typeLabel = templateSelectorType === "resume" ? "resume" : "cover letter";
    const toastId = toast.loading(`Writing a ${typeLabel} for ${jobForGeneration.company || "you"}...`);
    try {
      const body: Record<string, unknown> = {
        templateType: templateSelectorType,
        templateId,
        jobId: jobForGeneration._id?.toString(),
        jobTitle: jobForGeneration.title,
        jobCompany: jobForGeneration.company,
      };
      if (templateSelectorType === "resume") {
        body.referenceResumeId = resumeInput?.referenceResumeId ?? referenceResumeId ?? undefined;
        if (resumeInput) { body.resumePdf = resumeInput.resumePdf; body.resumeText = resumeInput.resumeText; body.promptText = resumeInput.promptText; }
      }
      const response = await fetch("/api/template/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (response.status === 429) throw new Error(rateLimitMessageFromResponse(response));
      const data = await response.json();
      if (!response.ok || !data.success) {
        if (data.limitReached || response.status === 403) { canGenerateDocument(); throw new Error(data.message || "Document limit reached"); }
        throw new Error(data.error || "Failed to generate document");
      }
      toast.dismiss(toastId);
      toast.success(`${templateSelectorType === "resume" ? "Resume" : "Cover letter"} for ${jobForGeneration.company} is ready`, {
        description: data.keywords?.length ? `Keywords used: ${data.keywords.join(", ")}` : "It is in My Documents.",
      });
      setIsTemplateModalOpen(false);
      setJobForGeneration(null);
    } catch (error) {
      toast.dismiss(toastId);
      toast.error(`Could not write the ${typeLabel}`, { description: error instanceof Error ? error.message : "Something went wrong. Try again." });
    } finally {
      setIsGenerating(false);
    }
  };

  if (authLoading) {
    return <div className="flex h-full items-center justify-center text-muted-foreground">Loading...</div>;
  }
  if (!isAuthenticated) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
        <h2 className="text-[23px] font-medium tracking-[-0.4px]">Sign in to see your jobs</h2>
        <p className="mt-2 max-w-sm text-muted-foreground">Every job you save, with its status, resume and notes.</p>
        <Button className="mt-6 gap-2" onClick={() => window.dispatchEvent(new CustomEvent("jk:openSignIn"))}>
          <LogIn className="size-4" /> Sign in
        </Button>
      </div>
    );
  }

  const loading = jobs === undefined;
  const showRail = desk && wide && view === "table";
  const onRowClick = (id: JobId) => { setFocusedId(id); if (!showRail) setSelectedJobId(id); };

  const empty = !loading && filteredJobs.length === 0 && (
    <div className="flex flex-col items-center px-6 py-20 text-center">
      {total === 0 ? (
        <>
          <p className="text-[18px] font-medium text-foreground">No jobs saved yet</p>
          <p className="mt-2 max-w-sm text-[14px] text-muted-foreground">Paste a link to a posting and JobKompass saves the whole thing.</p>
          <Button className="mt-6 h-10 px-6" onClick={() => setAddOpen(true)}>Add job</Button>
        </>
      ) : (
        <>
          <p className="text-[16px] font-medium text-foreground">No jobs match</p>
          <Button variant="secondary" className="mt-4 h-9 px-5" onClick={() => { setSearchQuery(""); setSelectedStatus(null); }}>Clear filters</Button>
        </>
      )}
    </div>
  );

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <JkAppPageHeader
        title="My Jobs"
        sub={`${total} saved · ${applied} applied · ${interviewing} interviewing`}
        art="waves"
        actions={desk ? (
          <div className="hidden flex-wrap items-center gap-2.5 md:flex">
            <label className="relative block w-[clamp(200px,calc(100vw-700px),420px)]">
              <Search aria-hidden className="pointer-events-none absolute left-[19px] top-1/2 size-3.5 -translate-y-1/2 text-subtle-foreground" strokeWidth={1.8} />
              <input
                ref={searchRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Escape") { setSearchQuery(""); e.currentTarget.blur(); } }}
                placeholder="Search title, company, notes, skills"
                aria-label="Search jobs"
                className="h-10 w-full rounded-full border border-input bg-card pl-11 pr-9 text-[14px] text-foreground outline-none transition-[border-color] placeholder:text-subtle-foreground focus-visible:border-plan"
              />
              {searchQuery && (
                <button type="button" onClick={() => setSearchQuery("")} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 text-subtle-foreground hover:text-foreground">
                  <X className="size-4" />
                </button>
              )}
            </label>
            <JkSegmented<View> ariaLabel="Layout" value={view} onChange={setView} options={[{ value: "table", label: "Table" }, { value: "grouped", label: "Grouped" }]} />
            <Button variant="secondary" aria-pressed={selectionMode} className={cn("h-10 px-[22px] text-[13.5px]", selectionMode && "bg-accent")} onClick={() => setSelectionMode(!selectionMode)}>
              {selectionMode ? "Done" : "Select"}
            </Button>
            <Button className="h-10 px-[30px] text-[14px]" onClick={() => setAddOpen(true)}>Add job</Button>
          </div>
        ) : undefined}
        bottom={
          <>
            <div className="hidden md:block md:pt-[38px] lg:pt-[41px]">
              <JkStatusBar counts={counts} active={selectedStatus} onSelect={setSelectedStatus} />
            </div>
            <div className="space-y-4 md:hidden">
              <JkStatusBar counts={counts} active={selectedStatus} onSelect={setSelectedStatus} size="sm" />
              <StatusChips counts={counts} total={total} active={selectedStatus} onSelect={setSelectedStatus} />
            </div>
          </>
        }
        className="pb-3.5 pt-1 md:pb-5 md:pt-4 lg:pt-5"
      />

      <div className="flex min-h-0 flex-1">
        <div className="chat-scroll min-w-0 flex-1 overflow-y-auto" key={`${view}-${desk ? "d" : "m"}`}>
          {loading ? (
            <div className="space-y-px px-8 pt-12" aria-busy>
              {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-11 animate-pulse rounded-lg bg-card" />)}
            </div>
          ) : empty ? empty : !desk ? (
            <JkJobsPhoneList jobs={filteredJobs} total={total} selectionMode={selectionMode} selectedIds={selectedJobIds} onOpen={(id) => setSelectedJobId(id)} onToggle={toggleJobSelection} />
          ) : view === "table" ? (
            <JkJobsTable
              jobs={filteredJobs}
              total={total}
              focusedId={focusedId}
              selectionMode={selectionMode}
              selectedIds={selectedJobIds}
              onRowClick={onRowClick}
              onRowOpen={(id) => setSelectedJobId(id)}
              onToggle={(id) => { setFocusedId(id); toggleJobSelection(id); }}
            />
          ) : (
            <JkJobsGrouped
              jobs={filteredJobs}
              focusedId={focusedId}
              selectionMode={selectionMode}
              selectedIds={selectedJobIds}
              onCardClick={(id) => { setFocusedId(id); if (selectionMode) toggleJobSelection(id); else setSelectedJobId(id); }}
              onMore={(status) => { setSelectedStatus(status); setView("table"); }}
            />
          )}
        </div>
        {showRail && (
          <JkJobRail
            job={focusedJob}
            onOpen={() => focusedJob && setSelectedJobId(focusedJob._id)}
            onWriteResume={() => focusedJob && openWriteResume(focusedJob)}
            onPrep={() => focusedJob && openPrep(focusedJob)}
            className="jk-enter w-[416px] shrink-0 border-l border-border"
          />
        )}
      </div>

      {/* Command bar: always on the grouped board (D04); ⌘K brings it up anywhere. */}
      {!selectionMode && desk && (view === "grouped" || cmdOpen) && (
        <div className={cn("pointer-events-none absolute inset-x-0 bottom-0 z-20 px-5 pb-4 lg:px-8", showRail && "right-[416px]")}>
          <div className="pointer-events-auto [animation:jk-enter_0.4s_cubic-bezier(0.16,1,0.3,1)_both]">
            <JkJobsCommandBar ref={cmdRef} counts={ctx} onSubmit={sendToChat} onEscape={() => setCmdOpen(false)} />
          </div>
        </div>
      )}
      {!desk && cmdOpen && (
        <div className="fixed inset-x-0 top-16 z-40 px-4">
          <JkJobsCommandBar ref={cmdRef} counts={ctx} onSubmit={sendToChat} onEscape={() => setCmdOpen(false)} />
        </div>
      )}

      {/* Bulk actions while selecting */}
      {selectionMode && (
        <div className="fixed inset-x-0 bottom-[calc(var(--jk-tabbar-h)+16px)] z-30 flex justify-center px-4 lg:absolute lg:bottom-4">
          <div role="toolbar" aria-label="Selected jobs" className="flex max-w-full flex-wrap items-center gap-2 rounded-full border border-input bg-popover py-1.5 pl-5 pr-1.5 shadow-[0_10px_40px_-12px_var(--scrim)] [animation:jk-enter_0.4s_cubic-bezier(0.16,1,0.3,1)_both]">
            <span className="mr-1 font-mono text-[12px] text-muted-foreground">{selectedJobIds.length} selected</span>
            {confirmBulkDelete ? (
              <>
                <span className="text-[13.5px] text-foreground">Delete {selectedJobIds.length} job{selectedJobIds.length === 1 ? "" : "s"}?</span>
                <Button variant="destructive" className="h-9 px-4 text-[13px]" onClick={async () => { const n = selectedJobIds.length; await handleBulkDeleteJobs(); toast.success(`Deleted ${n} job${n === 1 ? "" : "s"}`); }}>Delete</Button>
                <Button variant="ghost" className="h-9 px-4 text-[13px]" onClick={() => setConfirmBulkDelete(false)}>Keep</Button>
              </>
            ) : (
              <>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="secondary" className="h-9 gap-1.5 px-4 text-[13px]" disabled={selectedJobIds.length === 0}>
                      Set status <ChevronDown className="size-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="center" side="top" className="min-w-44">
                    {JOB_STATUSES.map((s) => (
                      <DropdownMenuItem key={s} onSelect={async () => { const n = selectedJobIds.length; await handleBulkStatusJobs(s); toast.success(`${n} job${n === 1 ? "" : "s"} moved to ${s}`); clearJobSelection(); }} className="gap-2.5">
                        <JkStatusGlyph status={s} className="size-[13px]" /> {s}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button variant="destructive" className="h-9 px-4 text-[13px]" disabled={selectedJobIds.length === 0} onClick={() => setConfirmBulkDelete(true)}>Delete</Button>
                <Button
                  variant="ghost"
                  className="h-9 px-4 text-[13px]"
                  onClick={() => (selectedJobIds.length === filteredJobs.length ? clearJobSelection() : setJobSelection(filteredJobs.map((j) => j._id)))}
                >
                  {selectedJobIds.length === filteredJobs.length && filteredJobs.length > 0 ? "Select none" : "Select all shown"}
                </Button>
                <Button className="h-9 px-5 text-[13px]" onClick={() => setSelectionMode(false)}>Done</Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Phone: floating Add job above the tab bar (M01) and Select in the corner */}
      {!desk && !selectionMode && (
        <div className="fixed bottom-[calc(var(--jk-tabbar-h)+16px)] right-5 z-30 flex items-center gap-2">
          {total > 0 && (
            <Button variant="secondary" className="h-[52px] rounded-full px-5 text-[15px] shadow-lg" onClick={() => setSelectionMode(true)}>Select</Button>
          )}
          <Button className="h-[52px] gap-2.5 rounded-full pl-[19px] pr-6 text-[15px] font-semibold shadow-lg" onClick={() => setAddOpen(true)}>
            <Plus className="size-4" strokeWidth={2} /> Add job
          </Button>
        </div>
      )}

      <JkJobExpanded onWriteResume={(job) => { setSelectedJobId(null); openWriteResume(job); }} onPrep={openPrep} />

      <JkJobInputModal
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        onJobAdded={(id) => { if (id) { setSelectedStatus(null); setSearchQuery(""); setFocusedId(id); scrollToJob(id); } }}
        onOpenExtension={() => { setAddOpen(false); nav.go("/settings"); }}
      />

      <JkTemplateSelector
        isOpen={isTemplateModalOpen}
        onClose={() => { setIsTemplateModalOpen(false); setJobForGeneration(null); setReferenceResumeId(null); }}
        type={templateSelectorType}
        onSelectTemplate={handleTemplateSelect}
        isGenerating={isGenerating}
        jobTitle={jobForGeneration?.title}
        jobCompany={jobForGeneration?.company}
        referenceResumes={(resumes || []).map((r: { _id?: string; id?: string; name?: string }) => ({ id: (r._id || r.id) as string, name: r.name || "Untitled resume" }))}
        selectedReferenceResumeId={referenceResumeId}
        onSelectReferenceResume={setReferenceResumeId}
      />

      <JkUpgradeModal
        isOpen={upgradeModal.isOpen}
        onClose={() => setUpgradeModal((prev) => ({ ...prev, isOpen: false }))}
        feature={upgradeModal.feature}
        currentLimit={upgradeModal.currentLimit}
        currentPlan={upgradeModal.currentPlan}
      />
    </div>
  );
}
