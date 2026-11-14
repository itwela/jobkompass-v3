'use client'

/**
 * D12 / M14 Links & Resources. Every saved link (or URL-less note) is a luggage tag on the
 * chart painting: category monogram, title, link, notes. Chips filter by category with real
 * counts; the search field filters title, URL, notes and tags.
 */
import { useMemo, useState } from "react";
import { Search, Link2, MoreVertical, ExternalLink, Pencil, Trash2, X } from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";
import { useResources, type JkResource, type JkResourceInput } from "@/providers/jkResourcesProvider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import JkAppPageHeader from "../jk-app/jkAppPageHeader";
import JkArt from "../jkArt";
import { JkField, jkFieldCls, JkFormError } from "../jkField";
import JkConfirmDelete from "../jkConfirmDelete";
import { cn } from "@/lib/utils";

/** Categories in the frame's order. `tone` is the CSS colour of the dot, tag edge and monogram. */
export const JK_LINK_CATEGORIES = [
  { value: "job-board", label: "Job board", tone: "var(--bar-3)" },
  { value: "company", label: "Company", tone: "var(--bar-2)" },
  { value: "networking", label: "Networking", tone: "var(--bar-4)" },
  { value: "learning", label: "Learning", tone: "var(--bar-1)" },
  { value: "tools", label: "Tools", tone: "var(--plan)" },
  { value: "job-questions", label: "Job questions", tone: "var(--ok)" },
  { value: "job", label: "Job", tone: "var(--warn)" },
  { value: "other", label: "Other", tone: "var(--subtle-foreground)" },
] as const;

const NO_CATEGORY = { value: "", label: "Saved", tone: "var(--border-strong)" };
const categoryOf = (value?: string) => JK_LINK_CATEGORIES.find((c) => c.value === value) ?? NO_CATEGORY;

