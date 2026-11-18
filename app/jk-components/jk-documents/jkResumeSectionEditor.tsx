'use client'

import { JkConfirmMenuItem } from "../jkConfirm";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Reorder, useDragControls } from "framer-motion";
import { ChevronLeft, ChevronRight, MoreVertical, Plus, Trash2, ArrowUp, ArrowDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { ResumeContent } from "@/lib/resume/types";
import { moveItem, parseRewrite } from "@/lib/documents/documentMeta";
import { cn } from "@/lib/utils";
import { JkFieldLabel, jkFieldCls } from "../jkField";
import type { JkResumeFocus } from "../jk-onboarding/jkResumePage";

export type JkResumeTab = "header" | "summary" | "skills" | "experience" | "internships" | "projects" | "education" | "certifications";

const TAB_LABEL: Record<JkResumeTab, string> = {
  header: "Header", summary: "Summary", skills: "Skills", experience: "Experience", internships: "Internships",
  projects: "Projects", education: "Education", certifications: "Certifications",
};

/** The tabs this resume needs: the six from D08, plus Internships / Certifications when it has them. */
export function resumeTabs(content: ResumeContent): JkResumeTab[] {
  const tabs: JkResumeTab[] = ["header", "summary", "skills", "experience"];
  if (content.internships?.length) tabs.push("internships");
  tabs.push("projects", "education");
  if (content.certifications?.length) tabs.push("certifications");
  return tabs;
}

/** Which part of the page to highlight for the current tab + item. */
export function focusFor(tab: JkResumeTab, item: number): JkResumeFocus {
  if (tab === "header" || tab === "summary" || tab === "skills") return { section: tab };
  return { section: tab, index: item };
}

type Listy = "experience" | "internships" | "projects" | "education" | "certifications";
const LIST_TABS: Listy[] = ["experience", "internships", "projects", "education", "certifications"];
const isListTab = (t: JkResumeTab): t is Listy => (LIST_TABS as string[]).includes(t);

const blank: Record<Listy, () => any> = {
  experience: () => ({ company: "", title: "", date: "", location: "", details: [""] }),
  internships: () => ({ company: "", title: "", date: "", location: "", details: [""] }),
  projects: () => ({ name: "", description: "", date: "", technologies: [], details: [] }),
  education: () => ({ name: "", degree: "", field: "", location: "", startDate: "", endDate: "" }),
  certifications: () => ({ name: "", issuer: "", date: "" }),
};

const clone = <T,>(v: T): T => (typeof structuredClone === "function" ? structuredClone(v) : JSON.parse(JSON.stringify(v)));

/**
 * The left column of the resume editor (D08 / M15): section tabs, the fields of
 * the current section, drag-to-reorder bullets and the "Rewrite with JobKompass" card.
 * Content is controlled: every edit calls `onChange` with a new ResumeContent.
 */
export default function JkResumeSectionEditor({ content, onChange, tab, onTab, item, onItem, resumeName }: {
  content: ResumeContent;
  onChange: (next: ResumeContent) => void;
  tab: JkResumeTab;
  onTab: (t: JkResumeTab) => void;
  item: number;
  onItem: (i: number) => void;
  resumeName?: string;
}) {
  const tabs = resumeTabs(content);
  const update = (fn: (draft: ResumeContent) => void) => {
    const next = clone(content);
    fn(next);
    onChange(next);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <JkSectionTabs tabs={tabs} value={tab} onChange={(t) => { onTab(t); onItem(0); }} />
      <div key={tab} data-enter className="jk-stagger flex flex-col gap-0 px-5 pb-8 pt-6 lg:px-8">
        {tab === "header" && <HeaderFields content={content} update={update} />}
        {tab === "summary" && <SummaryFields content={content} update={update} resumeName={resumeName} />}
        {tab === "skills" && <SkillsFields content={content} update={update} />}
        {isListTab(tab) && <ListSection tab={tab} content={content} update={update} item={item} onItem={onItem} resumeName={resumeName} />}
      </div>
    </div>
  );
}

/* ─── Tabs ─────────────────────────────────────────────────────────────── */

function JkSectionTabs({ tabs, value, onChange }: { tabs: JkResumeTab[]; value: JkResumeTab; onChange: (t: JkResumeTab) => void }) {
  const activeRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => { activeRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" }); }, [value]);
  return (
    <div className="relative shrink-0 border-b border-border">
      <div role="tablist" aria-label="Resume sections" className="no-scrollbar flex gap-7 overflow-x-auto px-5 lg:px-8">
        {tabs.map((t) => {
          const active = t === value;
          return (
            <button
              key={t}
              ref={active ? activeRef : undefined}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(t)}
              className={cn(
                "relative shrink-0 pb-[13px] pt-[19px] text-[15px] leading-[18px] transition-colors lg:pb-[9px] lg:pt-[19px] lg:text-[13.5px] lg:leading-4",
                active ? "font-medium text-foreground" : "text-subtle-foreground hover:text-muted-foreground",
              )}
            >
              {TAB_LABEL[t]}
              {active && <span aria-hidden className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-plan" />}
            </button>
          );
        })}
      </div>
      <span aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-background to-transparent lg:hidden" />
    </div>
  );
}

/* ─── Field primitives ─────────────────────────────────────────────────── */

function Field({ id, label, value, onChange, mono, placeholder, type = "text", className }: {
  id: string; label: string; value?: string | null; onChange: (v: string) => void; mono?: boolean; placeholder?: string; type?: string; className?: string;
}) {
  return (
    <div className={cn("jk-enter min-w-0", className)}>
      <JkFieldLabel htmlFor={id}>{label}</JkFieldLabel>
      <input
        id={id}
        type={type}
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={cn(jkFieldCls, "h-11 rounded-[12px] bg-card", mono && "font-mono text-[14.5px]")}
      />
    </div>
  );
}

/** Textarea that grows with its text. */
function GrowArea({ id, value, onChange, className, placeholder, onFocus, rows = 1, ariaLabel }: {
  id?: string; value: string; onChange: (v: string) => void; className?: string; placeholder?: string; onFocus?: () => void; rows?: number; ariaLabel?: string;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      id={id}
      rows={rows}
      value={value}
      aria-label={ariaLabel}
      placeholder={placeholder}
      onFocus={onFocus}
      onChange={(e) => onChange(e.target.value)}
      className={cn("block w-full resize-none bg-transparent outline-none placeholder:text-subtle-foreground", className)}
    />
  );
}

function AreaField({ id, label, value, onChange, hint, placeholder }: { id: string; label: string; value: string; onChange: (v: string) => void; hint?: string; placeholder?: string }) {
  return (
    <div className="jk-enter">
      <JkFieldLabel htmlFor={id} aside={hint ? <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-subtle-foreground">{hint}</span> : undefined}>{label}</JkFieldLabel>
      <div className={cn(jkFieldCls, "rounded-[12px] px-3.5 py-3 focus-within:border-plan focus-within:shadow-[0_0_0_0.5px_var(--plan)]")}>
        <GrowArea id={id} value={value} onChange={onChange} placeholder={placeholder} rows={3} className="min-h-[66px] text-[14.5px] leading-[21px]" />
      </div>
    </div>
  );
}

/* ─── Sections ─────────────────────────────────────────────────────────── */

type Upd = (fn: (d: ResumeContent) => void) => void;

function HeaderFields({ content, update }: { content: ResumeContent; update: Upd }) {
  const pi = content.personalInfo ?? ({} as ResumeContent["personalInfo"]);
  const set = (k: keyof ResumeContent["personalInfo"]) => (v: string) => update((d) => { d.personalInfo = { ...(d.personalInfo ?? { email: "" }), [k]: v }; });
  return (
    <div className="grid grid-cols-1 gap-x-4 gap-y-[14px] sm:grid-cols-2">
      <Field id="pi-first" label="First name" value={pi.firstName ?? (pi.firstName === undefined && pi.name ? pi.name.split(" ")[0] : "")} onChange={set("firstName")} />
      <Field id="pi-last" label="Last name" value={pi.lastName ?? (pi.lastName === undefined && pi.name ? pi.name.split(" ").slice(1).join(" ") : "")} onChange={set("lastName")} />
      <Field id="pi-email" label="Email" type="email" value={pi.email} onChange={set("email")} />
      <Field id="pi-phone" label="Phone" type="tel" value={pi.phone} onChange={set("phone")} />
      <Field id="pi-location" label="Location" value={pi.location} onChange={set("location")} />
      <Field id="pi-linkedin" label="LinkedIn" value={pi.linkedin} onChange={set("linkedin")} />
      <Field id="pi-github" label="GitHub" value={pi.github} onChange={set("github")} />
      <Field id="pi-portfolio" label="Portfolio" value={pi.portfolio} onChange={set("portfolio")} />
    </div>
  );
}

function SummaryFields({ content, update, resumeName }: { content: ResumeContent; update: Upd; resumeName?: string }) {
  const summary = content.personalInfo?.summary ?? "";
  return (
    <div className="flex flex-col gap-6">
      <AreaField id="pi-summary" label="Professional summary" value={summary} onChange={(v) => update((d) => { d.personalInfo = { ...(d.personalInfo ?? { email: "" }), summary: v }; })} />
      {summary.trim().length > 0 && (
        <JkRewriteCard
          key={summary.slice(0, 40)}
          target="your summary"
          original={summary}
          content={content}
          resumeName={resumeName}
          onApply={(text) => update((d) => { d.personalInfo = { ...(d.personalInfo ?? { email: "" }), summary: text }; })}
        />
      )}
    </div>
  );
}

const lines = (a?: (string | null)[] | null) => (a ?? []).join("\n");
// Blank lines stay while typing; cleanResumeContent drops them before export.
const fromLines = (v: string) => v.split("\n");

function SkillsFields({ content, update }: { content: ResumeContent; update: Upd }) {
  return (
    <div className="flex flex-col gap-[18px]">
      <AreaField
        id="skills-technical"
        label="Technical skills"
        hint="One per line"
        placeholder={"Languages: Python\nTypeScript"}
        value={lines(content.skills?.technical)}
        onChange={(v) => update((d) => { d.skills = { ...(d.skills ?? {}), technical: fromLines(v) }; })}
      />
      <AreaField
        id="skills-additional"
        label="Additional skills"
        hint="One per line"
        value={lines(content.skills?.additional)}
        onChange={(v) => update((d) => { d.skills = { ...(d.skills ?? {}), additional: fromLines(v) }; })}
      />
    </div>
  );
}

function ListSection({ tab, content, update, item, onItem, resumeName }: { tab: Listy; content: ResumeContent; update: Upd; item: number; onItem: (i: number) => void; resumeName?: string }) {
  const list = ((content as any)[tab] ?? []) as any[];
  const i = Math.min(item, Math.max(0, list.length - 1));
  const entry = list[i];
  const setField = (k: string) => (v: string) => update((d) => { ((d as any)[tab] as any[])[i][k] = v; });
  const add = () => { update((d) => { (d as any)[tab] = [...(((d as any)[tab] as any[]) ?? []), blank[tab]()]; }); onItem(list.length); };
  const remove = () => { update((d) => { ((d as any)[tab] as any[]).splice(i, 1); }); onItem(Math.max(0, i - 1)); };
  const move = (to: number) => { update((d) => { (d as any)[tab] = moveItem((d as any)[tab] as any[], i, to); }); onItem(to); };

  if (!entry) {
    return (
      <div className="jk-enter flex flex-col items-start gap-4 rounded-[16px] border border-dashed border-input px-5 py-6">
        <p className="text-[14px] text-muted-foreground">No {TAB_LABEL[tab].toLowerCase()} on this resume yet.</p>
        <Button variant="secondary" onClick={add} className="h-[34px] bg-popover px-5 text-[13px]"><Plus />Add {singular(tab)}</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="jk-enter mb-[15px] flex h-[13px] items-center gap-2">
        <p className="font-mono text-[10px] font-medium uppercase leading-[13px] tracking-[0.12em] text-subtle-foreground">
          {TAB_LABEL[tab]} · {i + 1} of {list.length}
        </p>
        {list.length > 1 && (
          <span className="flex items-center">
            <button type="button" aria-label="Previous" disabled={i === 0} onClick={() => onItem(i - 1)} className="flex size-7 items-center justify-center rounded-full text-subtle-foreground hover:bg-accent hover:text-foreground disabled:opacity-30"><ChevronLeft className="size-3.5" /></button>
            <button type="button" aria-label="Next" disabled={i === list.length - 1} onClick={() => onItem(i + 1)} className="flex size-7 items-center justify-center rounded-full text-subtle-foreground hover:bg-accent hover:text-foreground disabled:opacity-30"><ChevronRight className="size-3.5" /></button>
          </span>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" aria-label={`${TAB_LABEL[tab]} options`} className="-mr-2 ml-auto flex size-8 items-center justify-center rounded-full text-subtle-foreground hover:bg-accent hover:text-foreground">
              <MoreVertical className="size-4" strokeWidth={1.6} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={add}><Plus className="size-4" />Add {singular(tab)}</DropdownMenuItem>
            <DropdownMenuItem disabled={i === 0} onClick={() => move(i - 1)}><ArrowUp className="size-4" />Move up</DropdownMenuItem>
            <DropdownMenuItem disabled={i === list.length - 1} onClick={() => move(i + 1)}><ArrowDown className="size-4" />Move down</DropdownMenuItem>
            <DropdownMenuSeparator />
            <JkConfirmMenuItem onConfirm={remove}><Trash2 className="size-4" />Delete this {singular(tab)}</JkConfirmMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div key={i} className="flex flex-col gap-[14px]">
        {(tab === "experience" || tab === "internships") && (
          <>
            <div className="grid grid-cols-1 gap-x-4 gap-y-[14px] sm:grid-cols-2">
              <Field id="e-title" label="Title" value={entry.title} onChange={setField("title")} />
              <Field id="e-company" label="Company" value={entry.company} onChange={setField("company")} />
            </div>
            <div className="grid grid-cols-1 gap-x-4 gap-y-[14px] min-[360px]:grid-cols-2">
              <Field id="e-date" label="Dates" mono value={entry.date} onChange={setField("date")} placeholder="2024 - Present" />
              <Field id="e-location" label="Location" value={entry.location} onChange={setField("location")} />
            </div>
          </>
        )}
        {tab === "projects" && (
          <>
            <div className="grid grid-cols-1 gap-x-4 gap-y-[14px] sm:grid-cols-2">
              <Field id="p-name" label="Name" value={entry.name} onChange={setField("name")} />
              <Field id="p-date" label="Date" mono value={entry.date} onChange={setField("date")} />
            </div>
            <AreaField id="p-desc" label="Description" value={entry.description ?? ""} onChange={setField("description")} />
            <Field id="p-tech" label="Technologies" value={(entry.technologies ?? []).join(", ")} onChange={(v) => update((d) => { ((d as any)[tab] as any[])[i].technologies = v.split(",").map((s) => s.trim()).filter(Boolean); })} placeholder="React, Convex" />
          </>
        )}
        {tab === "education" && (
          <>
            <Field id="ed-school" label="School" value={entry.name} onChange={setField("name")} />
            <div className="grid grid-cols-1 gap-x-4 gap-y-[14px] sm:grid-cols-2">
              <Field id="ed-degree" label="Degree" value={entry.degree} onChange={setField("degree")} />
              <Field id="ed-field" label="Field" value={entry.field} onChange={setField("field")} />
            </div>
            <div className="grid grid-cols-1 gap-x-4 gap-y-[14px] min-[360px]:grid-cols-2">
              <Field id="ed-start" label="Start" mono value={entry.startDate} onChange={setField("startDate")} />
              <Field id="ed-end" label="End" mono value={entry.endDate} onChange={setField("endDate")} />
            </div>
            <Field id="ed-location" label="Location" value={entry.location} onChange={setField("location")} />
          </>
        )}
        {tab === "certifications" && (
          <>
            <Field id="c-name" label="Name" value={entry.name} onChange={setField("name")} />
            <div className="grid grid-cols-1 gap-x-4 gap-y-[14px] sm:grid-cols-2">
              <Field id="c-issuer" label="Issuer" value={entry.issuer} onChange={setField("issuer")} />
              <Field id="c-date" label="Date" mono value={entry.date} onChange={setField("date")} />
            </div>
          </>
        )}

        {tab !== "certifications" && (
          <Bullets
            key={`${tab}-${i}`}
            bullets={(entry.details ?? []) as string[]}
            onChange={(next) => update((d) => { ((d as any)[tab] as any[])[i].details = next; })}
            context={tab === "projects" ? `the ${entry.name || "project"} project` : `my ${entry.title || "role"}${entry.company ? ` role at ${entry.company}` : ""}`}
            content={content}
            resumeName={resumeName}
          />
        )}
      </div>
    </div>
  );
}

const singular = (t: Listy) => ({ experience: "role", internships: "internship", projects: "project", education: "school", certifications: "certification" }[t]);

/* ─── Bullets: drag to reorder (handle), add, delete, rewrite ─────────────── */

type Row = { key: string; text: string };
let rowSeq = 0;
const toRows = (a: string[]): Row[] => a.map((text) => ({ key: `b${++rowSeq}`, text }));

function Bullets({ bullets, onChange, context, content, resumeName }: { bullets: string[]; onChange: (next: string[]) => void; context: string; content: ResumeContent; resumeName?: string }) {
  // Stable keys survive reorders; rebuilt only when the list changes from outside.
  const [rows, setRows] = useState<Row[]>(() => toRows(bullets));
  const lastEmitted = useRef<string[]>(bullets);
  useEffect(() => {
    if (JSON.stringify(bullets) !== JSON.stringify(lastEmitted.current)) {
      setRows(toRows(bullets));
      lastEmitted.current = bullets;
    }
  }, [bullets]);
  const [active, setActive] = useState(0);

  const emit = (next: Row[]) => {
    setRows(next);
    const texts = next.map((r) => r.text);
    lastEmitted.current = texts;
    onChange(texts);
  };

  const activeIdx = Math.min(active, rows.length - 1);
  const activeRow = rows[activeIdx];

  return (
    <div className="flex flex-col pt-1">
      <JkFieldLabel aside={rows.length > 1 ? <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-subtle-foreground lg:hidden">Hold to reorder</span> : undefined} className="jk-enter mb-[10px]">
        Bullets
      </JkFieldLabel>
      <Reorder.Group axis="y" values={rows} onReorder={emit} className="flex flex-col gap-2">
        {rows.map((row, idx) => (
          <BulletRow
            key={row.key}
            row={row}
            index={idx}
            active={idx === activeIdx}
            onFocus={() => setActive(idx)}
            onText={(text) => emit(rows.map((r) => (r.key === row.key ? { ...r, text } : r)))}
            onDelete={() => { emit(rows.filter((r) => r.key !== row.key)); setActive(Math.max(0, idx - 1)); }}
          />
        ))}
      </Reorder.Group>
      <div className="jk-enter mt-4">
        <Button variant="secondary" onClick={() => { emit([...rows, ...toRows([""])]); setActive(rows.length); }} className="h-[34px] bg-popover px-[22px] text-[13px] lg:h-[34px]">
          Add bullet
        </Button>
      </div>
      {activeRow && activeRow.text.trim().length > 0 && (
        <div className="mt-6">
          <JkRewriteCard
            key={activeRow.key}
            target={`bullet ${activeIdx + 1} of ${context}`}
            label={`Bullet ${activeIdx + 1}`}
            original={activeRow.text}
            content={content}
            resumeName={resumeName}
            onApply={(text) => emit(rows.map((r) => (r.key === activeRow.key ? { ...r, text } : r)))}
          />
        </div>
      )}
    </div>
  );
}

function BulletRow({ row, index, active, onFocus, onText, onDelete }: { row: Row; index: number; active: boolean; onFocus: () => void; onText: (t: string) => void; onDelete: () => void }) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={row}
      dragListener={false}
      dragControls={controls}
      className={cn(
        "group relative flex items-start gap-1 rounded-[12px] border bg-card py-[13px] pl-1.5 pr-2 transition-colors",
        active ? "border-[1.5px] border-plan" : "border-input",
      )}
      whileDrag={{ scale: 1.01, boxShadow: "0 12px 32px var(--scrim)" }}
    >
      <button
        type="button"
        aria-label={`Drag bullet ${index + 1} to reorder`}
        onPointerDown={(e) => { e.preventDefault(); controls.start(e); }}
        className="flex h-[21px] w-6 shrink-0 cursor-grab touch-none items-center justify-center text-subtle-foreground active:cursor-grabbing"
      >
        <span aria-hidden className="flex flex-col gap-[3px]">
          <span className="size-[3px] rounded-full bg-current" />
          <span className="size-[3px] rounded-full bg-current" />
          <span className="size-[3px] rounded-full bg-current" />
        </span>
      </button>
      <GrowArea
        value={row.text}
        onChange={onText}
        onFocus={onFocus}
        ariaLabel={`Bullet ${index + 1}`}
        placeholder="What you did, and what came of it"
        className="min-w-0 flex-1 pt-px text-[15px] leading-[21px] text-foreground lg:text-[13.5px] lg:leading-[19px]"
      />
      <button type="button" aria-label={`Delete bullet ${index + 1}`} onClick={onDelete} className="flex size-6 shrink-0 items-center justify-center rounded-full text-subtle-foreground opacity-100 transition-opacity hover:bg-accent hover:text-foreground lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100">
        <X className="size-3.5" />
      </button>
    </Reorder.Item>
  );
}

/* ─── Rewrite with JobKompass ──────────────────────────────────────────── */

type RewriteState = { kind: "idle" } | { kind: "loading" } | { kind: "done"; reason: string; suggestion: string } | { kind: "error"; message: string };

function resumeAsText(c: ResumeContent): string {
  return JSON.stringify(c);
}

/**
 * D08 card: four brand bars, "Rewrite with JobKompass", a one-line reason and the
 * suggested text, with Apply / Keep mine. Asks /api/resume/assist on demand, using
 * only facts already on the resume (the route scrubs anything invented).
 */
export function JkRewriteCard({ target, label, original, content, resumeName, onApply }: {
  target: string; label?: string; original: string; content: ResumeContent; resumeName?: string; onApply: (text: string) => void;
}) {
  const [state, setState] = useState<RewriteState>({ kind: "idle" });

  const ask = async () => {
    setState({ kind: "loading" });
    try {
      const message = [
        `Rewrite ${target} so it leads with the result. Keep every fact as written; do not add numbers, tools or claims that are not already on the resume.`,
        `Reply in exactly two lines. Line 1: a short reason under 12 words that ends with a colon, for example "${label ?? "This line"} says what you built. Lead with the result:". Line 2: the rewritten text in double quotes. Nothing else.`,
        `Text to rewrite: ${original}`,
        resumeName ? `Resume name: ${resumeName}` : "",
        `Resume context: ${resumeAsText(content)}`,
      ].filter(Boolean).join("\n\n");
      const res = await fetch("/api/resume/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history: [] }),
      });
      const data = await res.json().catch(() => null);
      if (res.status === 429) { setState({ kind: "error", message: "Too many requests. Try again in a minute." }); return; }
      if (!res.ok || !data?.success) { setState({ kind: "error", message: "JobKompass couldn't write a suggestion just now. Try again." }); return; }
      const parsed = parseRewrite(String(data.message ?? ""), original);
      if (!parsed) { setState({ kind: "error", message: "No better version came back. Yours already reads well." }); return; }
      setState({ kind: "done", ...parsed });
    } catch {
      setState({ kind: "error", message: "JobKompass couldn't write a suggestion just now. Try again." });
    }
  };

  return (
    <section aria-label="Rewrite with JobKompass" className="jk-enter rounded-[16px] border border-border bg-card px-4 pb-[18px] pt-4 lg:pb-4">
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <span aria-hidden className="flex shrink-0 gap-[3px]">
            {["var(--bar-1)", "var(--bar-2)", "var(--bar-3)", "var(--bar-4)"].map((c) => <span key={c} className="h-3 w-[3px] rounded-full" style={{ background: c }} />)}
          </span>
          <p className="truncate text-[15px] font-medium leading-[18px] text-foreground lg:text-[14px] lg:leading-[17px]">Rewrite with JobKompass</p>
        </div>
        {state.kind === "done" && (
          <Button variant="secondary" onClick={() => { onApply(state.suggestion); setState({ kind: "idle" }); }} className="hidden h-[30px] bg-popover px-[18px] text-[12.5px] lg:inline-flex">
            Apply
          </Button>
        )}
        {(state.kind === "idle" || state.kind === "error") && (
          <Button variant="secondary" onClick={() => void ask()} className="hidden h-[30px] bg-popover px-[18px] text-[12.5px] lg:inline-flex">
            {state.kind === "error" ? "Try again" : "Suggest"}
          </Button>
        )}
      </div>

      <div className="mt-[9px] text-[14px] leading-5 lg:text-[13px] lg:leading-[20px]">
        {state.kind === "idle" && <p className="text-muted-foreground">{label ? `${label}: ` : ""}get a version that leads with the result, from what is already on your resume.</p>}
        {state.kind === "loading" && <p className="animate-pulse text-muted-foreground">Reading your resume…</p>}
        {state.kind === "error" && <p className="text-muted-foreground">{state.message}</p>}
        {state.kind === "done" && (
          <>
            {state.reason && <p className="text-muted-foreground">{state.reason}</p>}
            <p className="mt-0.5 text-foreground max-lg:mt-2 max-lg:border-l-[3px] max-lg:border-plan max-lg:pl-3">“{state.suggestion}”</p>
          </>
        )}
      </div>

      {/* Phone: actions under the text (M15). */}
      <div className="mt-4 flex items-center gap-4 lg:hidden">
        {state.kind === "done" ? (
          <>
            <Button variant="secondary" onClick={() => { onApply(state.suggestion); setState({ kind: "idle" }); }} className="h-11 bg-popover px-10 text-[15px]">Apply</Button>
            <button type="button" onClick={() => setState({ kind: "idle" })} className="text-[15px] text-subtle-foreground hover:text-foreground">Keep mine</button>
          </>
        ) : (
          <Button variant="secondary" disabled={state.kind === "loading"} onClick={() => void ask()} className="h-11 bg-popover px-8 text-[15px]">
            {state.kind === "error" ? "Try again" : "Suggest"}
          </Button>
        )}
      </div>
      {state.kind === "done" && (
        <button type="button" onClick={() => setState({ kind: "idle" })} className="mt-2 hidden text-[12.5px] text-subtle-foreground hover:text-foreground lg:inline">Keep mine</button>
      )}
    </section>
  );
}
