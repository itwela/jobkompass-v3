import { cn } from "@/lib/utils";
import { JkTick } from "../jkBars";
import JkArt from "../jkArt";
import JkStatusBar from "../jkStatusBar";
import JkStatusChip from "../jkStatusChip";
import { LandingContainer, Reveal, SectionHeading } from "./jkLandingShell";

const ROWS = [
  { id: "JK-236", title: "GTM AI Solutions Engineer", company: "PTC (via Mondo)", status: "Interviewing", resume: "Resume - Mondo" },
  { id: "JK-235", title: "Junior Software Engineer", company: "Mechanize", status: "Interested", resume: "-" },
  { id: "JK-232", title: "Applied AI Engineer", company: "Northwind Labs", status: "Applied", resume: "Base resume" },
  { id: "JK-230", title: "Full Stack Engineer", company: "Brightwave", status: "Offered", resume: "Resume - Web" },
  { id: "JK-229", title: "Solutions Engineer", company: "Cloudline", status: "Ghosted", resume: "Base resume" },
  { id: "JK-228", title: "Backend Engineer", company: "Tessera", status: "Rejected", resume: "Base resume" },
  { id: "JK-226", title: "Developer Advocate", company: "Kiln", status: "Applied", resume: "Resume - DevRel" },
  { id: "JK-225", title: "Software Engineer Intern", company: "Halcyon", status: "Offered", resume: "Base resume" },
];
const COUNTS = [
  { status: "Interested", count: 105 }, { status: "Applied", count: 42 }, { status: "Interviewing", count: 3 },
  { status: "Offered", count: 4 }, { status: "Rejected", count: 13 }, { status: "Ghosted", count: 69 },
];

export default function JkLandingApp() {
  return (
    <section className="relative isolate overflow-hidden py-20 sm:py-28" aria-labelledby="app-heading">
      <JkArt name="waves" fade="y" className="-z-10 opacity-35" />
      <LandingContainer>
        <SectionHeading id="app-heading" eyebrow="02 / The app" tone={2} title="Stop losing track of where you applied" lead="Every job, document, and conversation sits in one account, and the chat can read all of it." />
        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <Reveal>
            <div aria-hidden className="h-full overflow-hidden rounded-modal border border-border-strong/70 bg-card">
              <div className="px-6 pt-6">
                <div className="flex items-baseline justify-between">
                  <p className="text-xl font-medium text-foreground">My Jobs</p>
                  <p className="jk-eyebrow text-subtle-foreground">236 jobs</p>
                </div>
                <JkStatusBar counts={COUNTS} className="-mt-4" />
              </div>
              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr className="jk-eyebrow text-subtle-foreground">
                      {["ID", "Title", "Company", "Status", "Resume used"].map((h) => <th key={h} className="px-6 py-3 font-normal">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {ROWS.map((r, i) => (
                      <tr key={r.id} className={cn("border-t border-border", i === 0 && "bg-accent/70 shadow-[inset_2px_0_0_var(--bar-4)]")}>
                        <td className={cn("px-6 py-3 font-mono text-xs", i === 0 ? "text-bar-4" : "text-subtle-foreground")}>{r.id}</td>
                        <td className="px-6 py-3 font-medium text-foreground">{r.title}</td>
                        <td className="px-6 py-3 text-muted-foreground">{r.company}</td>
                        <td className="px-6 py-3"><JkStatusChip status={r.status} /></td>
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
                <p className="mt-4 rounded-full bg-accent px-4 py-2 text-sm text-foreground">Tailor my resume to the PTC role.</p>
                <ul className="mt-4 space-y-2 font-mono text-xs text-muted-foreground">
                  <li className="flex items-center gap-2.5"><JkTick tone={2} />Read job · GTM AI Solutions Engineer</li>
                  <li className="flex items-center gap-2.5"><JkTick tone={2} />Read resume · Software Engineer, base</li>
                  <li className="flex items-center gap-2.5"><JkTick tone={4} />Wrote resume · 1 page · 3 changes</li>
                </ul>
              </div>
            </Reveal>
            <Reveal delay={0.12}>
              <div aria-hidden className="h-full rounded-modal border border-border-strong/70 bg-card p-6">
                <p className="text-xl font-medium text-foreground">See what changed and why</p>
                <ul className="mt-4 space-y-2">
                  {[["Summary", "Claude Code now leads the summary"], ["Skills", "MCP and RAG first in the skills list"], ["Experience", "MCP projects moved to the top"]].map(([k, v]) => (
                    <li key={k} className="flex gap-3 rounded-xl border border-border bg-background px-3 py-2">
                      <JkTick tone={4} className="mt-0.5 h-8" />
                      <div>
                        <p className="jk-eyebrow text-bar-4">{k}</p>
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
