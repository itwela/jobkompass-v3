import { ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { jkToneText } from "../jkBars";
import JkDocPreview from "../jkDocPreview";
import JkStatusBar from "../jkStatusBar";
import { JkStatusGlyph } from "../jkStatusChip";
import { STATUS_TEXT, statusKey } from "@/lib/jkStatus";
import { LandingContainer, Reveal, SectionHeading } from "./jkLandingShell";

const SAMPLE_JOBS = [
  { title: "GTM AI Solutions Eng...", status: "Interviewing", date: "11-05" },
  { title: "Applied AI Engineer", status: "Applied", date: "11-03" },
  { title: "Full Stack Engineer", status: "Offered", date: "10-28" },
  { title: "Solutions Engineer", status: "Ghosted", date: "10-14" },
  { title: "Backend Engineer", status: "Rejected", date: "10-09" },
];
const SAMPLE_COUNTS = [
  { status: "Interested", count: 150 }, { status: "Applied", count: 38 }, { status: "Interviewing", count: 2 },
  { status: "Offered", count: 4 }, { status: "Rejected", count: 12 }, { status: "Ghosted", count: 30 },
];

function SaveMock() {
  return (
    <div className="flex h-full flex-col px-4 py-5">
      <p className="jk-eyebrow text-subtle-foreground">Add job</p>
      <p className="mt-2.5 truncate rounded-full border-2 border-plan px-4 py-2.5 font-mono text-xs text-foreground">careers.blackrock.com/job/22417<span className="ml-px inline-block h-3.5 w-px translate-y-0.5 bg-foreground" /></p>
      <ArrowDown className="mx-auto my-3 size-5 text-border-strong" strokeWidth={1.5} />
      <div className="rounded-2xl border border-input bg-card px-4 py-3">
        <p className="jk-eyebrow text-ok">JK-237 · Saved</p>
        <p className="mt-2 font-medium text-foreground">AI Engineer</p>
        <p className="text-xs text-muted-foreground">BlackRock · New York</p>
        <p className="mt-2 flex items-center justify-between text-xs text-foreground">
          <span className="flex items-center gap-2"><JkStatusGlyph status="Interested" className="size-3.5" />Interested</span>
          <span className="font-mono">$$$$</span>
        </p>
      </div>
    </div>
  );
}

function ResumeMock() {
  return (
    <div className="relative flex h-full items-start gap-3 px-3 pt-4">
      <JkDocPreview width={150} className="rounded-sm" />
      <ul className="mt-4 min-w-0 flex-1 space-y-1.5">
        {[["Claude Code", "leads"], ["MCP first", "in skills"], ["Projects", "on top"]].map(([a, b]) => (
          <li key={a} className="relative rounded-xl border border-bar-3 bg-background px-2 py-1.5 before:absolute before:-left-3 before:top-1/2 before:h-px before:w-3 before:bg-bar-3">
            <p className="font-mono text-[8px] uppercase tracking-wider text-bar-4">Changed</p>
            <p className="text-[11px] leading-tight text-foreground">{a}<br />{b}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TrackMock() {
  return (
    <div className="h-full px-4 py-5">
      <div className="flex items-center justify-between">
        <p className="jk-eyebrow text-subtle-foreground">My Jobs</p>
        <p className="font-mono text-xs text-muted-foreground">236</p>
      </div>
      <JkStatusBar counts={SAMPLE_COUNTS} className="-mt-5 [&>div:last-child]:h-1.5" />
      <ul className="mt-2.5">
        {SAMPLE_JOBS.map((j, i) => (
          <li key={j.title} className={cn("flex items-center gap-2.5 rounded-lg px-1.5 py-1.5", i === 0 && "bg-accent/70")}>
            <JkStatusGlyph status={j.status} className="size-4" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-foreground">{j.title}</p>
              <p className={cn("text-[10px] leading-tight", STATUS_TEXT[statusKey(j.status)])}>{j.status}</p>
            </div>
            <span className="font-mono text-[10px] text-subtle-foreground">{j.date}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PrepMock() {
  return (
    <div className="flex h-full flex-col px-3 py-5">
      <div className="rounded-2xl border border-input bg-card px-3.5 py-3.5">
        <p className="jk-eyebrow text-plan-text">Card 7 of 24 · Proof</p>
        <p className="mt-3 font-medium leading-snug text-foreground">Tell me about a time you connected company data to an LLM.</p>
        <p className="jk-eyebrow mt-4 border-t border-dashed border-input pt-3 text-subtle-foreground">Space to flip</p>
      </div>
      <div className="mt-3 flex gap-1.5">
        {[["Reps", "bg-destructive"], ["Getting", "bg-warn"], ["Locked", "bg-ok"]].map(([l, c]) => (
          <span key={l} className="inline-flex flex-1 items-center gap-1.5 rounded-full border border-input px-2.5 py-1.5 text-[11px] text-foreground">
            <span className={cn("size-1.5 rounded-full", c)} />{l}
          </span>
        ))}
      </div>
      <div className="mt-3.5 flex gap-1">
        {Array.from({ length: 24 }, (_, i) => (
          <span key={i} className={cn("h-1 flex-1 rounded-full", i < 9 ? "bg-ok" : i < 15 ? "bg-warn" : "bg-border-strong")} />
        ))}
      </div>
    </div>
  );
}

const STEPS = [
  { title: "Save the job", body: "Paste a link or use the Chrome extension. The full posting is saved.", mock: <SaveMock /> },
  { title: "Write the resume", body: "JobKompass reads the posting and writes a resume and cover letter for it.", mock: <ResumeMock /> },
  { title: "Track the status", body: "Each job carries its status, the resume you sent, and your notes.", mock: <TrackMock /> },
  { title: "Prep for the interview", body: "A prep deck built from the job: pitch, flashcards, and questions to ask.", mock: <PrepMock /> },
];

export default function JkLandingSteps() {
  return (
    <section id="product" className="scroll-mt-24 pb-24 pt-20 sm:pt-28" aria-labelledby="steps-heading">
      <LandingContainer>
        <SectionHeading id="steps-heading" eyebrow="01 / How it works" tone={1} title="Four steps from posting to interview" />
        <ol className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {STEPS.map((s, i) => (
            <Reveal key={s.title} delay={i * 0.06} className="h-full">
              <li className="flex h-full flex-col rounded-modal border border-border-strong/70 bg-card p-2.5">
                <div aria-hidden className="h-[260px] overflow-hidden rounded-[1.4rem] border border-border bg-background">{s.mock}</div>
                <div className="px-4 pb-7 pt-7">
                  <p className={cn("font-mono text-xs", jkToneText((i + 1) as 1 | 2 | 3 | 4))}>0{i + 1}</p>
                  <h3 className="mt-3 text-[1.4rem] font-medium tracking-tight text-foreground">{s.title}</h3>
                  <p className="mt-2.5 text-[15px] leading-relaxed text-muted-foreground">{s.body}</p>
                </div>
              </li>
            </Reveal>
          ))}
        </ol>
      </LandingContainer>
    </section>
  );
}