/** "https://www.wellfound.com/jobs/" -> "wellfound.com/jobs" */
export function jkShortUrl(url: string) {
  return url.replace(/^[a-z]+:\/\//i, "").replace(/^www\./, "").replace(/\/$/, "");
}
const hrefOf = (url: string) => (/^[a-z]+:\/\//i.test(url) ? url : `https://${url}`);

// A hand-hung row: each tag sits a touch off level. Cycles so neighbours never match.
const TILT = [-1.1, 0.7, -0.4, 0.9, -0.7, 0.4, -0.9, 1.1, 0.5];

function JkLinkTag({ resource, index, onEdit, onDelete }: {
  resource: JkResource; index: number; onEdit: () => void; onDelete: () => void;
}) {
  const cat = categoryOf(resource.category);
  const initial = (resource.title || resource.url || "?").trim().charAt(0).toUpperCase();
  const tag = "polygon(36px 0, 100% 0, 100% 100%, 36px 100%, 0 calc(100% - 52px), 0 52px)";
  return (
    <div
      className="jk-enter group relative pl-4 transition-transform duration-300 ease-out hover:!rotate-0 hover:-translate-y-0.5"
      style={{ "--i": Math.min(index, 8) + 3, rotate: `${TILT[index % TILT.length]}deg` } as React.CSSProperties}
    >
      {/* String: loops out from behind the tag and back to the eyelet */}
      <svg aria-hidden viewBox="0 0 44 60" className="absolute left-0 top-[44px] h-[60px] w-[44px] overflow-visible text-subtle-foreground">
        <path d="M30 8 C 4 6, -2 34, 16 50 S 34 58, 36 56" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <div className="relative h-full">
        {/* drop shadow */}
        <div aria-hidden className="absolute inset-0 translate-x-[5px] translate-y-[9px] bg-scrim/60 blur-[1px]" style={{ clipPath: tag }} />
        {/* border then surface, same outline */}
        <div className="relative h-full bg-border-strong p-px" style={{ clipPath: tag }}>
          <div className="relative flex h-full min-h-[203px] flex-col bg-popover pb-6 pl-[54px] pr-9 pt-[33px] sm:min-h-[203px]" style={{ clipPath: tag }}>
            {/* coloured right edge */}
            <span aria-hidden className="absolute inset-y-0 right-0 w-[7px]" style={{ background: cat.tone }} />

            <div className="flex items-start gap-3">
              <span
                aria-hidden
                className="relative flex size-[43px] shrink-0 items-center justify-center rounded-full border-[1.5px] text-[19px] font-semibold text-foreground"
                style={{ borderColor: cat.tone, background: `color-mix(in oklab, ${cat.tone} 22%, var(--popover))` }}
              >
                <span className="absolute inset-[4px] rounded-full border border-dashed" style={{ borderColor: cat.tone }} />
                {initial}
              </span>
              <div className="min-w-0 flex-1 pt-px">
                <p className="font-mono text-[9.5px] font-medium uppercase leading-[15px] tracking-[1.2px] text-muted-foreground">{cat.label}</p>
                <h3 className="truncate text-[17.5px] font-medium leading-[23px] tracking-[-0.2px] text-foreground" title={resource.title}>
                  {resource.title || jkShortUrl(resource.url ?? "") || "Untitled"}
                </h3>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" aria-label={`Options for ${resource.title}`} className="-mr-3 -mt-3 flex size-8 items-center justify-center rounded-full text-subtle-foreground transition-colors hover:bg-accent hover:text-foreground">
                    <MoreVertical className="size-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  {resource.url && (
                    <DropdownMenuItem asChild>
                      <a href={hrefOf(resource.url)} target="_blank" rel="noopener noreferrer"><ExternalLink className="size-4" />Open link</a>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onSelect={onEdit}><Pencil className="size-4" />Edit</DropdownMenuItem>
                  <DropdownMenuItem onSelect={onDelete} className="text-destructive focus:text-destructive"><Trash2 className="size-4" />Delete</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div aria-hidden className="mb-4 mt-[13px] border-t border-dashed border-input" />

            {resource.url ? (
              <a href={hrefOf(resource.url)} target="_blank" rel="noopener noreferrer" className="flex min-w-0 items-center gap-2 font-mono text-[11.5px] leading-[18px] text-bar-4-ink hover:underline">
                <Link2 className="size-3.5 shrink-0 -rotate-45 text-subtle-foreground" />
                <span className="truncate">{jkShortUrl(resource.url)}</span>
              </a>
            ) : (
              <p className="flex items-center gap-2 font-mono text-[11.5px] leading-[18px] text-subtle-foreground">
                <Link2 className="size-3.5 shrink-0 -rotate-45" />note
              </p>
            )}
            {resource.description && (
              <p className="mt-2.5 line-clamp-3 whitespace-pre-line text-[13.5px] leading-[22px] text-muted-foreground">{resource.description}</p>
            )}
          </div>
        </div>
        {/* Eyelet */}
        <span aria-hidden className="absolute left-[19px] top-[98px] flex size-[18px] items-center justify-center rounded-full border-2 border-border-strong bg-background">
          <span className="relative size-[11px] rounded-full bg-plan">
            <span className="absolute left-[3px] top-[2px] size-1 rounded-full bg-primary/70" />
          </span>
        </span>
      </div>
    </div>
  );
}

function JkFilterChip({ label, count, tone, active, onClick }: { label: string; count?: number; tone?: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "relative flex h-8 shrink-0 items-center gap-2 overflow-hidden rounded-full px-3.5 text-[13px] leading-[15px] transition-colors",
        active ? "border border-plan bg-accent font-medium text-foreground" : "bg-background/70 text-foreground hover:bg-accent",
      )}
    >
      {tone && !active && <span aria-hidden className="absolute inset-0 opacity-20" style={{ background: tone }} />}
      {tone && <span aria-hidden className="relative size-2 rounded-full" style={{ background: tone }} />}
      <span className="relative">{label}</span>
      {count !== undefined && <span className={cn("relative ml-2 font-mono text-[11.5px]", active ? "font-medium text-foreground" : "text-muted-foreground")}>{count}</span>}
    </button>
  );
}

