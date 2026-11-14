'use client'

/**
 * D14 / M16 Help & Guides. Desktop: guide list (search + groups) | the guide (steps) | What you get.
 * Phone: search, group chips, the open guide, then "More guides" and Contact.
 */
import { useState } from "react";
import Image from "next/image";
import { Search, ChevronRight } from "lucide-react";
import { useHelp, HELP_GROUPS, helpReadMinutes, type HelpGuide, type HelpGroup, type HelpVisual } from "@/providers/jkHelpProvider";
import { useJobKompassChatWindow } from "@/providers/jkChatWindowProvider";
import { Button } from "@/components/ui/button";
import JkAppPageHeader from "../jk-app/jkAppPageHeader";
import JkSectionLabel from "../jk-app/jkSectionLabel";
import { cn } from "@/lib/utils";

const SUPPORT_EMAIL = "itwela@cavemancreativehq.com";
const GROUP_TONE: Record<HelpGroup, string> = { Start: "var(--bar-2)", Documents: "var(--bar-3)", Automation: "var(--bar-4)" };
const STEP_TONE = ["var(--bar-1)", "var(--bar-2)", "var(--bar-3)", "var(--bar-4)"];
const mono = "font-mono text-[10px] font-medium uppercase tracking-[2px]";
const enter = (i: number) => ({ "--i": i } as React.CSSProperties);

function JkHelpSearch({ className }: { className?: string }) {
  const { searchQuery, setSearchQuery } = useHelp();
  return (
    <label className={cn("relative flex h-10 items-center", className)}>
      <Search className="pointer-events-none absolute left-[18px] size-3.5 text-muted-foreground" strokeWidth={1.8} />
      <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search guides..." aria-label="Search guides"
        className="h-full w-full rounded-full border border-input bg-card pl-[42px] pr-4 text-[13.5px] text-foreground outline-none placeholder:text-subtle-foreground focus-visible:border-plan max-lg:h-12 max-lg:text-[16px]" />
    </label>
  );
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-[96px] rounded-[12px] border border-bar-3 bg-background px-2.5 py-2 text-[12.5px] leading-4 text-foreground">
      <span className="block font-mono text-[9px] font-bold tracking-[1.2px] text-bar-4-ink">CHANGED</span>{children}
    </div>
  );
}

/** "What you get": a picture of the result each guide leads to. */
function JkHelpVisual({ kind }: { kind: HelpVisual }) {
  const page = (
    <div className="relative aspect-[186/294] w-[186px] shrink-0 overflow-hidden rounded-[4px] bg-white shadow-lg">
      <Image src="/images/jobkompass_preview_resume_jake.png" alt="A resume in the Jake template" fill sizes="186px" className="object-cover object-top" />
      {kind === "tailored" && [ [10, 13], [22, 11], [32, 14] ].map(([top, h]) => (
        <span key={top} aria-hidden className="absolute inset-x-[6%] bg-bar-3/15" style={{ top: `${top}%`, height: `${h}%` }}>
          <span className="absolute -right-[6px] top-1/4 h-1/2 w-[3px] bg-bar-3" />
        </span>
      ))}
    </div>
  );
  let body: React.ReactNode;
  if (kind === "tailored") {
    body = (
      <div className="flex items-start gap-3">
        {page}
        <div className="flex flex-col gap-1.5 pt-3">
          <Callout>Summary leads with the role</Callout>
          <Callout>Skills ordered for the posting</Callout>
          <Callout>Best project on top</Callout>
        </div>
      </div>
    );
  } else if (kind === "resume" || kind === "share") {
    body = (
      <div className="flex flex-col items-center gap-3">
        {page}
        {kind === "share" && <span className="rounded-full border border-input bg-card px-4 py-1.5 font-mono text-[11.5px] text-bar-4-ink">myjobkompass.com/r/…</span>}
      </div>
    );
  } else if (kind === "cli") {
    body = (
      <div className="w-full rounded-[14px] border border-input bg-background p-4 font-mono text-[12px] leading-[22px]">
        <p className="text-subtle-foreground">$ npm install -g jobkompass-cli</p>
        <p className="text-subtle-foreground">$ jk auth login &lt;your-key&gt;</p>
        <p className="text-foreground">$ jk jobs add --company &quot;Anthropic&quot;</p>
        <p className="text-ok">✓ saved to My Jobs</p>
        <p className="text-foreground">$ jk resumes add --job-id …</p>
        <p className="text-ok">✓ resume saved to My Documents</p>
      </div>
    );
  } else {
    const rows = kind === "folders"
      ? [["Anthropic", "3 documents"], ["Data roles", "5 documents"], ["★ Favorites", "2 documents"]]
      : [["Engineer · Anthropic", "Interested"], ["Product Engineer · Vercel", "Applied"], ["Solutions Engineer · Stripe", "Interviewing"]];
    body = (
      <ul className="flex w-full flex-col gap-2">
        {rows.map(([a, b], i) => (
          <li key={a} className="flex items-center gap-3 rounded-[12px] border border-input bg-background px-3.5 py-3">
            <span aria-hidden className="h-4 w-[3px] rounded-full" style={{ background: STEP_TONE[i + 1] }} />
            <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">{a}</span>
            <span className="font-mono text-[10.5px] text-muted-foreground">{b}</span>
          </li>
        ))}
        {kind === "extension" && <li className="pt-1 text-center font-mono text-[10.5px] text-subtle-foreground">saved from the posting page</li>}
      </ul>
    );
  }
  return <div className="flex min-h-[340px] items-center justify-center rounded-[28px] border border-input bg-card px-5 py-6">{body}</div>;
}

