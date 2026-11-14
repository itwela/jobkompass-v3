'use client'

import { cn } from "@/lib/utils";
import { JkTick } from "../jkBars";
import JkArt from "../jkArt";
import JkStatusBar from "../jkStatusBar";
import JkStatusChip, { JkStatusGlyph } from "../jkStatusChip";
import { LandingContainer, Reveal, SectionHeading, useOnScreen } from "./jkLandingShell";

const ROWS = [
  { title: "GTM AI Solutions Engineer", company: "PTC (via Mondo)", status: "Interviewing", resume: "Resume - Mondo" },
  { title: "Junior Software Engineer", company: "Mechanize", status: "Interested", resume: "-" },
  { title: "Applied AI Engineer", company: "Northwind Labs", status: "Applied", resume: "Base resume" },
  { title: "Full Stack Engineer", company: "Brightwave", status: "Offered", resume: "Resume - Web" },
  { title: "Solutions Engineer", company: "Cloudline", status: "Ghosted", resume: "Base resume" },
  { title: "Backend Engineer", company: "Tessera", status: "Rejected", resume: "Base resume" },
  { title: "Developer Advocate", company: "Kiln", status: "Applied", resume: "Resume - DevRel" },
  { title: "Software Engineer Intern", company: "Halcyon", status: "Offered", resume: "Base resume" },
];
const COUNTS = [
  { status: "Interested", count: 105 }, { status: "Applied", count: 42 }, { status: "Interviewing", count: 3 },
  { status: "Offered", count: 4 }, { status: "Rejected", count: 13 }, { status: "Ghosted", count: 69 },
];

// Phone version of the preview (M00): five jobs, one per status, no table.
const PHONE_ROWS = [
  { title: "GTM AI Solutions Engineer", company: "PTC (via Mondo)", status: "Interviewing", date: "11-05" },
  { title: "Applied AI Engineer", company: "Northwind Labs", status: "Applied", date: "11-03" },
  { title: "Full Stack Engineer", company: "Brightwave", status: "Offered", date: "10-28" },
  { title: "Solutions Engineer", company: "Cloudline", status: "Ghosted", date: "10-14" },
  { title: "Backend Engineer", company: "Tessera", status: "Rejected", date: "10-09" },
];