/** Add or edit a link. An empty URL saves a note. */
function JkLinkSheet({ open, initial, onClose, onSubmit }: {
  open: boolean; initial: JkResourceInput | null; onClose: () => void; onSubmit: (data: JkResourceInput) => Promise<void>;
}) {
  const [draft, setDraft] = useState<JkResourceInput>({ title: "", url: "", description: "", category: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [seed, setSeed] = useState<JkResourceInput | null>(null);
  if (open && initial !== seed) { setSeed(initial); setDraft(initial ?? { title: "", url: "", description: "", category: "" }); setErr(null); }

  const editing = Boolean(initial?.title || initial?.url);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.title.trim() && !draft.url.trim()) { setErr("Give it a title or a link."); return; }
    setSaving(true);
    try { await onSubmit(draft); onClose(); } catch (x) { setErr(x instanceof Error ? x.message : "Could not save. Try again."); } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-[480px] rounded-3xl border-border bg-card">
        <DialogHeader>
          <DialogTitle className="text-[22px] font-medium tracking-[-0.3px]">{editing ? "Edit link" : "Add link"}</DialogTitle>
          <DialogDescription className="text-muted-foreground">Leave the link empty to save a note.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="mt-2 flex flex-col gap-4">
          <JkField label="Title" id="jk-link-title">
            <input id="jk-link-title" autoFocus className={cn(jkFieldCls, "h-11")} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Wellfound" />
          </JkField>
          <JkField label="Link" id="jk-link-url">
            <input id="jk-link-url" inputMode="url" className={cn(jkFieldCls, "h-11 font-mono text-[13px]")} value={draft.url} onChange={(e) => setDraft({ ...draft, url: e.target.value })} placeholder="wellfound.com/jobs" />
          </JkField>
          <JkField label="Notes" id="jk-link-notes">
            <textarea id="jk-link-notes" rows={3} className={cn(jkFieldCls, "resize-none py-3 leading-[22px]")} value={draft.description ?? ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="What it's for, when to check it" />
          </JkField>
          <div>
            <p className="mb-[7px] font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-subtle-foreground">Category</p>
            <div className="flex flex-wrap gap-2">
              {JK_LINK_CATEGORIES.map((c) => (
                <JkFilterChip key={c.value} label={c.label} tone={c.tone} active={draft.category === c.value}
                  onClick={() => setDraft({ ...draft, category: draft.category === c.value ? "" : c.value })} />
              ))}
            </div>
          </div>
          <JkFormError>{err}</JkFormError>
          <div className="mt-1 flex justify-end gap-2.5">
            <Button type="button" variant="outline" className="h-10 px-5" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="h-10 px-6" disabled={saving}>{saving ? "Saving…" : editing ? "Save" : "Add link"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function JkCW_ResourcesMode() {
  const {
    allResources, filteredResources, existingCategories, error, setError,
    selectedCategory, setSelectedCategory, handleSave, handleCreate, handleDelete,
    isAuthenticated, authLoading, searchQuery, setSearchQuery,
  } = useResources();
  const [sheet, setSheet] = useState<{ id: Id<"resources"> | null; initial: JkResourceInput | null } | null>(null);
  const [deleting, setDeleting] = useState<JkResource | null>(null);
  const [busy, setBusy] = useState(false);

  const chips = useMemo(() => JK_LINK_CATEGORIES
    .filter((c) => existingCategories.includes(c.value))
    .map((c) => ({ ...c, count: allResources.filter((r) => r.category === c.value).length })), [existingCategories, allResources]);

  if (authLoading) return null;
  if (!isAuthenticated) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
        <h2 className="text-[22px] font-medium">Sign in to keep your links</h2>
        <Button onClick={() => { window.location.href = "/auth"; }} className="h-11 px-6">Sign in</Button>
      </div>
    );
  }

  const search = (
    <label className="relative flex h-10 w-full min-w-0 items-center sm:w-[360px]">
      <Search className="pointer-events-none absolute left-[19px] size-3.5 text-subtle-foreground" strokeWidth={1.8} />
      <input
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search title, URL, tags"
        aria-label="Search links"
        className="h-full w-full rounded-full border border-input bg-card pl-[44px] pr-9 text-[14px] text-foreground outline-none placeholder:text-subtle-foreground focus-visible:border-plan"
      />
      {searchQuery && (
        <button type="button" onClick={() => setSearchQuery("")} aria-label="Clear search" className="absolute right-3 text-subtle-foreground hover:text-foreground"><X className="size-4" /></button>
      )}
    </label>
  );

  const chipRow = (
    <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 lg:mx-0 lg:flex-wrap lg:px-0 lg:pt-[22px]">
      <JkFilterChip label="All" count={allResources.length} active={selectedCategory === null} onClick={() => setSelectedCategory(null)} />
      {chips.map((c) => (
        <JkFilterChip key={c.value} label={c.label} count={c.count} tone={c.tone} active={selectedCategory === c.value}
          onClick={() => setSelectedCategory(selectedCategory === c.value ? null : c.value)} />
      ))}
    </div>
  );

  return (
    <div className="chat-scroll relative flex h-full flex-col overflow-y-auto">
      <JkAppPageHeader
        title="Links & Resources"
        sub="Job boards, company pages, and notes you keep coming back to"
        art="harbour"
        artPosition="center 40%"
        divider={false}
        actions={<div className="hidden items-center gap-2.5 sm:flex">
          {search}
          <Button className="h-10 px-7 text-[14.5px]" onClick={() => setSheet({ id: null, initial: null })}>Add link</Button>
        </div>}
        bottom={chipRow}
      />

      <section className="relative isolate flex-1 px-5 pb-16 pt-6 lg:px-8 lg:pt-9">
        {/* The chart painting behind the tags, under a half veil, fading up into the header */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <JkArt name="chart" variant="section" fade="none" />
          <div className="absolute inset-0 bg-background/50" />
          <div className="absolute inset-x-0 top-0 h-[120px] bg-gradient-to-b from-background to-transparent" />
        </div>

        {error && (
          <div className="mb-5 flex items-start justify-between gap-3 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-[13.5px] text-destructive">
            {error}<button type="button" onClick={() => setError(null)} aria-label="Dismiss"><X className="size-4" /></button>
          </div>
        )}

        {allResources.length === 0 ? (
          <div className="jk-enter mx-auto flex max-w-sm flex-col items-center py-24 text-center" style={{ "--i": 3 } as React.CSSProperties}>
            <h2 className="text-[22px] font-medium tracking-[-0.3px]">No links yet</h2>
            <p className="mt-2 text-[14px] leading-[22px] text-muted-foreground">Save the job boards, company pages and answers you keep going back to.</p>
            <Button className="mt-6 h-11 px-7" onClick={() => setSheet({ id: null, initial: null })}>Add link</Button>
          </div>
        ) : filteredResources.length === 0 ? (
          <div className="mx-auto flex max-w-sm flex-col items-center py-24 text-center">
            <h2 className="text-[20px] font-medium">Nothing matches</h2>
            <Button variant="outline" className="mt-5 h-10 px-6" onClick={() => { setSelectedCategory(null); setSearchQuery(""); }}>Clear filters</Button>
          </div>
        ) : (
          <div className="mx-auto grid max-w-[1180px] grid-cols-1 gap-x-6 gap-y-7 min-[760px]:grid-cols-2 min-[1180px]:grid-cols-3">
            {filteredResources.map((r, i) => (
              <JkLinkTag
                key={r._id}
                resource={r}
                index={i}
                onEdit={() => setSheet({ id: r._id, initial: { title: r.title, url: r.url ?? "", description: r.description ?? "", category: r.category ?? "" } })}
                onDelete={() => setDeleting(r)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Phone: the frame keeps the header to chips only, so Add link floats above the tab bar */}
      <Button
        className="fixed right-5 z-30 h-11 px-6 shadow-lg shadow-scrim sm:hidden"
        style={{ bottom: "calc(var(--jk-tabbar-h) + 16px)" }}
        onClick={() => setSheet({ id: null, initial: null })}
      >Add link</Button>

      <JkLinkSheet
        open={sheet !== null}
        initial={sheet?.initial ?? null}
        onClose={() => setSheet(null)}
        onSubmit={async (data) => {
          if (sheet?.id) await handleSave(sheet.id, data);
          else await handleCreate(data);
        }}
      />

      <Dialog open={deleting !== null} onOpenChange={(o) => { if (!o) setDeleting(null); }}>
        <DialogContent className="max-w-[420px] rounded-3xl border-border bg-card">
          <DialogHeader>
            <DialogTitle className="text-[20px] font-medium">Delete {deleting?.title || "this link"}?</DialogTitle>
          </DialogHeader>
          <JkConfirmDelete
            onConfirm={async () => { if (!deleting) return; setBusy(true); await handleDelete(deleting._id); setBusy(false); setDeleting(null); }}
            onCancel={() => setDeleting(null)}
            isLoading={busy}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