function JkGuideRow({ guide, active, onClick, showGroup }: { guide: HelpGuide; active: boolean; onClick: () => void; showGroup?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-current={active ? "true" : undefined}
      className={cn("group flex w-full items-center gap-3.5 text-left transition-colors",
        showGroup ? "h-[60px] border-b border-border text-[16px]" : "h-[38px] rounded-xl px-4 text-[14px]",
        active ? "bg-accent font-medium text-foreground" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground", showGroup && "bg-transparent text-foreground")}>
      <span aria-hidden className="h-3.5 w-[3px] shrink-0 rounded-full" style={{ background: active || showGroup ? GROUP_TONE[guide.group] : "var(--input)" }} />
      <span className="min-w-0 flex-1 truncate">{guide.title}</span>
      {showGroup && <><span className="font-mono text-[9.5px] tracking-[1.5px] text-subtle-foreground">{guide.group.toUpperCase()}</span><ChevronRight className="size-4 text-muted-foreground" /></>}
    </button>
  );
}

function JkContact({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-between gap-4 rounded-[20px] border border-input bg-card px-5 py-4 lg:py-3.5", className)}>
      <p className="min-w-0 text-[14px] text-muted-foreground">
        <span className="text-[16px] text-foreground lg:text-[14px] lg:text-muted-foreground">Still stuck?</span>
        <span className="block break-all font-mono text-[12px] lg:inline lg:font-sans lg:text-[14px]"><span className="max-lg:hidden"> Email </span>{SUPPORT_EMAIL}</span>
      </p>
      <Button asChild variant="outline" className="h-10 shrink-0 px-7"><a href={`mailto:${SUPPORT_EMAIL}`}>Contact</a></Button>
    </div>
  );
}

export default function JkCW_HelpMode() {
  const { guides, filteredGuides, activeGuide, setActiveGuide } = useHelp();
  const { setCurrentMode, allModes } = useJobKompassChatWindow();
  const [group, setGroup] = useState<HelpGroup | null>(null);
  const g = activeGuide;
  const open = (id?: string) => { const m = allModes.find((x) => x.id === id); if (m) setCurrentMode(m); };

  const guideBody = (
    <article key={g.id} data-enter className="jk-stagger min-w-0">
      <p className={cn(mono, "jk-enter flex items-center gap-3 text-muted-foreground lg:text-[11px]")} style={enter(0)}>
        <span aria-hidden className="h-[14px] w-[3px] rounded-full bg-plan" />Guide · {helpReadMinutes(g)} min
      </p>
      <h2 className="jk-enter mt-4 max-w-[380px] text-[34px] font-medium leading-[40px] tracking-[-1px] text-foreground lg:text-[42px] lg:leading-[46px]" style={enter(1)}>{g.title}</h2>
      <p className="jk-enter mt-3 max-w-[380px] text-[15.5px] leading-[23px] text-muted-foreground" style={enter(2)}>{g.lede}</p>
      <div className="jk-enter mt-8 lg:hidden" style={enter(3)}>
        <JkHelpVisual kind={g.visual} />
        <p className={cn(mono, "mt-5 text-subtle-foreground")}>{g.caption}</p>
      </div>
      <ol className="mt-10 flex flex-col gap-3 lg:mt-11">
        {g.steps.map((s, i) => (
          <li key={s.title} className="jk-enter flex gap-[15px]" style={enter(3 + i)}>
            <span aria-hidden className="w-[3px] shrink-0 rounded-full" style={{ background: STEP_TONE[i % 4] }} />
            <div className="py-0.5">
              <p className="font-mono text-[11px] tracking-[1.5px] text-subtle-foreground">{String(i + 1).padStart(2, "0")}</p>
              <p className="mt-1 text-[18px] font-medium leading-6 text-foreground">{s.title}</p>
              <p className="mt-1 max-w-[340px] text-[13.5px] leading-5 text-muted-foreground">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>
      {g.modeId && (
        <Button variant="outline" className="jk-enter mt-8 h-10 px-6" style={enter(8)} onClick={() => open(g.modeId)}>
          Try it
        </Button>
      )}
    </article>
  );

  const pick = (x: HelpGuide) => { setActiveGuide(x); document.getElementById("jk-help-scroll")?.scrollTo({ top: 0, behavior: "smooth" }); };
  const others = (group ? guides.filter((x) => x.group === group) : filteredGuides).filter((x) => x.id !== g.id);

  return (
    <div id="jk-help-scroll" className="chat-scroll flex h-full flex-col overflow-y-auto lg:overflow-hidden">
      <JkAppPageHeader title="Help & Guides" sub="Short guides for every part of JobKompass" art={null} />

      {/* Desktop: list | guide | what you get */}
      <div className="hidden min-h-0 flex-1 lg:flex">
        <aside className="jk-enter w-[340px] shrink-0 overflow-y-auto border-r border-border px-4 pt-[18px]" style={enter(1)}>
          <JkHelpSearch className="mx-4 mb-6" />
          {HELP_GROUPS.map((grp) => {
            const list = filteredGuides.filter((x) => x.group === grp);
            if (!list.length) return null;
            return (
              <div key={grp} className="mb-5">
                <JkSectionLabel as="h3" className="mb-2.5 px-4">{grp}</JkSectionLabel>
                {list.map((x) => <JkGuideRow key={x.id} guide={x} active={x.id === g.id} onClick={() => setActiveGuide(x)} />)}
              </div>
            );
          })}
          {filteredGuides.length === 0 && <p className="px-4 text-[13.5px] text-subtle-foreground">No guide matches that.</p>}
        </aside>
        <div className="min-w-0 flex-1 overflow-y-auto px-12 pb-10 pt-[42px]">
          <div className="grid grid-cols-1 gap-12 min-[1280px]:grid-cols-[minmax(0,1fr)_340px]">
            {guideBody}
            <div key={`v-${g.id}`} data-enter className="jk-stagger max-[1279px]:max-w-[420px]">
              <p className={cn(mono, "jk-enter mb-3.5 mt-3 text-subtle-foreground")} style={enter(2)}>What you get</p>
              <div className="jk-enter" style={enter(3)}><JkHelpVisual kind={g.visual} /></div>
              <p className={cn(mono, "jk-enter mt-6 text-subtle-foreground")} style={enter(4)}>{g.caption}</p>
            </div>
          </div>
          <JkContact className="jk-enter mt-12" />
        </div>
      </div>

      {/* Phone */}
      <div className="px-5 pb-10 pt-5 lg:hidden">
        <JkHelpSearch className="jk-enter" />
        <div className="no-scrollbar -mx-5 mt-4 flex gap-2 overflow-x-auto px-5">
          {[null, ...HELP_GROUPS].map((grp) => {
            const n = grp ? guides.filter((x) => x.group === grp).length : guides.length;
            const on = group === grp;
            return (
              <button key={grp ?? "all"} type="button" aria-pressed={on} onClick={() => setGroup(grp)}
                className={cn("relative flex h-[38px] shrink-0 items-center gap-2 overflow-hidden rounded-full px-4 text-[14.5px]", on ? "border border-plan bg-accent" : "bg-card")}>
                {grp && <span aria-hidden className="size-2 rounded-full" style={{ background: GROUP_TONE[grp] }} />}
                {grp ?? "All"}<span className="ml-1.5 font-mono text-[12px] text-muted-foreground">{n}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-8">{guideBody}</div>
        <div className="mt-12 flex items-center justify-between">
          <JkSectionLabel as="h3">More guides</JkSectionLabel>
          <span className="font-mono text-[10px] tracking-[2px] text-subtle-foreground">{others.length} MORE</span>
        </div>
        <div className="mt-3 border-t border-border">
          {others.map((x) => <JkGuideRow key={x.id} guide={x} active={false} showGroup onClick={() => pick(x)} />)}
        </div>
        <JkContact className="mt-6" />
      </div>
    </div>
  );
}