function PhoneJobs() {
  const ref = useOnScreen<HTMLDivElement>();
  return (
    <div ref={ref} aria-hidden className="jk-play rounded-[24px] border border-border-strong/70 bg-sky px-5 pb-1.5 pt-5">
      <div className="flex items-baseline justify-between">
        <p className="text-[17px] font-medium text-foreground">My Jobs</p>
        <p className="font-mono text-[10px] uppercase tracking-[1px] text-subtle-foreground">236 jobs</p>
      </div>
      <JkStatusBar counts={COUNTS} className="jk-grow -mt-4 [&>div:last-child]:h-[5px]" />
      <ul className="mt-[15px]">
        {PHONE_ROWS.map((r, i) => (
          <li key={r.title} className={cn("flex h-[50px] items-center gap-[13px] border-t border-border", i === 0 && "jk-lift -mx-3 rounded-xl px-3")}>
            {i === 0 ? (
              // The top job gets its interview while you watch: Applied, then Interviewing.
              <>
                <span className="jk-sw jk-sw2 size-3 shrink-0"><JkStatusGlyph status="Applied" className="size-3" /><JkStatusGlyph status="Interviewing" className="size-3" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium leading-[19px] text-foreground">{r.title}</p>
                  <p className="jk-sw jk-sw2 truncate text-[11.5px] leading-[15px] text-muted-foreground"><span>{r.company} · Applied</span><span>{r.company} · Interviewing</span></p>
                </div>
              </>
            ) : (
              <>
                <JkStatusGlyph status={r.status} className="size-3 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium leading-[19px] text-foreground">{r.title}</p>
                  <p className="truncate text-[11.5px] leading-[15px] text-muted-foreground">{r.company} · {r.status}</p>
                </div>
              </>
            )}
            <span className="font-mono text-[10.5px] text-subtle-foreground">{r.date}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function JkLandingApp() {
  const playRef = useOnScreen<HTMLDivElement>();
  return (
    <section className="relative isolate overflow-hidden pb-[70px] pt-[29px] lg:pb-[72px] lg:pt-[88px]" aria-labelledby="app-heading">
      <JkArt name="waves" fade="y" live gain={1.3} className="-z-10 opacity-60 lg:opacity-50" />
      <LandingContainer>
        <SectionHeading id="app-heading" title={<>Stop losing track of <br className="lg:hidden" />where you applied</>} lead="Every job, document, and conversation sits in one account, and the chat can read all of it." />
        <Reveal className="-mt-[5px] lg:hidden"><PhoneJobs /></Reveal>
        <div ref={playRef} className="jk-play hidden gap-4 lg:grid lg:grid-cols-[2fr_1fr]">
          <Reveal>
            <div aria-hidden className="h-full overflow-hidden rounded-modal border border-border-strong/70 bg-card">
              <div className="px-6 pt-6">
                <div className="flex items-baseline justify-between">
                  <p className="text-xl font-medium text-foreground">My Jobs</p>
                  <p className="jk-eyebrow text-subtle-foreground">236 jobs</p>
                </div>
                <JkStatusBar counts={COUNTS} className="jk-grow -mt-4" />
              </div>
              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr className="jk-eyebrow text-subtle-foreground">
                      {["Title", "Company", "Status", "Resume used"].map((h) => <th key={h} className="px-6 py-3 font-normal">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {ROWS.map((r, i) => (
                      <tr key={r.title} className={cn("border-t border-border", i === 0 && "jk-lift shadow-[inset_2px_0_0_var(--bar-4)]")}>
                        <td className="px-6 py-3 font-medium text-foreground">{r.title}</td>
                        <td className="px-6 py-3 text-muted-foreground">{r.company}</td>
                        <td className="px-6 py-3">
                          {i === 0 ? (
                            // The top job gets its interview while you watch.
                            <span className="jk-sw jk-sw2"><JkStatusChip status="Applied" /><JkStatusChip status="Interviewing" /></span>
                          ) : <JkStatusChip status={r.status} />}
                        </td>
                        <td className="px-6 py-3 text-muted-foreground">{r.resume}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Reveal>
          <div className="grid gap-4">
            <Reveal delay={0.06}>
              <div aria-hidden className="h-full rounded-modal border border-border-strong/70 bg-card p-6">
                <p className="text-xl font-medium text-foreground">Chat that knows your documents</p>
                <p className="jk-pop mt-4 rounded-full bg-accent px-4 py-2 text-sm text-foreground">Tailor my resume to the PTC role.</p>
                <ul className="mt-4 space-y-2 font-mono text-xs text-muted-foreground">
                  <li className="jk-pop flex items-center gap-2.5" style={{ "--d": "0.7s" } as React.CSSProperties}><JkTick tone={2} />Read job · GTM AI Solutions Engineer</li>
                  <li className="jk-pop flex items-center gap-2.5" style={{ "--d": "1.4s" } as React.CSSProperties}><JkTick tone={2} />Read resume · Software Engineer, base</li>
                  <li className="jk-pop flex items-center gap-2.5" style={{ "--d": "2.1s" } as React.CSSProperties}><JkTick tone={4} />Wrote resume · 1 page · 3 changes</li>
                </ul>
              </div>
            </Reveal>
            <Reveal delay={0.12}>
              <div aria-hidden className="h-full rounded-modal border border-border-strong/70 bg-card p-6">
                <p className="text-xl font-medium text-foreground">See what changed and why</p>
                <ul className="mt-4 space-y-2">
                  {[["Summary", "Claude Code now leads the summary"], ["Skills", "MCP and RAG first in the skills list"], ["Experience", "MCP projects moved to the top"]].map(([k, v], i) => (
                    <li key={k} style={{ "--d": `${2.8 + i * 0.5}s` } as React.CSSProperties} className="jk-pop flex gap-3 rounded-xl border border-border bg-background px-3 py-2">
                      <JkTick tone={4} className="mt-0.5 h-8" />
                      <div>
                        <p className="jk-eyebrow text-bar-4-ink">{k}</p>
                        <p className="text-sm text-foreground">{v}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>
        </div>
      </LandingContainer>
    </section>
  );
}
